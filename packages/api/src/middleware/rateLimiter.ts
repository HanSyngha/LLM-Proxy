import { Request, Response, NextFunction } from 'express';
import { TokenAuthenticatedRequest } from './tokenAuth.js';
import { redis, prisma } from '../index.js';
import { todayString, toHourString, toMinuteString } from '../utils/date.js';

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
    cachedDefaults = { rpmLimit: 0, tpmLimit: 0, tphLimit: 0, tpdLimit: 0 };
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
    // 0 = unlimited (skip check)
    const now = Date.now();
    const rpmKey = `rl:rpm:${tokenId}`;
    const oneMinuteAgo = now - 60000;

    // Always clean up old entries for accurate tracking
    await redis.zremrangebyscore(rpmKey, 0, oneMinuteAgo);

    if (rpmLimit > 0) {
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
    }

    // Add this request
    const requestId = `${now}-${Math.random().toString(36).substring(2, 8)}`;
    await redis.zadd(rpmKey, now, requestId);
    await redis.expire(rpmKey, 120); // 2 min TTL

    // TPD check (tokens per day) - 0 = unlimited
    const tpdLimit = req.apiToken.tpdLimit ?? defaults.tpdLimit;
    if (tpdLimit > 0) {
      const today = todayString();
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
    }

    // TPH check (tokens per hour) - 0 = unlimited
    const tphLimit = req.apiToken.tphLimit ?? defaults.tphLimit;
    if (tphLimit > 0) {
      const currentHour = toHourString(new Date());
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
    }

    // TPM check (tokens per minute) - 0 = unlimited
    const tpmLimit = req.apiToken.tpmLimit ?? defaults.tpmLimit;
    if (tpmLimit > 0) {
      const currentMinute = toMinuteString(new Date());
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
    const currentMinute = toMinuteString(new Date());
    const tpmKey = `rl:tpm:${tokenId}:${currentMinute}`;
    await redis.incrby(tpmKey, outputTokens);
    await redis.expire(tpmKey, 120); // 2 min TTL

    // TPH counter
    const currentHour = toHourString(new Date());
    const tphKey = `rl:tph:${tokenId}:${currentHour}`;
    await redis.incrby(tphKey, outputTokens);
    await redis.expire(tphKey, 7200); // 2 hour TTL
  } catch (error) {
    console.error('[RateLimit] Error recording token rate limit:', error);
  }
}
