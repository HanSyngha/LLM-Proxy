import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requireSuperAdmin, requireWriteAccess } from '../middleware/dashboardAuth.js';

export const adminLogsRoutes = Router();

// ============================================
// Request Log Viewer
// ============================================

/**
 * GET /admin/logs - Search request logs
 */
adminLogsRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      userId,
      apiTokenId,
      modelName,
      statusCode,
      startDate,
      endDate,
      stream,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }
    if (apiTokenId) {
      where.apiTokenId = apiTokenId;
    }
    if (modelName) {
      where.modelName = { contains: modelName, mode: 'insensitive' };
    }
    if (statusCode) {
      where.statusCode = parseInt(statusCode, 10);
    }
    if (stream !== undefined) {
      where.stream = stream === 'true';
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        (where.timestamp as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.timestamp as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.requestLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          apiTokenId: true,
          userId: true,
          modelName: true,
          resolvedModel: true,
          method: true,
          path: true,
          statusCode: true,
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          errorMessage: true,
          userAgent: true,
          ipAddress: true,
          stream: true,
          timestamp: true,
          // Omit requestBody and responseBody for list view (too large)
          apiToken: {
            select: {
              prefix: true,
              name: true,
              user: { select: { loginid: true, username: true } },
            },
          },
        },
      }),
      prisma.requestLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error searching logs:', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

/**
 * GET /admin/logs/:id - Get single log detail (full request/response body)
 */
adminLogsRoutes.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const log = await prisma.requestLog.findUnique({
      where: { id },
      include: {
        apiToken: {
          select: {
            prefix: true,
            name: true,
            user: { select: { id: true, loginid: true, username: true, deptname: true } },
          },
        },
      },
    });

    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    res.json({ log });
  } catch (error) {
    console.error('Error fetching log detail:', error);
    res.status(500).json({ error: 'Failed to fetch log detail' });
  }
});

/**
 * DELETE /admin/logs/cleanup - Clean up old logs (SUPER_ADMIN only)
 */
adminLogsRoutes.delete('/cleanup', requireSuperAdmin, requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const retentionDays = Math.max(1, parseInt((req.query as Record<string, string>).retentionDays || '30', 10));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.requestLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'CLEANUP_LOGS',
        targetType: 'RequestLog',
        details: { retentionDays, deletedCount: result.count, cutoffDate: cutoff.toISOString() },
        ipAddress: req.ip,
      },
    });

    res.json({
      message: `Cleaned up ${result.count} logs older than ${retentionDays} days`,
      deletedCount: result.count,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({ error: 'Failed to clean up logs' });
  }
});
