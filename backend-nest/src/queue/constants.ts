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
export function bullRootConfig() {
  return {
    connection: getBullmqSharedConnection(),
    createClient: createBullmqClient,
  };
}

const Q = process.env.REDIS_KEY_PREFIX || 'butcherapp:';

export const QUEUE_NAMES = {
  NOTIFICATIONS: `${Q}notifications`,
  EMAILS: `${Q}emails`,
  PUSH: `${Q}push-notifications`,
  IMAGE_PROCESSING: `${Q}image-processing`,
  // Leftover names for on-disk SARH processors that are not registered.
  FEE_CHECKS: `${Q}fee-checks`,
  SUBSCRIPTIONS: `${Q}subscriptions`,
} as const;
