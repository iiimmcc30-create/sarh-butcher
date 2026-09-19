import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/services/logger.service';
import {
  fetchRedisServerStats,
  getSharedRedisClient,
  isRedisCircuitOpen,
  tripRedisCircuit,
} from '../redis-connection';

const DEFAULT_TTL = 300;

/** Isolated from SARH Redis. Default prefix butcherapp: */
export function redisKey(key: string): string {
  const prefix = process.env.REDIS_KEY_PREFIX || 'butcherapp:';
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}

@Injectable()
export class RedisCacheService {
  private unavailableLogged = false;
  private readonly memorySets = new Map<string, Set<string>>();

  constructor(private readonly logger: LoggerService) {}

  isEnabled(): boolean {
    if (process.env.REDIS_ENABLED === 'false') return false;
    if (isRedisCircuitOpen()) return false;
    return true;
  }

  getClient() {
    if (!this.isEnabled()) throw new Error('Redis disabled');
    return getSharedRedisClient(0);
  }

  private markUnavailable(err?: unknown) {
    tripRedisCircuit();
    if (!this.unavailableLogged) {
      this.unavailableLogged = true;
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Redis unavailable — cache skipped',
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) return null;
    try {
      const client = this.getClient();
      if (client.status !== 'ready') return null;
      const val = await client.get(redisKey(key));
      return val ? (JSON.parse(val) as T) : null;
    } catch (err) {
      this.markUnavailable(err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const client = this.getClient();
      if (client.status !== 'ready') return;
      await client.set(redisKey(key), JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    for (const key of keys) this.memorySets.delete(key);
    if (!this.isEnabled()) return;
    try {
      await this.getClient().del(...keys.map(redisKey));
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async sadd(key: string, member: string, ttl = DEFAULT_TTL): Promise<void> {
    const local = this.memorySets.get(key) ?? new Set<string>();
    local.add(member);
    this.memorySets.set(key, local);
    if (!this.isEnabled()) return;
    try {
      const client = this.getClient();
      if (client.status !== 'ready') return;
      await client.sadd(redisKey(key), member);
      await client.expire(redisKey(key), ttl);
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async srem(key: string, member: string): Promise<void> {
    this.memorySets.get(key)?.delete(member);
    if (!this.isEnabled()) return;
    try {
      const client = this.getClient();
      if (client.status !== 'ready') return;
      await client.srem(redisKey(key), member);
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.isEnabled()) {
      return this.memorySets.get(key)?.size ?? 0;
    }
    try {
      const client = this.getClient();
      if (client.status !== 'ready') {
        return this.memorySets.get(key)?.size ?? 0;
      }
      return await client.scard(redisKey(key));
    } catch (err) {
      this.markUnavailable(err);
      return this.memorySets.get(key)?.size ?? 0;
    }
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl = DEFAULT_TTL,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.isEnabled()) return 0;
    try {
      const redis = this.getClient();
      let cursor = '0';
      let deleted = 0;
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          redisKey(pattern),
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length) {
          await redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');
      return deleted;
    } catch (err) {
      this.markUnavailable(err);
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    try {
      await this.getClient().ping();
      return true;
    } catch {
      return false;
    }
  }

  async serverStats() {
    if (!this.isEnabled()) return null;
    try {
      return await fetchRedisServerStats(this.getClient());
    } catch {
      return null;
    }
  }

  readonly keys = {
    user: (id: string) => `user:${id}`,
    listing: (id: string) => `listing:${id}`,
    listings: (page: number, filters: string) => `listings:${page}:${filters}`,
    post: (id: string) => `post:${id}`,
    posts: (page: number) => `posts:${page}`,
    butcher: (id: string) => `butcher:${id}`,
    butchers: (country: string, page: number) => `butchers:${country}:${page}`,
    userFeed: (userId: string, page: number) => `feed:${userId}:${page}`,
    liveStreams: () => 'streams:live',
  };
}
