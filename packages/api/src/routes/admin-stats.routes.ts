import { Router, Response } from 'express';
import { prisma, redis } from '../index.js';
import { AuthenticatedRequest } from '../middleware/dashboardAuth.js';
import { getActiveUserCount, getTodayUsage } from '../services/redis.service.js';

export const adminStatsRoutes = Router();

/**
 * Helper: Get date N days ago
 */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Helper: Parse 'days' query parameter
 */
function parseDays(query: Record<string, string | undefined>): number {
  const days = parseInt(query.days || '30', 10);
  return Math.min(365, Math.max(1, days));
}

// ============================================
// Usage Analytics
// ============================================

/**
 * GET /admin/stats/overview - Summary dashboard statistics
 */
adminStatsRoutes.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsers,
      activeTokens,
      todayUsage,
      activeUsers,
      totalModels,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.apiToken.count({ where: { enabled: true } }),
      getTodayUsage(redis),
      getActiveUserCount(redis),
      prisma.model.count({ where: { enabled: true } }),
    ]);

    // Error rate for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalRequests, errorRequests] = await Promise.all([
      prisma.requestLog.count({
        where: { timestamp: { gte: todayStart } },
      }),
      prisma.requestLog.count({
        where: {
          timestamp: { gte: todayStart },
          statusCode: { gte: 400 },
        },
      }),
    ]);

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    res.json({
      totalUsers,
      activeTokens,
      totalModels,
      todayRequests: todayUsage.requests,
      todayInputTokens: todayUsage.inputTokens,
      todayOutputTokens: todayUsage.outputTokens,
      activeUsersLast5Min: activeUsers,
      errorRate: Math.round(errorRate * 100) / 100,
      errorRequests,
      totalRequestsToday: totalRequests,
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

/**
 * GET /admin/stats/daily - Daily usage over N days
 */
adminStatsRoutes.get('/daily', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const dailyStats = await prisma.dailyUsageStat.groupBy({
      by: ['date'],
      where: { date: { gte: since } },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { date: 'asc' },
    });

    const data = dailyStats.map(row => ({
      date: row.date.toISOString().split('T')[0],
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
    }));

    // Compute averages (all days vs business days)
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: since } },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    let allInput = 0, allOutput = 0, allRequests = 0;
    let bizInput = 0, bizOutput = 0, bizRequests = 0, bizDays = 0;

    for (const d of data) {
      allInput += d.inputTokens;
      allOutput += d.outputTokens;
      allRequests += d.requests;

      const dow = new Date(d.date).getDay();
      if (dow !== 0 && dow !== 6 && !holidaySet.has(d.date)) {
        bizInput += d.inputTokens;
        bizOutput += d.outputTokens;
        bizRequests += d.requests;
        bizDays++;
      }
    }

    const totalDays = data.length || 1;
    const bDays = bizDays || 1;

    res.json({
      data,
      days,
      averages: {
        all: {
          avgInputTokens: Math.round(allInput / totalDays),
          avgOutputTokens: Math.round(allOutput / totalDays),
          avgRequests: Math.round(allRequests / totalDays),
          days: totalDays,
        },
        businessDays: {
          avgInputTokens: Math.round(bizInput / bDays),
          avgOutputTokens: Math.round(bizOutput / bDays),
          avgRequests: Math.round(bizRequests / bDays),
          days: bizDays,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

/**
 * GET /admin/stats/by-user - Top 20 users by output tokens
 */
adminStatsRoutes.get('/by-user', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const userStats = await prisma.dailyUsageStat.groupBy({
      by: ['userId'],
      where: { date: { gte: since } },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { _sum: { totalOutputTokens: 'desc' } },
      take: 20,
    });

    // Fetch user details
    const userIds = userStats.map(s => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, loginid: true, username: true, deptname: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const data = userStats.map(row => ({
      userId: row.userId,
      user: userMap.get(row.userId) || null,
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * GET /admin/stats/by-model - Usage breakdown by model
 */
adminStatsRoutes.get('/by-model', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const modelStats = await prisma.dailyUsageStat.groupBy({
      by: ['modelId'],
      where: { date: { gte: since } },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      _avg: { avgLatencyMs: true },
      orderBy: { _sum: { totalOutputTokens: 'desc' } },
    });

    // Fetch model details
    const modelIds = modelStats.map(s => s.modelId);
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true, enabled: true },
    });
    const modelMap = new Map(models.map(m => [m.id, m]));

    const data = modelStats.map(row => ({
      modelId: row.modelId,
      model: modelMap.get(row.modelId) || null,
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
      avgLatencyMs: Math.round(row._avg.avgLatencyMs || 0),
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching model stats:', error);
    res.status(500).json({ error: 'Failed to fetch model stats' });
  }
});

/**
 * GET /admin/stats/by-dept - Usage by department
 */
adminStatsRoutes.get('/by-dept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const deptStats = await prisma.dailyUsageStat.groupBy({
      by: ['deptname'],
      where: { date: { gte: since } },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { _sum: { totalOutputTokens: 'desc' } },
    });

    const data = deptStats.map(row => ({
      deptname: row.deptname || 'Unknown',
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching dept stats:', error);
    res.status(500).json({ error: 'Failed to fetch department stats' });
  }
});

/**
 * GET /admin/stats/by-token - Usage by API token (top 20)
 */
adminStatsRoutes.get('/by-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const tokenStats = await prisma.dailyUsageStat.groupBy({
      by: ['apiTokenId'],
      where: {
        date: { gte: since },
        apiTokenId: { not: null },
      },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { _sum: { totalOutputTokens: 'desc' } },
      take: 20,
    });

    // Fetch token details
    const tokenIds = tokenStats.map(s => s.apiTokenId).filter((id): id is string => id !== null);
    const tokens = await prisma.apiToken.findMany({
      where: { id: { in: tokenIds } },
      select: {
        id: true,
        name: true,
        prefix: true,
        user: { select: { loginid: true, username: true } },
      },
    });
    const tokenMap = new Map(tokens.map(t => [t.id, t]));

    const data = tokenStats.map(row => ({
      apiTokenId: row.apiTokenId,
      token: row.apiTokenId ? tokenMap.get(row.apiTokenId) || null : null,
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching token stats:', error);
    res.status(500).json({ error: 'Failed to fetch token stats' });
  }
});

/**
 * GET /admin/stats/daily-active-users - DAU chart data
 */
adminStatsRoutes.get('/daily-active-users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);
    const excludeHolidays = (req.query as Record<string, string>).excludeHolidays === 'true';

    let distinctDau: Array<{ date: Date; dau: bigint }>;

    if (excludeHolidays) {
      distinctDau = await prisma.$queryRaw<Array<{ date: Date; dau: bigint }>>`
        SELECT date, COUNT(DISTINCT user_id) as dau
        FROM daily_usage_stats
        WHERE date >= ${since}
          AND EXTRACT(DOW FROM date) NOT IN (0, 6)
          AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = daily_usage_stats.date)
        GROUP BY date
        ORDER BY date ASC
      `;
    } else {
      distinctDau = await prisma.$queryRaw<Array<{ date: Date; dau: bigint }>>`
        SELECT date, COUNT(DISTINCT user_id) as dau
        FROM daily_usage_stats
        WHERE date >= ${since}
        GROUP BY date
        ORDER BY date ASC
      `;
    }

    const data = distinctDau.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      activeUsers: Number(row.dau),
    }));

    res.json({ data, days, excludeHolidays });
  } catch (error) {
    console.error('Error fetching DAU stats:', error);
    res.status(500).json({ error: 'Failed to fetch DAU stats' });
  }
});

/**
 * GET /admin/stats/cumulative-users - Cumulative unique users over time
 */
adminStatsRoutes.get('/cumulative-users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const cumulativeData = await prisma.$queryRaw<Array<{ date: Date; cumulative_users: bigint }>>`
      SELECT
        gs.date,
        COUNT(DISTINCT u.id) as cumulative_users
      FROM generate_series(${since}::date, CURRENT_DATE, '1 day'::interval) AS gs(date)
      LEFT JOIN users u ON u.first_seen::date <= gs.date
      GROUP BY gs.date
      ORDER BY gs.date ASC
    `;

    const data = cumulativeData.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      totalUsers: Number(row.cumulative_users),
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching cumulative users:', error);
    res.status(500).json({ error: 'Failed to fetch cumulative users' });
  }
});

/**
 * GET /admin/stats/model-daily-trend - Per-model daily trend lines
 */
adminStatsRoutes.get('/model-daily-trend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseDays(req.query as Record<string, string | undefined>);
    const since = daysAgo(days);

    const trendData = await prisma.dailyUsageStat.groupBy({
      by: ['date', 'modelId'],
      where: { date: { gte: since } },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { date: 'asc' },
    });

    // Fetch model names
    const modelIds = [...new Set(trendData.map(r => r.modelId))];
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true },
    });
    const modelMap = new Map(models.map(m => [m.id, m]));

    const data = trendData.map(row => ({
      date: row.date.toISOString().split('T')[0],
      modelId: row.modelId,
      modelName: modelMap.get(row.modelId)?.displayName || modelMap.get(row.modelId)?.name || 'Unknown',
      requests: row._sum.requestCount || 0,
      inputTokens: row._sum.totalInputTokens || 0,
      outputTokens: row._sum.totalOutputTokens || 0,
    }));

    res.json({ data, days });
  } catch (error) {
    console.error('Error fetching model daily trend:', error);
    res.status(500).json({ error: 'Failed to fetch model daily trend' });
  }
});

/**
 * GET /admin/stats/latency - Current latency stats per model
 */
adminStatsRoutes.get('/latency', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Last 1 hour of latency data from UsageLog
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const latencyStats = await prisma.usageLog.groupBy({
      by: ['modelId'],
      where: {
        timestamp: { gte: oneHourAgo },
        latencyMs: { not: null },
      },
      _avg: { latencyMs: true },
      _min: { latencyMs: true },
      _max: { latencyMs: true },
      _count: { id: true },
    });

    // Fetch model names
    const modelIds = latencyStats.map(s => s.modelId);
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true },
    });
    const modelMap = new Map(models.map(m => [m.id, m]));

    // Calculate p50/p95 using raw query
    const percentiles = await prisma.$queryRaw<
      Array<{ model_id: string; p50: number; p95: number }>
    >`
      SELECT
        model_id,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
      FROM usage_logs
      WHERE timestamp >= ${oneHourAgo} AND latency_ms IS NOT NULL
      GROUP BY model_id
    `;
    const percMap = new Map(percentiles.map(p => [p.model_id, p]));

    const data = latencyStats.map(row => {
      const perc = percMap.get(row.modelId);
      return {
        modelId: row.modelId,
        modelName: modelMap.get(row.modelId)?.displayName || modelMap.get(row.modelId)?.name || 'Unknown',
        avgLatencyMs: Math.round(row._avg.latencyMs || 0),
        minLatencyMs: row._min.latencyMs || 0,
        maxLatencyMs: row._max.latencyMs || 0,
        p50LatencyMs: perc ? Math.round(perc.p50) : null,
        p95LatencyMs: perc ? Math.round(perc.p95) : null,
        requestCount: row._count.id,
      };
    });

    res.json({ data, periodMinutes: 60 });
  } catch (error) {
    console.error('Error fetching latency stats:', error);
    res.status(500).json({ error: 'Failed to fetch latency stats' });
  }
});

/**
 * GET /admin/stats/latency/history - Latency history over hours
 */
adminStatsRoutes.get('/latency/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const hours = Math.min(72, Math.max(1, parseInt((req.query as Record<string, string>).hours || '24', 10)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const latencyHistory = await prisma.$queryRaw<
      Array<{
        hour: Date;
        model_id: string;
        avg_latency: number;
        p50_latency: number;
        p95_latency: number;
        request_count: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('hour', timestamp) AS hour,
        model_id,
        AVG(latency_ms) AS avg_latency,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency,
        COUNT(*) AS request_count
      FROM usage_logs
      WHERE timestamp >= ${since} AND latency_ms IS NOT NULL
      GROUP BY DATE_TRUNC('hour', timestamp), model_id
      ORDER BY hour ASC
    `;

    // Fetch model names
    const modelIds = [...new Set(latencyHistory.map(r => r.model_id))];
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true },
    });
    const modelMap = new Map(models.map(m => [m.id, m]));

    const data = latencyHistory.map(row => ({
      hour: row.hour.toISOString(),
      modelId: row.model_id,
      modelName: modelMap.get(row.model_id)?.displayName || modelMap.get(row.model_id)?.name || 'Unknown',
      avgLatencyMs: Math.round(row.avg_latency),
      p50LatencyMs: Math.round(row.p50_latency),
      p95LatencyMs: Math.round(row.p95_latency),
      requestCount: Number(row.request_count),
    }));

    res.json({ data, hours });
  } catch (error) {
    console.error('Error fetching latency history:', error);
    res.status(500).json({ error: 'Failed to fetch latency history' });
  }
});
