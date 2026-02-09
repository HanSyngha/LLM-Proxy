import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requireWriteAccess } from '../middleware/dashboardAuth.js';

export const adminUsersRoutes = Router();

// ============================================
// User Management
// ============================================

/**
 * GET /admin/users - List users (paginated with search)
 */
adminUsersRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { loginid: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { deptname: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { lastActive: 'desc' },
        skip,
        take: limitNum,
        include: {
          _count: { select: { apiTokens: true, usageLogs: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /admin/users/:id - User detail with usage history and token list
 */
adminUsersRoutes.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        apiTokens: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            prefix: true,
            enabled: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
            rpmLimit: true,
            tpmLimit: true,
            tphLimit: true,
            tpdLimit: true,
            monthlyOutputTokenBudget: true,
            allowedModels: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get recent usage stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageHistory = await prisma.dailyUsageStat.findMany({
      where: {
        userId: id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
      include: {
        model: { select: { name: true, displayName: true } },
      },
    });

    // Get usage summary
    const usageSummary = await prisma.usageLog.aggregate({
      where: {
        userId: id,
        timestamp: { gte: thirtyDaysAgo },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: { id: true },
      _avg: { latencyMs: true },
    });

    res.json({
      user,
      usageHistory,
      usageSummary: {
        totalRequests: usageSummary._count.id,
        totalInputTokens: usageSummary._sum.inputTokens || 0,
        totalOutputTokens: usageSummary._sum.outputTokens || 0,
        totalTokens: usageSummary._sum.totalTokens || 0,
        avgLatencyMs: Math.round(usageSummary._avg.latencyMs || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

/**
 * POST /admin/users/:id/ban - Ban user
 */
adminUsersRoutes.post('/:id/ban', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.isBanned) {
      res.status(400).json({ error: 'User is already banned' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isBanned: true,
        bannedReason: reason || null,
      },
    });

    // Disable all user tokens
    await prisma.apiToken.updateMany({
      where: { userId: id },
      data: { enabled: false },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'BAN_USER',
        target: id,
        targetType: 'User',
        details: { bannedLoginid: existing.loginid, reason: reason || null },
        ipAddress: req.ip,
      },
    });

    res.json({ user, message: 'User banned and all tokens disabled' });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * POST /admin/users/:id/unban - Unban user
 */
adminUsersRoutes.post('/:id/unban', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!existing.isBanned) {
      res.status(400).json({ error: 'User is not banned' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        bannedReason: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UNBAN_USER',
        target: id,
        targetType: 'User',
        details: { unbannedLoginid: existing.loginid },
        ipAddress: req.ip,
      },
    });

    res.json({ user, message: 'User unbanned. Tokens remain disabled; re-enable them individually if needed.' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

/**
 * PUT /admin/users/:id/budget - Set monthly output token budget
 */
adminUsersRoutes.put('/:id/budget', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { budget } = req.body as { budget?: number | null };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (budget !== null && budget !== undefined && (typeof budget !== 'number' || budget < 0)) {
      res.status(400).json({ error: 'Budget must be a non-negative number or null' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        monthlyOutputTokenBudget: budget === undefined ? null : budget,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_USER_BUDGET',
        target: id,
        targetType: 'User',
        details: {
          loginid: existing.loginid,
          previousBudget: existing.monthlyOutputTokenBudget,
          newBudget: budget ?? null,
        },
        ipAddress: req.ip,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Error updating user budget:', error);
    res.status(500).json({ error: 'Failed to update user budget' });
  }
});
