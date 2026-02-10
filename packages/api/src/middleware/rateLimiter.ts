import { Response, NextFunction } from 'express';
import { TokenAuthenticatedRequest } from './tokenAuth.js';
import { redis, prisma } from '../index.js';
import { todayString, toHourString, toMinuteString } from '../utils/date.js';

// ---- Global default config cache ----
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
    cachedDefaults = { rpmLimit: 0, tpmLimit: 0, tphLimit: 0, tpdLimit: 0 };
    defaultsCachedAt = Date.now();
  }
  return cachedDefaults;
}

// ---- Dept budget cache (per deptname, 1 minute TTL) ----
const deptCache = new Map<string, { data: { rpmLimit: number | null; tpmLimit: number | null; tphLimit: number | null; tpdLimit: number | null; enabled: boolean } | null; cachedAt: number }>();
const DEPT_CACHE_TTL = 60000;

async function getDeptLimits(deptname: string) {
  const cached = deptCache.get(deptname);
  if (cached && Date.now() - cached.cachedAt < DEPT_CACHE_TTL) return cached.data;
  const budget = await prisma.deptBudget.findUnique({
    where: { deptname },
    select: { rpmLimit: true, tpmLimit: true, tphLimit: true, tpdLimit: true, enabled: true },
  });
  deptCache.set(deptname, { data: budget, cachedAt: Date.now() });
  return budget;
}

/**
 * Resolve effective limit.
 * Priority: token override > dept override > global default
 * null = not set (fall through), 0 = unlimited, >0 = limited
 */
function resolveLimit(tokenVal: number | null, deptVal: number | null | undefined, globalVal: number): number {
  // Token-level explicit setting (0 = unlimited, >0 = limited)
  if (tokenVal !== null) return tokenVal;
  // Dept-level explicit setting
  if (deptVal !== null && deptVal !== undefined) return deptVal;
  // Global default
  return globalVal;
}

export async function checkRateLimit(req: TokenAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.apiToken) { next(); return; }

  const tokenId = req.apiToken.id;
  const deptname = req.user?.deptname;
  const defaults = await getDefaults();

  // Load dept limits if user has a department
  const deptLimits = deptname ? await getDeptLimits(deptname) : null;
  const deptEnabled = deptLimits?.enabled !== false; // default true if no dept config

  const rpmLimit = resolveLimit(req.apiToken.rpmLimit, deptEnabled ? deptLimits?.rpmLimit : undefined, defaults.rpmLimit);
  const tpdLimit = resolveLimit(req.apiToken.tpdLimit, deptEnabled ? deptLimits?.tpdLimit : undefined, defaults.tpdLimit);
  const tphLimit = resolveLimit(req.apiToken.tphLimit, deptEnabled ? deptLimits?.tphLimit : undefined, defaults.tphLimit);
  const tpmLimit = resolveLimit(req.apiToken.tpmLimit, deptEnabled ? deptLimits?.tpmLimit : undefined, defaults.tpmLimit);

  try {
    // ---- RPM check (requests per minute) ----
    // 0 = unlimited (skip check)
    const now = Date.now();
    const rpmKey = `rl:rpm:${tokenId}`;
    const oneMinuteAgo = now - 60000;

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
    await redis.expire(rpmKey, 120);

    // ---- TPD check (tokens per day) ----
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

    // ---- TPH check (tokens per hour) ----
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

    // ---- TPM check (tokens per minute) ----
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
    await redis.expire(tpmKey, 120);

    // TPH counter
    const currentHour = toHourString(new Date());
    const tphKey = `rl:tph:${tokenId}:${currentHour}`;
    await redis.incrby(tphKey, outputTokens);
    await redis.expire(tphKey, 7200);
  } catch (error) {
    console.error('[RateLimit] Error recording token rate limit:', error);
  }
}
