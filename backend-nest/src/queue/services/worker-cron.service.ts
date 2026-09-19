import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import axios from 'axios';
import { LoggerService } from '../../common/services/logger.service';
import { WorkerCronRepository } from '../repositories/worker-cron.repository';
import { RedisCacheService } from '../../redis/services/redis-cache.service';
import { DaftraService } from '../../integrations/daftra/daftra.service';
import { cronCleanupAuthHeader } from '../../admin/lib/cron-auth';
import { butcherRedisKey } from '../../redis/redis-key';
import { publicApiBase } from '../../lib/public-urls';

export const DAFTRA_PRODUCT_SYNC_INTERVAL_MS = 10 * 60 * 1000;
export const DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC = 9 * 60;

@Injectable()
export class WorkerCronService implements OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private daftraProductSyncInterval: ReturnType<typeof setInterval> | null =
    null;
  private readonly lastRun: Record<string, string> = {};

  constructor(
    private readonly cronRepo: WorkerCronRepository,
    private readonly cache: RedisCacheService,
    @Optional() private readonly daftra: DaftraService,
    private readonly logger: LoggerService,
  ) {
    this.interval = setInterval(() => void this.tick(), 60 * 60 * 1000);
    this.keepAliveInterval = setInterval(
      () => void this.pingPublicHealth(),
      8 * 60 * 1000,
    );
    this.daftraProductSyncInterval = setInterval(
      () => void this.runDaftraProductSyncCron(),
      DAFTRA_PRODUCT_SYNC_INTERVAL_MS,
    );
    this.logger.info({}, '🔧 Workers started');
    setTimeout(() => void this.pingPublicHealth(), 15_000);
    setTimeout(() => void this.runDaftraProductSyncCron(), 45_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.daftraProductSyncInterval) {
      clearInterval(this.daftraProductSyncInterval);
    }
  }

  private shouldRun(key: string, hour: number): boolean {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currHour = now.getHours();
    if (currHour === hour && this.lastRun[key] !== today) {
      this.lastRun[key] = today;
      return true;
    }
    return false;
  }

  private async withLock(
    key: string,
    ttl: number,
    fn: () => Promise<void>,
  ): Promise<void> {
    if (!this.cache.isEnabled()) return;
    try {
      const redis = this.cache.getClient();
      const acquired = await redis.set(key, '1', 'EX', ttl, 'NX');
      if (!acquired) {
        this.logger.debug(
          { key },
          'Cron lock not acquired — another instance running',
        );
        return;
      }
      await fn();
    } catch (err) {
      this.logger.error({ err, key }, 'Cron job error');
    }
  }

  private async runDbCleanupCron(): Promise<void> {
    const appUrl = publicApiBase();
    if (
      process.env.NODE_ENV === 'production' &&
      /localhost|127\.0\.0\.1/i.test(appUrl)
    ) {
      this.logger.warn(
        {},
        'APP_URL points at localhost in production — cleanup will not reach the API',
      );
    }
    await this.withLock(butcherRedisKey('cron:db_cleanup:lock'), 300, async () => {
      const headers = cronCleanupAuthHeader(process.env.CRON_SECRET);
      if (!headers) {
        this.logger.error(
          {},
          'Skipping DB cleanup — CRON_SECRET is not configured',
        );
        return;
      }
      this.logger.info({}, 'Running daily database cleanup');
      try {
        const response = await axios.post(
          `${appUrl}/api/admin/cleanup`,
          {},
          {
            headers,
            timeout: 30000,
          },
        );
        this.logger.info(
          { status: response.status },
          'Database cleanup triggered via API',
        );
      } catch (err: unknown) {
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: message, status }, 'DB cleanup cron failed');
      }
    });
  }

  /**
   * Poll Daftra → butcher products for every CONNECTED butcher.
   * Reuses DaftraService.syncProductsFromDaftra; one failure does not stop others.
   */
  async runDaftraProductSyncCron(): Promise<{
    attempted: number;
    synced: number;
    skippedLocked: number;
    failed: number;
  }> {
    const summary = {
      attempted: 0,
      synced: 0,
      skippedLocked: 0,
      failed: 0,
    };

    let butcherIds: string[] = [];
    try {
      butcherIds = await this.daftra.listConnectedButcherIds();
    } catch (err) {
      this.logger.error(
        {
          err: err instanceof Error ? err.message : 'list_connected_failed',
        },
        'Daftra product poll: failed to list connected butchers',
      );
      return summary;
    }

    this.logger.info(
      { connectedCount: butcherIds.length },
      'Daftra product poll: starting',
    );

    for (const butcherId of butcherIds) {
      summary.attempted += 1;
      try {
        const outcome = await this.syncConnectedButcherProducts(butcherId);
        if (outcome === 'synced') summary.synced += 1;
        else if (outcome === 'locked') summary.skippedLocked += 1;
      } catch (err) {
        summary.failed += 1;
        this.logger.warn(
          {
            butcherId,
            err: err instanceof Error ? err.message : 'sync_failed',
          },
          'Daftra product poll failed for butcher — continuing',
        );
      }
    }

    this.logger.info(summary, 'Daftra product poll: finished');
    return summary;
  }

  private async syncConnectedButcherProducts(
    butcherId: string,
  ): Promise<'synced' | 'locked'> {
    const run = async () => {
      const result = await this.daftra.syncProductsFromDaftra(null, butcherId);
      this.logger.info(
        {
          butcherId,
          fetched: result.fetched,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          pages: result.pages,
          errorCount: result.errors.length,
        },
        'Daftra product poll synced butcher',
      );
    };

    if (!this.cache.isEnabled()) {
      await run();
      return 'synced';
    }

    const lockKey = butcherRedisKey(`cron:daftra_products:${butcherId}`);
    const redis = this.cache.getClient();
    const acquired = await redis.set(
      lockKey,
      '1',
      'EX',
      DAFTRA_PRODUCT_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    if (!acquired) {
      this.logger.debug(
        { butcherId, lockKey },
        'Daftra product poll: lock not acquired',
      );
      return 'locked';
    }

    await run();
    return 'synced';
  }

  private healthPingTargets(): string[] {
    const fromEnv = [
      process.env.API_HEALTH_URL,
      process.env.SOCKET_HEALTH_URL,
    ].filter((url): url is string => Boolean(url?.trim()));
    if (fromEnv.length) return fromEnv;
    if (process.env.NODE_ENV !== 'production') return [];
    const appUrl = publicApiBase();
    if (!appUrl) return [];
    return [`${appUrl}/api/health`, `${appUrl}/health`];
  }

  /** Ping public health endpoints (Hostinger / APP_URL). */
  private async pingPublicHealth(): Promise<void> {
    const targets = this.healthPingTargets();
    await Promise.allSettled(
      targets.map(async (url) => {
        try {
          const res = await axios.get(url, {
            timeout: 25_000,
            validateStatus: () => true,
          });
          this.logger.info(
            { url, httpStatus: res.status },
            'Keep-alive health ping',
          );
        } catch (err) {
          this.logger.warn(
            {
              url,
              err: err instanceof Error ? err.message : String(err),
            },
            'Keep-alive health ping failed',
          );
        }
      }),
    );
  }

  private async tick(): Promise<void> {
    if (this.shouldRun('db_cleanup', 3)) {
      await this.runDbCleanupCron();
    }
  }
}
