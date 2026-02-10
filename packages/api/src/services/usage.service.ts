import { prisma, redis } from '../index.js';
import { incrementUsage, trackActiveUser, getMonthlyOutputTokens, incrementMonthlyOutputTokens } from './redis.service.js';

export async function recordUsage(params: {
  userId: string;
  loginid: string;
  modelId: string;
  apiTokenId: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  deptname: string;
  businessUnit: string | null;
}): Promise<void> {
  const { userId, loginid, modelId, apiTokenId, inputTokens, outputTokens, latencyMs, deptname, businessUnit } = params;
  const totalTokens = inputTokens + outputTokens;

  // 1. Create UsageLog
  await prisma.usageLog.create({
    data: { userId, modelId, apiTokenId, inputTokens, outputTokens, totalTokens, latencyMs, deptname, businessUnit },
  });

  // 2. Upsert DailyUsageStat
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use nullish coalescing (??) to correctly handle latencyMs=0 vs undefined/null
  const latencyValue = latencyMs ?? null;
  const latencyForCalc = latencyMs ?? 0;

  if (apiTokenId) {
    // Non-null apiTokenId: ON CONFLICT works correctly
    await prisma.$executeRaw`
      INSERT INTO daily_usage_stats (id, date, user_id, model_id, api_token_id, deptname, total_input_tokens, total_output_tokens, request_count, avg_latency_ms)
      VALUES (gen_random_uuid(), ${today}::date, ${userId}, ${modelId}, ${apiTokenId}, ${deptname}, ${inputTokens}, ${outputTokens}, 1, ${latencyValue})
      ON CONFLICT (date, user_id, model_id, api_token_id)
      DO UPDATE SET
        total_input_tokens = daily_usage_stats.total_input_tokens + ${inputTokens},
        total_output_tokens = daily_usage_stats.total_output_tokens + ${outputTokens},
        request_count = daily_usage_stats.request_count + 1,
        avg_latency_ms = CASE
          WHEN ${latencyValue}::int IS NOT NULL THEN
            (COALESCE(daily_usage_stats.avg_latency_ms, 0) * (daily_usage_stats.request_count) + ${latencyForCalc}) / (daily_usage_stats.request_count + 1)
          ELSE daily_usage_stats.avg_latency_ms
        END
    `;
  } else {
    // NULL apiTokenId: ON CONFLICT won't match NULLs, use UPDATE + INSERT approach
    const updated = await prisma.$executeRaw`
      UPDATE daily_usage_stats SET
        total_input_tokens = daily_usage_stats.total_input_tokens + ${inputTokens},
        total_output_tokens = daily_usage_stats.total_output_tokens + ${outputTokens},
        request_count = daily_usage_stats.request_count + 1,
        avg_latency_ms = CASE
          WHEN ${latencyValue}::int IS NOT NULL THEN
            (COALESCE(daily_usage_stats.avg_latency_ms, 0) * (daily_usage_stats.request_count) + ${latencyForCalc}) / (daily_usage_stats.request_count + 1)
          ELSE daily_usage_stats.avg_latency_ms
        END
      WHERE date = ${today}::date AND user_id = ${userId} AND model_id = ${modelId} AND api_token_id IS NULL
    `;
    if (updated === 0) {
      await prisma.$executeRaw`
        INSERT INTO daily_usage_stats (id, date, user_id, model_id, api_token_id, deptname, total_input_tokens, total_output_tokens, request_count, avg_latency_ms)
        VALUES (gen_random_uuid(), ${today}::date, ${userId}, ${modelId}, NULL, ${deptname}, ${inputTokens}, ${outputTokens}, 1, ${latencyValue})
      `;
    }
  }

  // 3. Redis counters
  await incrementUsage(redis, userId, modelId, apiTokenId, inputTokens, outputTokens);

  // 4. Monthly budget tracking
  if (outputTokens > 0) {
    await incrementMonthlyOutputTokens(redis, 'user', userId, outputTokens);
    if (apiTokenId) {
      await incrementMonthlyOutputTokens(redis, 'token', apiTokenId, outputTokens);
    }
    // Track department usage
    if (deptname) {
      await incrementMonthlyOutputTokens(redis, 'dept', deptname, outputTokens);
    }
  }

  // 5. Track active user
  await trackActiveUser(redis, loginid);

  console.log(`[Usage] user=${loginid} model=${modelId} token=${apiTokenId ?? 'none'} tokens=${totalTokens} (in=${inputTokens}, out=${outputTokens}) latency=${latencyMs ?? 'N/A'}ms`);
}

export async function checkBudget(userId: string, tokenId: string | null, deptname?: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // Check department budget
  if (deptname) {
    const deptBudget = await prisma.deptBudget.findUnique({
      where: { deptname },
      select: { monthlyOutputTokenBudget: true, enabled: true },
    });
    if (deptBudget?.enabled && deptBudget.monthlyOutputTokenBudget) {
      const used = await getMonthlyOutputTokens(redis, 'dept', deptname);
      if (used >= deptBudget.monthlyOutputTokenBudget) {
        return { allowed: false, reason: `Department "${deptname}" monthly output token limit exceeded (${used}/${deptBudget.monthlyOutputTokenBudget})` };
      }
    }
  }

  // Check user budget
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { monthlyOutputTokenBudget: true } });
  if (user?.monthlyOutputTokenBudget) {
    const used = await getMonthlyOutputTokens(redis, 'user', userId);
    if (used >= user.monthlyOutputTokenBudget) {
      return { allowed: false, reason: `User monthly output token limit exceeded (${used}/${user.monthlyOutputTokenBudget})` };
    }
  }

  // Check token budget
  if (tokenId) {
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId }, select: { monthlyOutputTokenBudget: true } });
    if (token?.monthlyOutputTokenBudget) {
      const used = await getMonthlyOutputTokens(redis, 'token', tokenId);
      if (used >= token.monthlyOutputTokenBudget) {
        return { allowed: false, reason: `API key monthly output token limit exceeded (${used}/${token.monthlyOutputTokenBudget})` };
      }
    }
  }

  return { allowed: true };
}
