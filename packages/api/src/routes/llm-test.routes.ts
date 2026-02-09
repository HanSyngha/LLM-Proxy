/**
 * LLM Test Routes
 *
 * LLM 테스트 쌍 관리 및 테스트 실행 API
 * 실행 로직은 llm-test.service.ts에 위임
 */

import { Router, RequestHandler } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, requireAdmin, requireWriteAccess } from '../middleware/dashboardAuth.js';
import { runTestAndSave } from '../services/llm-test.service.js';
import { z } from 'zod';

export const llmTestRoutes = Router();

llmTestRoutes.use(authenticateToken);
llmTestRoutes.use(requireAdmin as RequestHandler);

// ==================== Validation Schemas ====================

const createTestPairSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().default(true),
  intervalMinutes: z.number().min(1).max(60).default(5),
  questionerModelName: z.string().min(1, 'Questioner model name is required'),
  questionerEndpoint: z.string().url('Invalid questioner endpoint URL'),
  questionerApiKey: z.string().optional(),
  questionerExtraHeaders: z.record(z.string()).optional(),
  testModelName: z.string().min(1, 'Test model name is required'),
  testEndpoint: z.string().url('Invalid test endpoint URL'),
  testApiKey: z.string().optional(),
  testExtraHeaders: z.record(z.string()).optional(),
  questionPrompt: z.string().optional(),
  evaluationPrompt: z.string().optional(),
});

const updateTestPairSchema = createTestPairSchema.partial();

// ==================== Routes ====================

/**
 * GET /llm-test/pairs - 모든 테스트 쌍 조회
 */
llmTestRoutes.get('/pairs', async (_req, res) => {
  try {
    const pairs = await prisma.lLMTestPair.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { results: true } } },
    });

    const maskedPairs = pairs.map((pair: {
      questionerApiKey: string | null;
      testApiKey: string | null;
      [key: string]: unknown;
    }) => ({
      ...pair,
      questionerApiKey: pair.questionerApiKey ? '********' : null,
      testApiKey: pair.testApiKey ? '********' : null,
    }));

    res.json({ pairs: maskedPairs });
  } catch (error) {
    console.error('Failed to list LLM test pairs:', error);
    res.status(500).json({ error: 'Failed to list test pairs' });
  }
});

/**
 * GET /llm-test/pairs/:id - 특정 테스트 쌍 조회
 */
llmTestRoutes.get('/pairs/:id', async (req, res) => {
  try {
    const pair = await prisma.lLMTestPair.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { results: true } } },
    });

    if (!pair) return res.status(404).json({ error: 'Test pair not found' });

    res.json({
      pair: {
        ...pair,
        questionerApiKey: pair.questionerApiKey ? '********' : null,
        testApiKey: pair.testApiKey ? '********' : null,
      },
    });
  } catch (error) {
    console.error('Failed to get LLM test pair:', error);
    res.status(500).json({ error: 'Failed to get test pair' });
  }
});

/**
 * POST /llm-test/pairs - 새 테스트 쌍 생성
 */
llmTestRoutes.post('/pairs', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const validation = createTestPairSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const data = validation.data;
    const createData: Record<string, unknown> = {
      name: data.name,
      enabled: data.enabled,
      intervalMinutes: data.intervalMinutes,
      questionerModelName: data.questionerModelName,
      questionerEndpoint: data.questionerEndpoint,
      questionerApiKey: data.questionerApiKey || null,
      questionerExtraHeaders: data.questionerExtraHeaders || undefined,
      testModelName: data.testModelName,
      testEndpoint: data.testEndpoint,
      testApiKey: data.testApiKey || null,
      testExtraHeaders: data.testExtraHeaders || undefined,
    };

    if (data.questionPrompt !== undefined) createData.questionPrompt = data.questionPrompt;
    if (data.evaluationPrompt !== undefined) createData.evaluationPrompt = data.evaluationPrompt;

    const pair = await prisma.lLMTestPair.create({ data: createData as any });
    console.log(`[LLMTest] Created test pair: ${pair.id} (${pair.name})`);

    res.status(201).json({
      pair: {
        ...pair,
        questionerApiKey: pair.questionerApiKey ? '********' : null,
        testApiKey: pair.testApiKey ? '********' : null,
      },
    });
  } catch (error) {
    console.error('Failed to create LLM test pair:', error);
    res.status(500).json({ error: 'Failed to create test pair' });
  }
});

/**
 * PUT /llm-test/pairs/:id - 테스트 쌍 수정
 */
llmTestRoutes.put('/pairs/:id', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateTestPairSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
    }

    const existing = await prisma.lLMTestPair.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Test pair not found' });

    const data = validation.data;
    const updateData: Record<string, unknown> = { ...data };
    if (data.questionerApiKey === '********') delete updateData.questionerApiKey;
    if (data.testApiKey === '********') delete updateData.testApiKey;

    const pair = await prisma.lLMTestPair.update({ where: { id }, data: updateData });
    console.log(`[LLMTest] Updated test pair: ${pair.id} (${pair.name})`);

    res.json({
      pair: {
        ...pair,
        questionerApiKey: pair.questionerApiKey ? '********' : null,
        testApiKey: pair.testApiKey ? '********' : null,
      },
    });
  } catch (error) {
    console.error('Failed to update LLM test pair:', error);
    res.status(500).json({ error: 'Failed to update test pair' });
  }
});

/**
 * DELETE /llm-test/pairs/:id - 테스트 쌍 삭제
 */
llmTestRoutes.delete('/pairs/:id', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.lLMTestPair.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Test pair not found' });

    await prisma.lLMTestPair.delete({ where: { id } });
    console.log(`[LLMTest] Deleted test pair: ${id}`);
    res.json({ message: 'Test pair deleted' });
  } catch (error) {
    console.error('Failed to delete LLM test pair:', error);
    res.status(500).json({ error: 'Failed to delete test pair' });
  }
});

/**
 * POST /llm-test/pairs/:id/run - 수동 테스트 실행
 */
llmTestRoutes.post('/pairs/:id/run', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[LLMTest] Manual test run for pair: ${id}`);
    const result = await runTestAndSave(id);
    res.json({ result });
  } catch (error) {
    console.error('Failed to run LLM test:', error);
    res.status(500).json({ error: 'Failed to run test' });
  }
});

/**
 * GET /llm-test/pairs/:id/results - 테스트 결과 조회
 */
llmTestRoutes.get('/pairs/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const days = parseInt(req.query.days as string) || 7;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [results, total] = await Promise.all([
      prisma.lLMTestResult.findMany({
        where: { pairId: id, timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.lLMTestResult.count({
        where: { pairId: id, timestamp: { gte: since } },
      }),
    ]);

    res.json({ results, total, limit, offset });
  } catch (error) {
    console.error('Failed to get LLM test results:', error);
    res.status(500).json({ error: 'Failed to get test results' });
  }
});

/**
 * GET /llm-test/results/chart - 차트용 데이터 조회
 */
llmTestRoutes.get('/results/chart', async (req, res) => {
  try {
    const pairIds = (req.query.pairIds as string)?.split(',').filter(Boolean) || [];
    const days = parseInt(req.query.days as string) || 7;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const whereClause: { timestamp: { gte: Date }; pairId?: { in: string[] } } = {
      timestamp: { gte: since },
    };
    if (pairIds.length > 0) whereClause.pairId = { in: pairIds };

    const [results, pairs] = await Promise.all([
      prisma.lLMTestResult.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' },
        include: { pair: { select: { id: true, name: true, testModelName: true } } },
      }),
      prisma.lLMTestPair.findMany({
        where: pairIds.length > 0 ? { id: { in: pairIds } } : {},
        select: { id: true, name: true, testModelName: true },
      }),
    ]);

    res.json({ results, pairs });
  } catch (error) {
    console.error('Failed to get chart data:', error);
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

/**
 * GET /llm-test/stats - 전체 통계
 */
llmTestRoutes.get('/stats', async (_req, res) => {
  try {
    const [totalPairs, enabledPairs] = await Promise.all([
      prisma.lLMTestPair.count(),
      prisma.lLMTestPair.count({ where: { enabled: true } }),
    ]);

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const recentResults = await prisma.lLMTestResult.findMany({
      where: { timestamp: { gte: since } },
      select: { latencyMs: true, score: true, status: true },
    });

    const successCount = recentResults.filter(r => r.status === 'SUCCESS').length;
    const avgLatency = recentResults.length > 0
      ? Math.round(recentResults.reduce((sum, r) => sum + r.latencyMs, 0) / recentResults.length)
      : 0;
    const scores = recentResults.filter(r => r.score !== null).map(r => r.score!);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : null;

    res.json({
      totalPairs,
      enabledPairs,
      recentTestCount: recentResults.length,
      successRate: recentResults.length > 0 ? Math.round((successCount / recentResults.length) * 100) : 0,
      avgLatency,
      avgScore,
    });
  } catch (error) {
    console.error('Failed to get LLM test stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
