/**
 * My Usage Routes
 *
 * 개인 사용량 통계 조회 (Dashboard 사용자용)
 * - 요약 (오늘/이번 주/이번 달)
 * - 일별 사용량 차트 데이터
 * - 모델별 사용량 분석
 * - 토큰별 사용량 분석
 * - 최근 요청 목록
 * - 예산 잔여량
 */

import { Router } from 'express';
import { prisma, redis } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/dashboardAuth.js';
import { getMonthlyOutputTokens } from '../services/redis.service.js';

export const myUsageRoutes = Router();

// 모든 라우트에 인증 적용
myUsageRoutes.use(authenticateToken);

/**
 * GET /my-usage/summary
 * 내 사용량 요약 (오늘, 이번 주, 이번 달) + 예산 정보
 */
myUsageRoutes.get('/summary', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 오늘 사용량
    const todayUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: todayStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 이번 주 사용량
    const weekUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: weekStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 이번 달 사용량
    const monthUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: monthStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 예산 정보
    const monthlyBudget = user.monthlyOutputTokenBudget;
    const monthlyUsed = await getMonthlyOutputTokens(redis, 'user', user.id);

    res.json({
      today: {
        requests: todayUsage._count,
        inputTokens: todayUsage._sum?.inputTokens ?? 0,
        outputTokens: todayUsage._sum?.outputTokens ?? 0,
        totalTokens: todayUsage._sum?.totalTokens ?? 0,
      },
      week: {
        requests: weekUsage._count,
        inputTokens: weekUsage._sum?.inputTokens ?? 0,
        outputTokens: weekUsage._sum?.outputTokens ?? 0,
        totalTokens: weekUsage._sum?.totalTokens ?? 0,
      },
      month: {
        requests: monthUsage._count,
        inputTokens: monthUsage._sum?.inputTokens ?? 0,
        outputTokens: monthUsage._sum?.outputTokens ?? 0,
        totalTokens: monthUsage._sum?.totalTokens ?? 0,
      },
      budget: {
        monthlyOutputTokenBudget: monthlyBudget,
        monthlyOutputTokensUsed: monthlyUsed,
        remaining: monthlyBudget ? Math.max(0, monthlyBudget - monthlyUsed) : null,
      },
    });
  } catch (error) {
    console.error('Get my usage summary error:', error);
    res.status(500).json({ error: 'Failed to get usage summary' });
  }
});

/**
 * GET /my-usage/daily
 * 내 일별 사용량 (최근 N일)
 * Query: ?days=30
 */
myUsageRoutes.get('/daily', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const days = Math.min(Math.max(parseInt(req.query['days'] as string) || 30, 1), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyStats: Array<{
      date: Date;
      requests: bigint;
      input_tokens: bigint;
      output_tokens: bigint;
      total_tokens: bigint;
    }> = await prisma.$queryRaw`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as requests,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens
      FROM usage_logs
      WHERE user_id = ${user.id}
        AND timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    const stats = dailyStats.map(row => ({
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      requests: Number(row.requests),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      totalTokens: Number(row.total_tokens),
    }));

    res.json({ stats });
  } catch (error) {
    console.error('Get my daily usage error:', error);
    res.status(500).json({ error: 'Failed to get daily usage' });
  }
});

/**
 * GET /my-usage/by-model
 * 내 모델별 사용량 분석
 * Query: ?days=30
 */
myUsageRoutes.get('/by-model', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const days = Math.min(Math.max(parseInt(req.query['days'] as string) || 30, 1), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await prisma.usageLog.groupBy({
      by: ['modelId'],
      where: {
        userId: user.id,
        timestamp: { gte: startDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
      _avg: {
        latencyMs: true,
      },
    });

    // 모델 이름 조회
    const modelIds = usage.map(u => u.modelId);
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true },
    });

    const modelMap = new Map(models.map(m => [m.id, m]));

    const result = usage.map(u => ({
      modelId: u.modelId,
      modelName: modelMap.get(u.modelId)?.name || u.modelId,
      modelDisplayName: modelMap.get(u.modelId)?.displayName || u.modelId,
      requests: u._count,
      inputTokens: u._sum?.inputTokens ?? 0,
      outputTokens: u._sum?.outputTokens ?? 0,
      totalTokens: u._sum?.totalTokens ?? 0,
      avgLatencyMs: u._avg?.latencyMs ? Math.round(u._avg.latencyMs) : null,
    }));

    // Sort by total tokens descending
    result.sort((a, b) => b.totalTokens - a.totalTokens);

    res.json({ usage: result });
  } catch (error) {
    console.error('Get my usage by model error:', error);
    res.status(500).json({ error: 'Failed to get usage by model' });
  }
});

/**
 * GET /my-usage/by-token
 * 내 API 토큰별 사용량 분석
 * Query: ?days=30
 */
myUsageRoutes.get('/by-token', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const days = Math.min(Math.max(parseInt(req.query['days'] as string) || 30, 1), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await prisma.usageLog.groupBy({
      by: ['apiTokenId'],
      where: {
        userId: user.id,
        timestamp: { gte: startDate },
        apiTokenId: { not: null },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
      _avg: {
        latencyMs: true,
      },
    });

    // 토큰 이름 조회
    const tokenIds = usage.map(u => u.apiTokenId).filter(Boolean) as string[];
    const tokens = await prisma.apiToken.findMany({
      where: { id: { in: tokenIds } },
      select: { id: true, name: true, prefix: true },
    });

    const tokenMap = new Map(tokens.map(t => [t.id, t]));

    const result = usage.map(u => ({
      tokenId: u.apiTokenId,
      tokenName: tokenMap.get(u.apiTokenId!)?.name || 'Unknown',
      tokenPrefix: tokenMap.get(u.apiTokenId!)?.prefix || '',
      requests: u._count,
      inputTokens: u._sum?.inputTokens ?? 0,
      outputTokens: u._sum?.outputTokens ?? 0,
      totalTokens: u._sum?.totalTokens ?? 0,
      avgLatencyMs: u._avg?.latencyMs ? Math.round(u._avg.latencyMs) : null,
    }));

    // Sort by total tokens descending
    result.sort((a, b) => b.totalTokens - a.totalTokens);

    res.json({ usage: result });
  } catch (error) {
    console.error('Get my usage by token error:', error);
    res.status(500).json({ error: 'Failed to get usage by token' });
  }
});

/**
 * GET /my-usage/recent
 * 내 최근 요청 목록
 * Query: ?limit=50&offset=0
 */
myUsageRoutes.get('/recent', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query['limit'] as string) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string) || 0, 0);

    const whereClause = { userId: user.id };

    const [logs, total] = await Promise.all([
      prisma.usageLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          model: {
            select: { name: true, displayName: true },
          },
          apiToken: {
            select: { id: true, name: true, prefix: true },
          },
        },
      }),
      prisma.usageLog.count({ where: whereClause }),
    ]);

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        modelName: log.model.displayName,
        tokenName: log.apiToken?.name || null,
        tokenPrefix: log.apiToken?.prefix || null,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        latencyMs: log.latencyMs,
        timestamp: log.timestamp,
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get my recent usage error:', error);
    res.status(500).json({ error: 'Failed to get recent usage' });
  }
});

/**
 * GET /my-usage/budget
 * 내 예산 잔여량 (사용자 + 토큰별)
 */
myUsageRoutes.get('/budget', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // User-level budget
    const userMonthlyBudget = user.monthlyOutputTokenBudget;
    const userMonthlyUsed = await getMonthlyOutputTokens(redis, 'user', user.id);

    // Per-token budgets
    const tokens = await prisma.apiToken.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        monthlyOutputTokenBudget: true,
        enabled: true,
      },
    });

    const tokenBudgets = await Promise.all(
      tokens.map(async (token) => {
        const used = await getMonthlyOutputTokens(redis, 'token', token.id);
        return {
          tokenId: token.id,
          tokenName: token.name,
          tokenPrefix: token.prefix,
          enabled: token.enabled,
          monthlyOutputTokenBudget: token.monthlyOutputTokenBudget,
          monthlyOutputTokensUsed: used,
          remaining: token.monthlyOutputTokenBudget
            ? Math.max(0, token.monthlyOutputTokenBudget - used)
            : null,
        };
      })
    );

    res.json({
      user: {
        monthlyOutputTokenBudget: userMonthlyBudget,
        monthlyOutputTokensUsed: userMonthlyUsed,
        remaining: userMonthlyBudget
          ? Math.max(0, userMonthlyBudget - userMonthlyUsed)
          : null,
      },
      tokens: tokenBudgets,
    });
  } catch (error) {
    console.error('Get my budget error:', error);
    res.status(500).json({ error: 'Failed to get budget info' });
  }
});
