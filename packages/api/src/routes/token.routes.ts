/**
 * Token Routes
 *
 * 사용자별 API 토큰 관리 (sk-xxx 형식)
 * - 토큰 목록 조회 (사용량 통계 포함)
 * - 토큰 생성 (사용자당 최대 5개)
 * - 토큰 수정 (이름, 활성화 상태)
 * - 토큰 삭제
 *
 * 모든 엔드포인트는 Dashboard SSO 인증 필수
 */

import { Router } from 'express';
import { prisma, redis } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/dashboardAuth.js';
import { generateApiToken } from '../services/tokenHash.service.js';
import { getMonthlyOutputTokens } from '../services/redis.service.js';

export const tokenRoutes = Router();

// 모든 라우트에 인증 적용
tokenRoutes.use(authenticateToken);

/**
 * GET /tokens
 * 내 API 토큰 목록 조회 (사용량 통계 포함)
 */
tokenRoutes.get('/', async (req: AuthenticatedRequest, res) => {
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

    // Fetch tokens
    const tokens = await prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        rpmLimit: true,
        tpmLimit: true,
        tphLimit: true,
        tpdLimit: true,
        monthlyOutputTokenBudget: true,
        allowedModels: true,
      },
    });

    // Fetch aggregated usage stats per token
    const tokenIds = tokens.map(t => t.id);

    const usageStats: Array<{
      api_token_id: string;
      total_requests: bigint;
      total_output_tokens: bigint;
    }> = tokenIds.length > 0
      ? await prisma.$queryRaw`
          SELECT
            api_token_id,
            COUNT(*) as total_requests,
            COALESCE(SUM(output_tokens), 0) as total_output_tokens
          FROM usage_logs
          WHERE user_id = ${user.id}
            AND api_token_id = ANY(${tokenIds}::text[])
          GROUP BY api_token_id
        `
      : [];

    const usageMap = new Map(
      usageStats.map(row => [
        row.api_token_id,
        {
          totalRequests: Number(row.total_requests),
          totalOutputTokens: Number(row.total_output_tokens),
        },
      ])
    );

    // Fetch monthly output tokens from Redis for each token
    const monthlyTokensMap = new Map<string, number>();
    await Promise.all(
      tokenIds.map(async (tokenId) => {
        const monthly = await getMonthlyOutputTokens(redis, 'token', tokenId);
        monthlyTokensMap.set(tokenId, monthly);
      })
    );

    // Combine tokens with usage stats
    const tokensWithStats = tokens.map(token => {
      const stats = usageMap.get(token.id);
      return {
        ...token,
        usage: {
          totalRequests: stats?.totalRequests ?? 0,
          totalOutputTokens: stats?.totalOutputTokens ?? 0,
          monthlyOutputTokens: monthlyTokensMap.get(token.id) ?? 0,
        },
      };
    });

    res.json({ tokens: tokensWithStats });
  } catch (error) {
    console.error('List tokens error:', error);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

/**
 * POST /tokens
 * 새 API 토큰 생성 (사용자당 최대 5개)
 * Body: { name: string, expiresAt?: string }
 * Returns: { token: {...}, rawKey: "sk-..." }
 */
tokenRoutes.post('/', async (req: AuthenticatedRequest, res) => {
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

    const { name, expiresAt } = req.body as { name?: string; expiresAt?: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Token name is required' });
      return;
    }

    if (name.trim().length > 100) {
      res.status(400).json({ error: 'Token name must be 100 characters or less' });
      return;
    }

    // Check token count limit
    const existingCount = await prisma.apiToken.count({
      where: { userId: user.id },
    });

    if (existingCount >= 5) {
      res.status(400).json({ error: 'Maximum 5 tokens per user. Please delete an existing token first.' });
      return;
    }

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        res.status(400).json({ error: 'Invalid expiresAt date format' });
        return;
      }
      if (parsedExpiresAt <= new Date()) {
        res.status(400).json({ error: 'expiresAt must be a future date' });
        return;
      }
    }

    // Generate token
    const { rawKey, prefix, hashedKey } = generateApiToken();

    // Create token in DB
    const token = await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: name.trim(),
        prefix,
        hashedKey,
        expiresAt: parsedExpiresAt,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      token,
      rawKey,
    });
  } catch (error) {
    console.error('Create token error:', error);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

/**
 * PATCH /tokens/:id
 * 토큰 수정 (이름, 활성화 상태)
 * Body: { name?: string, enabled?: boolean }
 * 소유자만 수정 가능
 */
tokenRoutes.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find token and verify ownership
    const existing = await prisma.apiToken.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (existing.userId !== user.id) {
      res.status(403).json({ error: 'You can only modify your own tokens' });
      return;
    }

    const { name, enabled } = req.body as { name?: string; enabled?: boolean };

    // Build update data
    const updateData: { name?: string; enabled?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Token name cannot be empty' });
        return;
      }
      if (name.trim().length > 100) {
        res.status(400).json({ error: 'Token name must be 100 characters or less' });
        return;
      }
      updateData.name = name.trim();
    }

    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be a boolean' });
        return;
      }
      updateData.enabled = enabled;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No valid fields to update. Provide name or enabled.' });
      return;
    }

    const updated = await prisma.apiToken.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        prefix: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    res.json({ token: updated });
  } catch (error) {
    console.error('Update token error:', error);
    res.status(500).json({ error: 'Failed to update token' });
  }
});

/**
 * DELETE /tokens/:id
 * 토큰 삭제
 * 소유자만 삭제 가능
 */
tokenRoutes.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find token and verify ownership
    const existing = await prisma.apiToken.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (existing.userId !== user.id) {
      res.status(403).json({ error: 'You can only delete your own tokens' });
      return;
    }

    await prisma.apiToken.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Token deleted' });
  } catch (error) {
    console.error('Delete token error:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});
