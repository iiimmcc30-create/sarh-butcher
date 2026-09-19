import IORedis, { RedisOptions } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

type ParsedRedisUrl = {
  host: string;
  port: number;
  password?: string;
  username?: string;
};

export type SharedRedisKind =
  'default' | 'bullmq' | 'subscriber' | 'listener-sub';

const sharedClients = new Map<string, IORedis>();
let bullmqSubscriber: IORedis | null = null;

let redisCircuitOpenUntil = 0;
const REDIS_CIRCUIT_MS = 15_000;

export function isRedisCircuitOpen(): boolean {
  return Date.now() < redisCircuitOpenUntil;
}

export function tripRedisCircuit(): void {
  redisCircuitOpenUntil = Date.now() + REDIS_CIRCUIT_MS;
}

function parseRedisUrl(raw: string): ParsedRedisUrl | null {
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname) return null;
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
    };
  } catch {
    return null;
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export class MalahemRedisConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalahemRedisConfigError';
  }
}

/**
 * Resolve Malahem Redis. Never silently uses localhost:6379 (Sarh on this host).
 * Docker-internal hosts may use port 6379 (the container's own Redis).
 */
export function resolveMalahemRedisTarget(
  env: NodeJS.ProcessEnv = process.env,
): ParsedRedisUrl {
  const urlRaw = env.REDIS_URL?.trim() || env.MALAHEM_REDIS_URL?.trim() || '';
  const fromUrl = urlRaw ? parseRedisUrl(urlRaw) : null;
  const host = (fromUrl?.host || env.REDIS_HOST?.trim() || '').toLowerCase();

  if (!host) {
    throw new MalahemRedisConfigError(
      'MALAHEM_REDIS_URL or REDIS_URL or REDIS_HOST is required. Refusing to default to localhost:6379 (Sarh Redis).',
    );
  }

  let port = fromUrl?.port;
  if (!port) {
    const raw = env.REDIS_PORT?.trim();
    if (raw) port = parseInt(raw, 10);
  }
  if (!port && !LOOPBACK_HOSTS.has(host)) {
    // Redis URL without an explicit port — protocol default, not a host-machine fallback.
    port = 6379;
  }
  if (!port) {
    throw new MalahemRedisConfigError(
      'REDIS_PORT is required when Redis host is localhost/127.0.0.1. Use 6380 for Malahem. Refusing silent 6379.',
    );
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new MalahemRedisConfigError(`Invalid Redis port: ${port}`);
  }
  if (LOOPBACK_HOSTS.has(host) && port === 6379) {
    throw new MalahemRedisConfigError(
      'Refusing Redis localhost:6379 — that is the Sarh instance. Set MALAHEM_REDIS_URL=redis://127.0.0.1:6380',
    );
  }

  return {
    host: fromUrl?.host || env.REDIS_HOST!.trim(),
    port,
    password: fromUrl?.password || env.REDIS_PASSWORD || undefined,
    username: fromUrl?.username,
  };
}

/**
 * Shared Redis connection options.
 * Prefers REDIS_URL / MALAHEM_REDIS_URL, then HOST/PORT. Never defaults to 6379 on loopback.
 */
export function redisConnection(
  db: number,
  extra: RedisOptions = {},
): RedisOptions {
  const target = resolveMalahemRedisTarget();

  return {
    host: target.host,
    port: target.port,
    password: target.password,
    ...(target.username ? { username: target.username } : {}),
    ...extra,
    db,
  };
}

function clientKey(db: number, kind: SharedRedisKind): string {
  return `${db}:${kind}`;
}

/** One TCP connection per DB/kind per process — reduces Render Redis max-clients pressure. */
export function getSharedRedisClient(
  db: number,
  kind: SharedRedisKind = 'default',
): IORedis {
  const key = clientKey(db, kind);
  const existing = sharedClients.get(key);
  if (existing) return existing;

  const extra: RedisOptions =
    kind === 'bullmq' || kind === 'subscriber' || kind === 'listener-sub'
      ? {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: kind === 'bullmq' ? false : true,
        }
      : {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          enableOfflineQueue: false,
          connectTimeout: 800,
          commandTimeout: 500,
          lazyConnect: true,
          retryStrategy(times: number) {
            if (times > 1) return null;
            return 150;
          },
        };

  const client = new IORedis(redisConnection(db, extra));
  sharedClients.set(key, client);
  return client;
}

export function duplicateSharedRedisClient(
  db: number,
  kind: SharedRedisKind = 'default',
): IORedis {
  return getSharedRedisClient(db, kind).duplicate();
}

/**
 * One command connection for all BullMQ queues in this process.
 * Worker/subscriber sockets still duplicate (BullMQ blocking requirement).
 */
export function getBullmqSharedConnection(): ConnectionOptions {
  return getSharedRedisClient(1, 'bullmq') as unknown as ConnectionOptions;
}

/**
 * BullMQ `createClient` hook.
 * - command `client`: reused singleton
 * - `subscriber`: one shared duplicate (pub/sub can multiplex)
 * - `bclient`: unique duplicate per worker (blocking BRPOP cannot be shared)
 */
export function createBullmqClient(
  type: 'client' | 'subscriber' | 'bclient' = 'client',
): ConnectionOptions {
  const shared = getSharedRedisClient(1, 'bullmq');
  if (type === 'client') {
    return shared as unknown as ConnectionOptions;
  }
  if (type === 'subscriber') {
    if (!bullmqSubscriber) {
      bullmqSubscriber = shared.duplicate();
    }
    return bullmqSubscriber as unknown as ConnectionOptions;
  }
  return shared.duplicate() as unknown as ConnectionOptions;
}

export async function closeSharedRedisClients(): Promise<void> {
  if (bullmqSubscriber) {
    try {
      bullmqSubscriber.disconnect();
    } catch {
      /* ignore */
    }
    bullmqSubscriber = null;
  }
  for (const client of sharedClients.values()) {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
  sharedClients.clear();
}

export type RedisServerStats = {
  connected_clients: number | null;
  blocked_clients: number | null;
  maxclients: number | null;
  maxmemory_policy: string | null;
};

/** Parse Redis/Valkey INFO text. Server-wide — not per logical DB. */
export function parseRedisInfo(info: string): RedisServerStats {
  const map: Record<string, string> = {};
  for (const line of info.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    map[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  const num = (key: string): number | null => {
    const raw = map[key];
    if (raw == null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return {
    connected_clients: num('connected_clients'),
    blocked_clients: num('blocked_clients'),
    maxclients: num('maxclients'),
    maxmemory_policy: map.maxmemory_policy || null,
  };
}

export async function fetchRedisServerStats(
  client: IORedis,
): Promise<RedisServerStats | null> {
  if (client.status !== 'ready') return null;
  const info = await client.info();
  return parseRedisInfo(info);
}

/** DBs this process should open at boot. Worker does not use sessions (db 2). */
export function redisWarmupDbs(
  serviceMode = process.env.SERVICE_MODE,
): number[] {
  if (serviceMode === 'worker') return [0];
  return [0, 2];
}
