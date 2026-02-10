import { Router, Response } from 'express';
import { prisma, redis } from '../index.js';
import { AuthenticatedRequest, requireWriteAccess } from '../middleware/dashboardAuth.js';
import { getMonthlyOutputTokens } from '../services/redis.service.js';

export const adminDeptBudgetsRoutes = Router();

/**
 * GET /admin/dept-budgets - List all department budgets with current usage
 */
adminDeptBudgetsRoutes.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const deptBudgets = await prisma.deptBudget.findMany({
      orderBy: { deptname: 'asc' },
    });

    // Enrich with current monthly usage from Redis
    const enriched = await Promise.all(
      deptBudgets.map(async (db) => {
        const monthlyUsed = await getMonthlyOutputTokens(redis, 'dept', db.deptname);
        return { ...db, monthlyUsed };
      })
    );

    res.json({ deptBudgets: enriched });
  } catch (error) {
    console.error('Error listing dept budgets:', error);
    res.status(500).json({ error: 'Failed to list department budgets' });
  }
});

/**
 * GET /admin/dept-budgets/departments - List all unique departments from users
 */
adminDeptBudgetsRoutes.get('/departments', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const depts = await prisma.user.groupBy({
      by: ['deptname'],
      _count: { id: true },
      where: { isActive: true, deptname: { not: '' } },
      orderBy: { deptname: 'asc' },
    });

    const departments = depts.map(d => ({
      deptname: d.deptname,
      userCount: d._count.id,
    }));

    res.json({ departments });
  } catch (error) {
    console.error('Error listing departments:', error);
    res.status(500).json({ error: 'Failed to list departments' });
  }
});

/**
 * POST /admin/dept-budgets - Create a department budget
 */
adminDeptBudgetsRoutes.post('/', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deptname, monthlyOutputTokenBudget, rpmLimit, tpmLimit, tphLimit, tpdLimit } = req.body as {
      deptname?: string;
      monthlyOutputTokenBudget?: number;
      rpmLimit?: number | null;
      tpmLimit?: number | null;
      tphLimit?: number | null;
      tpdLimit?: number | null;
    };

    if (!deptname || monthlyOutputTokenBudget == null) {
      res.status(400).json({ error: 'deptname and monthlyOutputTokenBudget are required' });
      return;
    }

    if (typeof monthlyOutputTokenBudget !== 'number' || monthlyOutputTokenBudget < 0) {
      res.status(400).json({ error: 'monthlyOutputTokenBudget must be a non-negative number' });
      return;
    }

    const existing = await prisma.deptBudget.findUnique({ where: { deptname } });
    if (existing) {
      res.status(409).json({ error: 'Department budget already exists. Use PUT to update.' });
      return;
    }

    const deptBudget = await prisma.deptBudget.create({
      data: { deptname, monthlyOutputTokenBudget, rpmLimit, tpmLimit, tphLimit, tpdLimit },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'CREATE_DEPT_BUDGET',
        target: deptBudget.id,
        targetType: 'DeptBudget',
        details: { deptname, monthlyOutputTokenBudget, rpmLimit, tpmLimit, tphLimit, tpdLimit },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ deptBudget });
  } catch (error) {
    console.error('Error creating dept budget:', error);
    res.status(500).json({ error: 'Failed to create department budget' });
  }
});

/**
 * PUT /admin/dept-budgets/:id - Update a department budget
 */
adminDeptBudgetsRoutes.put('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { monthlyOutputTokenBudget, rpmLimit, tpmLimit, tphLimit, tpdLimit, enabled } = req.body as {
      monthlyOutputTokenBudget?: number;
      rpmLimit?: number | null;
      tpmLimit?: number | null;
      tphLimit?: number | null;
      tpdLimit?: number | null;
      enabled?: boolean;
    };

    const existing = await prisma.deptBudget.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Department budget not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (monthlyOutputTokenBudget !== undefined) data.monthlyOutputTokenBudget = monthlyOutputTokenBudget;
    if (rpmLimit !== undefined) data.rpmLimit = rpmLimit;
    if (tpmLimit !== undefined) data.tpmLimit = tpmLimit;
    if (tphLimit !== undefined) data.tphLimit = tphLimit;
    if (tpdLimit !== undefined) data.tpdLimit = tpdLimit;
    if (enabled !== undefined) data.enabled = enabled;

    const deptBudget = await prisma.deptBudget.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_DEPT_BUDGET',
        target: id,
        targetType: 'DeptBudget',
        details: { deptname: existing.deptname, changes: JSON.parse(JSON.stringify(data)) },
        ipAddress: req.ip,
      },
    });

    res.json({ deptBudget });
  } catch (error) {
    console.error('Error updating dept budget:', error);
    res.status(500).json({ error: 'Failed to update department budget' });
  }
});

/**
 * DELETE /admin/dept-budgets/:id - Delete a department budget
 */
adminDeptBudgetsRoutes.delete('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.deptBudget.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Department budget not found' });
      return;
    }

    await prisma.deptBudget.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'DELETE_DEPT_BUDGET',
        target: id,
        targetType: 'DeptBudget',
        details: { deptname: existing.deptname },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Department budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting dept budget:', error);
    res.status(500).json({ error: 'Failed to delete department budget' });
  }
});
