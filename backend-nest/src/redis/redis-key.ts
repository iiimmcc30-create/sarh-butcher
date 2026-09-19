/** Isolated Redis namespace. Never share SARH keyspace. */
export function butcherRedisKey(key: string): string {
  const prefix = process.env.REDIS_KEY_PREFIX || 'butcherapp:';
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}

export function butcherUserRoom(userId: string): string {
  return butcherRedisKey(`user:${userId}`);
}
