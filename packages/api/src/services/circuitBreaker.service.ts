import { redis } from '../index.js';

const FAIL_THRESHOLD = 5;
const MAX_COOLDOWN_SEC = 300; // 5 minutes max
const BASE_COOLDOWN_SEC = 30;

function cooldownKey(url: string): string {
  return `cb:cooldown:${url}`;
}
function failsKey(url: string): string {
  return `cb:fails:${url}`;
}

export async function isEndpointAvailable(endpointUrl: string): Promise<boolean> {
  try {
    const cooldownUntil = await redis.get(cooldownKey(endpointUrl));
    if (cooldownUntil) {
      const until = parseInt(cooldownUntil, 10);
      if (Date.now() < until) return false;
      // Cooldown expired, allow one request (half-open)
      await redis.del(cooldownKey(endpointUrl));
    }
    return true;
  } catch {
    return true; // On Redis error, allow the request
  }
}

export async function recordEndpointSuccess(endpointUrl: string): Promise<void> {
  try {
    await redis.del(failsKey(endpointUrl));
    await redis.del(cooldownKey(endpointUrl));
  } catch {
    // Ignore Redis errors
  }
}

export async function recordEndpointFailure(endpointUrl: string): Promise<void> {
  try {
    const fails = await redis.incr(failsKey(endpointUrl));
    await redis.expire(failsKey(endpointUrl), 3600); // Reset after 1 hour of no failures

    if (fails >= FAIL_THRESHOLD) {
      // Calculate exponential backoff cooldown
      const multiplier = Math.min(Math.pow(2, Math.floor(fails / FAIL_THRESHOLD) - 1), MAX_COOLDOWN_SEC / BASE_COOLDOWN_SEC);
      const cooldownMs = BASE_COOLDOWN_SEC * multiplier * 1000;
      const cooldownUntil = Date.now() + cooldownMs;

      await redis.set(cooldownKey(endpointUrl), cooldownUntil.toString(), 'EX', Math.ceil(cooldownMs / 1000) + 10);
      console.log(`[CircuitBreaker] Endpoint ${endpointUrl} in cooldown for ${BASE_COOLDOWN_SEC * multiplier}s (${fails} consecutive failures)`);
    }
  } catch {
    // Ignore Redis errors
  }
}

export async function getEndpointStatus(endpointUrl: string): Promise<{
  isHealthy: boolean;
  consecutiveFails: number;
  cooldownUntil: number | null;
}> {
  try {
    const fails = parseInt(await redis.get(failsKey(endpointUrl)) || '0', 10);
    const cooldownStr = await redis.get(cooldownKey(endpointUrl));
    const cooldownUntil = cooldownStr ? parseInt(cooldownStr, 10) : null;
    const isHealthy = !cooldownUntil || Date.now() >= cooldownUntil;
    return { isHealthy, consecutiveFails: fails, cooldownUntil };
  } catch {
    return { isHealthy: true, consecutiveFails: 0, cooldownUntil: null };
  }
}
