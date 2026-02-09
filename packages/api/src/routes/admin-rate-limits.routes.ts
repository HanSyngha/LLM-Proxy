import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requireSuperAdmin, requireWriteAccess } from '../middleware/dashboardAuth.js';

export const adminRateLimitsRoutes = Router();

// ============================================
// Global Rate Limit Configuration
// ============================================

/**
 * GET /admin/rate-limits - Get global default rate limits
 */
adminRateLimitsRoutes.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.rateLimitConfig.findUnique({
      where: { key: 'default' },
    });

    if (!config) {
      // Return fallback defaults if not yet configured
      res.json({
        config: {
          key: 'default',
          rpmLimit: parseInt(process.env['DEFAULT_RPM'] || '60', 10),
          tpmLimit: parseInt(process.env['DEFAULT_TPM'] || '100000', 10),
          tphLimit: parseInt(process.env['DEFAULT_TPH'] || '1000000', 10),
          tpdLimit: parseInt(process.env['DEFAULT_TPD'] || '10000000', 10),
          updatedAt: null,
        },
      });
      return;
    }

    res.json({ config });
  } catch (error) {
    console.error('Error fetching rate limits:', error);
    res.status(500).json({ error: 'Failed to fetch rate limits' });
  }
});

/**
 * PUT /admin/rate-limits - Update global default rate limits (SUPER_ADMIN only)
 */
adminRateLimitsRoutes.put('/', requireSuperAdmin, requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rpmLimit, tpmLimit, tphLimit, tpdLimit } = req.body as {
      rpmLimit?: number;
      tpmLimit?: number;
      tphLimit?: number;
      tpdLimit?: number;
    };

    // Validate at least one field is provided
    if (rpmLimit === undefined && tpmLimit === undefined && tphLimit === undefined && tpdLimit === undefined) {
      res.status(400).json({ error: 'At least one rate limit field is required (rpmLimit, tpmLimit, tphLimit, tpdLimit)' });
      return;
    }

    // Validate non-negative integers
    const fields: Array<[string, unknown]> = [
      ['rpmLimit', rpmLimit],
      ['tpmLimit', tpmLimit],
      ['tphLimit', tphLimit],
      ['tpdLimit', tpdLimit],
    ];
    for (const [name, value] of fields) {
      if (value !== undefined) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          res.status(400).json({ error: `${name} must be a non-negative integer` });
          return;
        }
      }
    }

    // Fetch current config for audit log
    const currentConfig = await prisma.rateLimitConfig.findUnique({
      where: { key: 'default' },
    });

    const data: Record<string, number> = {};
    if (rpmLimit !== undefined) data.rpmLimit = rpmLimit;
    if (tpmLimit !== undefined) data.tpmLimit = tpmLimit;
    if (tphLimit !== undefined) data.tphLimit = tphLimit;
    if (tpdLimit !== undefined) data.tpdLimit = tpdLimit;

    const config = await prisma.rateLimitConfig.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        rpmLimit: rpmLimit ?? parseInt(process.env['DEFAULT_RPM'] || '60', 10),
        tpmLimit: tpmLimit ?? parseInt(process.env['DEFAULT_TPM'] || '100000', 10),
        tphLimit: tphLimit ?? parseInt(process.env['DEFAULT_TPH'] || '1000000', 10),
        tpdLimit: tpdLimit ?? parseInt(process.env['DEFAULT_TPD'] || '10000000', 10),
      },
      update: data,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_RATE_LIMITS',
        targetType: 'RateLimitConfig',
        details: {
          previous: currentConfig
            ? {
                rpmLimit: currentConfig.rpmLimit,
                tpmLimit: currentConfig.tpmLimit,
                tphLimit: currentConfig.tphLimit,
                tpdLimit: currentConfig.tpdLimit,
              }
            : null,
          updated: data,
        },
        ipAddress: req.ip,
      },
    });

    res.json({ config });
  } catch (error) {
    console.error('Error updating rate limits:', error);
    res.status(500).json({ error: 'Failed to update rate limits' });
  }
});
