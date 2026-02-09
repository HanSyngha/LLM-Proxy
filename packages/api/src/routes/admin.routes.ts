import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, requireWriteAccess, AuthenticatedRequest } from '../middleware/dashboardAuth.js';
import { adminModelsRoutes } from './admin-models.routes.js';
import { adminUsersRoutes } from './admin-users.routes.js';
import { adminTokensRoutes } from './admin-tokens.routes.js';
import { adminStatsRoutes } from './admin-stats.routes.js';
import { adminLogsRoutes } from './admin-logs.routes.js';
import { adminSystemRoutes } from './admin-system.routes.js';
import { adminRateLimitsRoutes } from './admin-rate-limits.routes.js';

export const adminRoutes = Router();
adminRoutes.use(authenticateToken);
adminRoutes.use(requireAdmin);

// Mount sub-routers
adminRoutes.use('/models', adminModelsRoutes);
adminRoutes.use('/users', adminUsersRoutes);
adminRoutes.use('/tokens', adminTokensRoutes);
adminRoutes.use('/stats', adminStatsRoutes);
adminRoutes.use('/logs', adminLogsRoutes);
adminRoutes.use('/system', adminSystemRoutes);
adminRoutes.use('/rate-limits', adminRateLimitsRoutes);

// ============================================
// Admin Management
// ============================================

/**
 * GET /admin/admins - List all admins
 */
adminRoutes.get('/admins', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ admins });
  } catch (error) {
    console.error('Error listing admins:', error);
    res.status(500).json({ error: 'Failed to list admins' });
  }
});

/**
 * POST /admin/admins - Create a new admin (SUPER_ADMIN only)
 */
adminRoutes.post('/admins', requireSuperAdmin, requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { loginid, role } = req.body as { loginid?: string; role?: string };

    if (!loginid) {
      res.status(400).json({ error: 'loginid is required' });
      return;
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];
    const adminRole = role && validRoles.includes(role) ? role : 'ADMIN';

    const existing = await prisma.admin.findUnique({ where: { loginid } });
    if (existing) {
      res.status(409).json({ error: 'Admin already exists with this loginid' });
      return;
    }

    const admin = await prisma.admin.create({
      data: {
        loginid,
        role: adminRole as 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER',
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'CREATE_ADMIN',
        target: admin.id,
        targetType: 'Admin',
        details: { loginid, role: adminRole },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ admin });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

/**
 * PUT /admin/admins/:id - Update admin role
 */
adminRoutes.put('/admins/:id', requireSuperAdmin, requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: 'Valid role is required (SUPER_ADMIN, ADMIN, VIEWER)' });
      return;
    }

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    const admin = await prisma.admin.update({
      where: { id },
      data: { role: role as 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_ADMIN',
        target: admin.id,
        targetType: 'Admin',
        details: { previousRole: existing.role, newRole: role },
        ipAddress: req.ip,
      },
    });

    res.json({ admin });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

/**
 * DELETE /admin/admins/:id - Remove admin
 */
adminRoutes.delete('/admins/:id', requireSuperAdmin, requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    // Prevent self-deletion
    if (existing.loginid === req.user!.loginid) {
      res.status(400).json({ error: 'Cannot delete your own admin account' });
      return;
    }

    await prisma.admin.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'DELETE_ADMIN',
        target: id,
        targetType: 'Admin',
        details: { deletedLoginid: existing.loginid, deletedRole: existing.role },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Admin removed successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// ============================================
// Audit Log
// ============================================

/**
 * GET /admin/audit - Search audit logs with filters
 */
adminRoutes.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      loginid,
      action,
      targetType,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (loginid) {
      where.loginid = { contains: loginid, mode: 'insensitive' };
    }
    if (action) {
      where.action = action;
    }
    if (targetType) {
      where.targetType = targetType;
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
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
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
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
