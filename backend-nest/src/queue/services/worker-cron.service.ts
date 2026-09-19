import { Injectable, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { LoggerService } from '../../common/services/logger.service';
import { WorkerCronRepository } from '../repositories/worker-cron.repository';
import { RedisCacheService } from '../../redis/services/redis-cache.service';
import { FeeCheckQueueService } from './fee-check-queue.service';
import { SubscriptionQueueService } from './subscription-queue.service';
import { KnowledgeCenterService } from '../../knowledge/services/knowledge-center.service';
import { DaftraService } from '../../integrations/daftra/daftra.service';
import { cronCleanupAuthHeader } from '../../admin/lib/cron-auth';

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
    private readonly feeCheckQueue: FeeCheckQueueService,
    private readonly subscriptionQueue: SubscriptionQueueService,
    private readonly knowledge: KnowledgeCenterService,
    private readonly daftra: DaftraService,
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
    // Kick an initial delayed sync so knowledge starts without waiting a full hour
    setTimeout(() => void this.runKnowledgeSyncCron(), 20_000);
    setTimeout(() => void this.pingPublicHealth(), 15_000);
    // First Daftra product poll shortly after boot (then every 10 minutes)
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

  private async runFeeCheckCron(): Promise<void> {
    if (!this.cache.isEnabled()) return;

    const lockKey = 'cron:fee_check:lock';
    const lockTTL = 120;

    try {
      const redis = this.cache.getClient();
      const acquired = await redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
      if (!acquired) {
        this.logger.debug(
          {},
          'Fee check cron: lock not acquired, another worker is running it',
        );
        return;
      }

      this.logger.info(
        {},
        'Listing fee cron: no overdue enforcement (covenant-only 14-day settlement)',
      );
    } catch (err) {
      this.logger.error({ err }, 'Fee check cron error');
    }
  }

  private async runDbCleanupCron(): Promise<void> {
    const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    if (
      process.env.NODE_ENV === 'production' &&
      /localhost|127\.0\.0\.1/i.test(appUrl)
    ) {
      this.logger.warn(
        {},
        'APP_URL points at localhost in production — cleanup will not reach the API',
      );
    }
    await this.withLock('cron:db_cleanup:lock', 300, async () => {
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

  private async runSubscriptionCron(): Promise<void> {
    await this.withLock('cron:subscription:lock', 300, async () => {
      this.logger.info({}, 'Running subscription maintenance cron');
      await Promise.all([
        this.subscriptionQueue.addSubscriptionJob({ kind: 'expire' }),
        this.subscriptionQueue.addSubscriptionJob({ kind: 'reminders' }),
      ]);
    });
  }

  private async runWeeklyLiveMinutesReset(): Promise<void> {
    await this.withLock('cron:subscription:weekly_reset', 300, async () => {
      await this.subscriptionQueue.addSubscriptionJob({
        kind: 'reset_live_minutes',
      });
    });
  }

  private async runKnowledgeSyncCron(): Promise<void> {
    const run = async () => {
      this.logger.info({}, 'Running knowledge center hourly sync');
      await this.knowledge.syncAll();
    };

    if (!this.cache.isEnabled()) {
      try {
        await run();
      } catch (err) {
        this.logger.error({ err }, 'Knowledge sync cron error');
      }
      return;
    }

    await this.withLock('cron:knowledge_sync:lock', 50 * 60, run);
  }

  /**
   * Poll Daftra → Sarh products for every CONNECTED butcher.
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

    const lockKey = `cron:daftra_products:${butcherId}`;
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
    // Hostinger production defaults (never Render cold-start keep-alive).
    const appUrl = (process.env.APP_URL || 'https://sarhsa.online').replace(
      /\/$/,
      '',
    );
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
    if (this.shouldRun('fee_check', 9)) {
      await this.runFeeCheckCron();
    }
    if (this.shouldRun('db_cleanup', 3)) {
      await this.runDbCleanupCron();
    }
    if (this.shouldRun('subscription', 6)) {
      await this.runSubscriptionCron();
    }
    const now = new Date();
    if (now.getDay() === 1 && this.shouldRun('subscription_weekly', 4)) {
      await this.runWeeklyLiveMinutesReset();
    }

    // Knowledge Center: every hourly tick
    await this.runKnowledgeSyncCron();
  }
}
