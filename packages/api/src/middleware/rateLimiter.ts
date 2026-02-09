import { Request, Response, NextFunction } from 'express';
import { TokenAuthenticatedRequest } from './tokenAuth.js';
import { redis, prisma } from '../index.js';

let cachedDefaults: { rpmLimit: number; tpmLimit: number; tphLimit: number; tpdLimit: number } | null = null;
let defaultsCachedAt = 0;
const DEFAULTS_CACHE_TTL = 60000; // 1 minute

async function getDefaults() {
  if (cachedDefaults && Date.now() - defaultsCachedAt < DEFAULTS_CACHE_TTL) return cachedDefaults;
  const config = await prisma.rateLimitConfig.findUnique({ where: { key: 'default' } });
  if (config) {
    cachedDefaults = { rpmLimit: config.rpmLimit, tpmLimit: config.tpmLimit, tphLimit: config.tphLimit, tpdLimit: config.tpdLimit };
    defaultsCachedAt = Date.now();
  } else {
    // Cache the fallback too, to avoid repeated DB queries
    cachedDefaults = { rpmLimit: 60, tpmLimit: 100000, tphLimit: 1000000, tpdLimit: 10000000 };
    defaultsCachedAt = Date.now();
  }
  return cachedDefaults;
}

export async function checkRateLimit(req: TokenAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.apiToken) { next(); return; }

  const tokenId = req.apiToken.id;
  const defaults = await getDefaults();
  const rpmLimit = req.apiToken.rpmLimit ?? defaults.rpmLimit;

  try {
    // Check RPM (requests per minute) using sorted set sliding window
    const now = Date.now();
    const rpmKey = `rl:rpm:${tokenId}`;
    const oneMinuteAgo = now - 60000;

    // Remove old entries and count
    await redis.zremrangebyscore(rpmKey, 0, oneMinuteAgo);
    const currentRpm = await redis.zcard(rpmKey);

    if (currentRpm >= rpmLimit) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        error: {
          type: 'rate_limit_exceeded',
          message: `Rate limit exceeded: ${currentRpm}/${rpmLimit} requests per minute`,
          param: 'rpm',
        },
      });
      return;
    }

    // Add this request
    const requestId = `${now}-${Math.random().toString(36).substring(2, 8)}`;
    await redis.zadd(rpmKey, now, requestId);
    await redis.expire(rpmKey, 120); // 2 min TTL

    // TPD check (tokens per day) - pre-check with current counts
    const tpdLimit = req.apiToken.tpdLimit ?? defaults.tpdLimit;
    const today = new Date().toISOString().split('T')[0];
    const tpdKey = `token_usage:${tokenId}:${today}`;
    const todayData = await redis.hgetall(tpdKey);
    const todayOutputTokens = parseInt(todayData['outputTokens'] || '0', 10);

    if (todayOutputTokens >= tpdLimit) {
      res.setHeader('Retry-After', '3600');
      res.status(429).json({
        error: {
          type: 'rate_limit_exceeded',
          message: `Daily token limit exceeded: ${todayOutputTokens}/${tpdLimit} output tokens per day`,
          param: 'tpd',
        },
      });
      return;
    }

    // TPH check (tokens per hour)
    const tphLimit = req.apiToken.tphLimit ?? defaults.tphLimit;
    const currentHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const tphKey = `rl:tph:${tokenId}:${currentHour}`;
    const currentTph = parseInt(await redis.get(tphKey) || '0', 10);

    if (currentTph >= tphLimit) {
      res.setHeader('Retry-After', '600');
      res.status(429).json({
        error: {
          type: 'rate_limit_exceeded',
          message: `Hourly token limit exceeded: ${currentTph}/${tphLimit} output tokens per hour`,
          param: 'tph',
        },
      });
      return;
    }

    // TPM check (tokens per minute)
    const tpmLimit = req.apiToken.tpmLimit ?? defaults.tpmLimit;
    const currentMinute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    const tpmKey = `rl:tpm:${tokenId}:${currentMinute}`;
    const currentTpm = parseInt(await redis.get(tpmKey) || '0', 10);

    if (currentTpm >= tpmLimit) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({
        error: {
          type: 'rate_limit_exceeded',
          message: `Per-minute token limit exceeded: ${currentTpm}/${tpmLimit} output tokens per minute`,
          param: 'tpm',
        },
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    next(); // On error, allow the request
  }
}

/**
 * Post-response: record token usage for TPM/TPH counters.
 * Call this after a successful proxy response with output token counts.
 */
export async function recordTokenRateLimit(tokenId: string, outputTokens: number): Promise<void> {
  if (outputTokens <= 0) return;

  try {
    // TPM counter
    const currentMinute = new Date().toISOString().slice(0, 16);
    const tpmKey = `rl:tpm:${tokenId}:${currentMinute}`;
    await redis.incrby(tpmKey, outputTokens);
    await redis.expire(tpmKey, 120); // 2 min TTL

    // TPH counter
    const currentHour = new Date().toISOString().slice(0, 13);
    const tphKey = `rl:tph:${tokenId}:${currentHour}`;
    await redis.incrby(tphKey, outputTokens);
    await redis.expire(tphKey, 7200); // 2 hour TTL
  } catch (error) {
    console.error('[RateLimit] Error recording token rate limit:', error);
  }
}
