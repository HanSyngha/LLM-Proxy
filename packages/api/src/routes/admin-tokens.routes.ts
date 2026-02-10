import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requireWriteAccess } from '../middleware/dashboardAuth.js';

export const adminTokensRoutes = Router();

// ============================================
// API Token Management (Admin)
// ============================================

/**
 * GET /admin/tokens - List all tokens (paginated, filterable)
 */
adminTokensRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      userId,
      enabled,
      search,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
    }
    if (enabled !== undefined) {
      where.enabled = enabled === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { prefix: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tokens, total] = await Promise.all([
      prisma.apiToken.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          userId: true,
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
          user: {
            select: {
              id: true,
              loginid: true,
              username: true,
              deptname: true,
            },
          },
        },
      }),
      prisma.apiToken.count({ where }),
    ]);

    res.json({
      tokens,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error listing tokens:', error);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

/**
 * GET /admin/tokens/:id - Token detail with usage stats
 */
adminTokensRoutes.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const token = await prisma.apiToken.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
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
        user: {
          select: {
            id: true,
            loginid: true,
            username: true,
            deptname: true,
          },
        },
      },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    // Get usage stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [usageStats, recentUsage] = await Promise.all([
      prisma.usageLog.aggregate({
        where: {
          apiTokenId: id,
          timestamp: { gte: thirtyDaysAgo },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: { id: true },
        _avg: { latencyMs: true },
      }),
      prisma.dailyUsageStat.findMany({
        where: {
          apiTokenId: id,
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: 'desc' },
        take: 30,
        include: {
          model: { select: { name: true, displayName: true } },
        },
      }),
    ]);

    res.json({
      token,
      usageStats: {
        totalRequests: usageStats._count.id,
        totalInputTokens: usageStats._sum.inputTokens || 0,
        totalOutputTokens: usageStats._sum.outputTokens || 0,
        totalTokens: usageStats._sum.totalTokens || 0,
        avgLatencyMs: Math.round(usageStats._avg.latencyMs || 0),
      },
      recentUsage,
    });
  } catch (error) {
    console.error('Error fetching token detail:', error);
    res.status(500).json({ error: 'Failed to fetch token detail' });
  }
});

/**
 * PATCH /admin/tokens/:id - Update token properties
 */
adminTokensRoutes.patch('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      enabled,
      rpmLimit,
      tpmLimit,
      tphLimit,
      tpdLimit,
      monthlyOutputTokenBudget,
      allowedModels,
    } = req.body as {
      enabled?: boolean;
      rpmLimit?: number | null;
      tpmLimit?: number | null;
      tphLimit?: number | null;
      tpdLimit?: number | null;
      monthlyOutputTokenBudget?: number | null;
      allowedModels?: string[];
    };

    // Validate rate limit fields: null or non-negative integer
    const rateLimitFields: Array<[string, unknown]> = [
      ['rpmLimit', rpmLimit],
      ['tpmLimit', tpmLimit],
      ['tphLimit', tphLimit],
      ['tpdLimit', tpdLimit],
    ];
    for (const [name, value] of rateLimitFields) {
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          res.status(400).json({ error: `${name} must be a non-negative integer or null` });
          return;
        }
      }
    }

    const existing = await prisma.apiToken.findUnique({
      where: { id },
      include: { user: { select: { loginid: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (rpmLimit !== undefined) data.rpmLimit = rpmLimit;
    if (tpmLimit !== undefined) data.tpmLimit = tpmLimit;
    if (tphLimit !== undefined) data.tphLimit = tphLimit;
    if (tpdLimit !== undefined) data.tpdLimit = tpdLimit;
    if (monthlyOutputTokenBudget !== undefined) data.monthlyOutputTokenBudget = monthlyOutputTokenBudget;
    if (allowedModels !== undefined) data.allowedModels = allowedModels;

    const token = await prisma.apiToken.update({
      where: { id },
      data,
      select: {
        id: true,
        userId: true,
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

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_TOKEN',
        target: id,
        targetType: 'ApiToken',
        details: JSON.parse(JSON.stringify({ tokenPrefix: existing.prefix, ownerLoginid: existing.user.loginid, changes: data })),
        ipAddress: req.ip,
      },
    });

    res.json({ token });
  } catch (error) {
    console.error('Error updating token:', error);
    res.status(500).json({ error: 'Failed to update token' });
  }
});

/**
 * DELETE /admin/tokens/:id - Revoke/delete token
 */
adminTokensRoutes.delete('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.apiToken.findUnique({
      where: { id },
      include: { user: { select: { loginid: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    await prisma.apiToken.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'DELETE_TOKEN',
        target: id,
        targetType: 'ApiToken',
        details: { tokenPrefix: existing.prefix, ownerLoginid: existing.user.loginid },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Token revoked and deleted successfully' });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

/**
 * PUT /admin/tokens/:id/rate-limits - Set rate limits
 */
adminTokensRoutes.put('/:id/rate-limits', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rpmLimit, tpmLimit, tphLimit, tpdLimit } = req.body as {
      rpmLimit?: number | null;
      tpmLimit?: number | null;
      tphLimit?: number | null;
      tpdLimit?: number | null;
    };

    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    // Validate: each value must be null or a non-negative integer
    const fields: Array<[string, unknown]> = [
      ['rpmLimit', rpmLimit],
      ['tpmLimit', tpmLimit],
      ['tphLimit', tphLimit],
      ['tpdLimit', tpdLimit],
    ];
    for (const [name, value] of fields) {
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          res.status(400).json({ error: `${name} must be a non-negative integer or null` });
          return;
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (rpmLimit !== undefined) data.rpmLimit = rpmLimit;
    if (tpmLimit !== undefined) data.tpmLimit = tpmLimit;
    if (tphLimit !== undefined) data.tphLimit = tphLimit;
    if (tpdLimit !== undefined) data.tpdLimit = tpdLimit;

    const token = await prisma.apiToken.update({
      where: { id },
      data,
      select: {
        id: true,
        prefix: true,
        rpmLimit: true,
        tpmLimit: true,
        tphLimit: true,
        tpdLimit: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_TOKEN_RATE_LIMITS',
        target: id,
        targetType: 'ApiToken',
        details: JSON.parse(JSON.stringify({ tokenPrefix: existing.prefix, rateLimits: data })),
        ipAddress: req.ip,
      },
    });

    res.json({ token });
  } catch (error) {
    console.error('Error updating token rate limits:', error);
    res.status(500).json({ error: 'Failed to update token rate limits' });
  }
});

/**
 * PUT /admin/tokens/:id/budget - Set token budget
 */
adminTokensRoutes.put('/:id/budget', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { budget } = req.body as { budget?: number | null };

    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (budget !== null && budget !== undefined && (typeof budget !== 'number' || budget < 0)) {
      res.status(400).json({ error: 'Budget must be a non-negative number or null' });
      return;
    }

    const token = await prisma.apiToken.update({
      where: { id },
      data: {
        monthlyOutputTokenBudget: budget === undefined ? null : budget,
      },
      select: {
        id: true,
        prefix: true,
        monthlyOutputTokenBudget: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_TOKEN_BUDGET',
        target: id,
        targetType: 'ApiToken',
        details: {
          tokenPrefix: existing.prefix,
          previousBudget: existing.monthlyOutputTokenBudget,
          newBudget: budget ?? null,
        },
        ipAddress: req.ip,
      },
    });

    res.json({ token });
  } catch (error) {
    console.error('Error updating token budget:', error);
    res.status(500).json({ error: 'Failed to update token budget' });
  }
});

/**
 * PUT /admin/tokens/:id/models - Set allowed models
 */
adminTokensRoutes.put('/:id/models', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { modelIds } = req.body as { modelIds?: string[] };

    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (!Array.isArray(modelIds)) {
      res.status(400).json({ error: 'modelIds must be an array of strings' });
      return;
    }

    // Validate model IDs exist
    if (modelIds.length > 0) {
      const existingModels = await prisma.model.findMany({
        where: { id: { in: modelIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingModels.map(m => m.id));
      const invalidIds = modelIds.filter(mid => !existingIds.has(mid));
      if (invalidIds.length > 0) {
        res.status(400).json({ error: `Invalid model IDs: ${invalidIds.join(', ')}` });
        return;
      }
    }

    const token = await prisma.apiToken.update({
      where: { id },
      data: { allowedModels: modelIds },
      select: {
        id: true,
        prefix: true,
        allowedModels: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_TOKEN_MODELS',
        target: id,
        targetType: 'ApiToken',
        details: {
          tokenPrefix: existing.prefix,
          previousModels: existing.allowedModels,
          newModels: modelIds,
        },
        ipAddress: req.ip,
      },
    });

    res.json({ token });
  } catch (error) {
    console.error('Error updating token models:', error);
    res.status(500).json({ error: 'Failed to update token models' });
  }
});
