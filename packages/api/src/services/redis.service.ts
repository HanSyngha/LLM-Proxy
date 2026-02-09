import { Redis } from 'ioredis';

export function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
  });

  client.on('error', (err: Error) => console.error('Redis Client Error:', err));
  client.on('connect', () => console.log('Redis Client Connected'));

  return client;
}

export async function getActiveUserCount(redis: Redis): Promise<number> {
  const key = 'active_users';
  await redis.zremrangebyscore(key, 0, Date.now() - 5 * 60 * 1000);
  return redis.zcard(key);
}

export async function trackActiveUser(redis: Redis, userId: string): Promise<void> {
  await redis.zadd('active_users', Date.now(), userId);
}

export async function getTodayUsage(redis: Redis): Promise<{
  requests: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const data = await redis.hgetall(`daily_usage:${today}`);
  return {
    requests: parseInt(data['requests'] || '0', 10),
    inputTokens: parseInt(data['inputTokens'] || '0', 10),
    outputTokens: parseInt(data['outputTokens'] || '0', 10),
  };
}

export async function incrementUsage(
  redis: Redis,
  userId: string,
  modelId: string,
  tokenId: string | null,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `daily_usage:${today}`;
  const userKey = `user_usage:${userId}:${today}`;
  const modelKey = `model_usage:${modelId}:${today}`;
  const ttl = 7 * 24 * 60 * 60;

  const pipeline = redis.pipeline();

  // Daily total
  pipeline.hincrby(dailyKey, 'requests', 1);
  pipeline.hincrby(dailyKey, 'inputTokens', inputTokens);
  pipeline.hincrby(dailyKey, 'outputTokens', outputTokens);
  pipeline.expire(dailyKey, ttl);

  // Per user
  pipeline.hincrby(userKey, 'requests', 1);
  pipeline.hincrby(userKey, 'outputTokens', outputTokens);
  pipeline.expire(userKey, ttl);

  // Per model
  pipeline.hincrby(modelKey, 'requests', 1);
  pipeline.hincrby(modelKey, 'outputTokens', outputTokens);
  pipeline.expire(modelKey, ttl);

  // Per token
  if (tokenId) {
    const tokenKey = `token_usage:${tokenId}:${today}`;
    pipeline.hincrby(tokenKey, 'requests', 1);
    pipeline.hincrby(tokenKey, 'inputTokens', inputTokens);
    pipeline.hincrby(tokenKey, 'outputTokens', outputTokens);
    pipeline.expire(tokenKey, ttl);
  }

  await pipeline.exec();
}

export async function getMonthlyOutputTokens(
  redis: Redis,
  entityType: 'user' | 'token',
  entityId: string
): Promise<number> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `budget:monthly:${entityType}:${entityId}:${yearMonth}`;
  const val = await redis.get(key);
  return parseInt(val || '0', 10);
}

export async function incrementMonthlyOutputTokens(
  redis: Redis,
  entityType: 'user' | 'token',
  entityId: string,
  tokens: number
): Promise<number> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `budget:monthly:${entityType}:${entityId}:${yearMonth}`;
  const newVal = await redis.incrby(key, tokens);
  // Expire at end of next month (safe buffer)
  await redis.expire(key, 62 * 24 * 60 * 60);
  return newVal;
}
