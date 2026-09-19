import {
  createBullmqClient,
  getBullmqSharedConnection,
} from '../redis/redis-connection';

export const isRedisEnabled = () => process.env.REDIS_ENABLED !== 'false';

/**
 * Shared BullMQ root config. Queues reuse one ioredis command client via
 * `createClient`. Subscriber is shared; blocking clients are duplicated.
 * Connection is created lazily so importing this module does not open Redis.
 */
export function bullmqPrefix(): string {
  const raw = process.env.REDIS_KEY_PREFIX || 'butcherapp:';
  return raw.replace(/:+$/, '') || 'butcherapp';
}

export function bullRootConfig() {
  return {
    connection: getBullmqSharedConnection(),
    createClient: createBullmqClient,
    // BullMQ forbids ":" in the queue *name*. Isolation lives in the prefix
    // so Redis keys stay butcherapp:<queue>:… and never share SARH bull:* keys.
    prefix: bullmqPrefix(),
  };
}

export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  PUSH: 'push-notifications',
  IMAGE_PROCESSING: 'image-processing',
  // Leftover names for on-disk SARH processors that are not registered.
  FEE_CHECKS: 'fee-checks',
  SUBSCRIPTIONS: 'subscriptions',
} as const;
