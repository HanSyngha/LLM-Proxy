import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { AuthenticatedRequest, requireWriteAccess } from '../middleware/dashboardAuth.js';

export const adminModelsRoutes = Router();

// ============================================
// Helper: Health check a model endpoint
// ============================================
async function testEndpointHealth(
  endpointUrl: string,
  apiKey?: string | null,
  extraHeaders?: Record<string, string> | null,
  modelName?: string | null
): Promise<{ success: boolean; latencyMs: number; error?: string; statusCode?: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const body = {
      model: modelName || 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
      stream: false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      return {
        success: false,
        latencyMs,
        error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
        statusCode: response.status,
      };
    }

    return { success: true, latencyMs, statusCode: response.status };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, latencyMs, error: message };
  }
}

// ============================================
// Model CRUD
// ============================================

/**
 * GET /admin/models - List all models (including disabled)
 */
adminModelsRoutes.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await prisma.model.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subModels: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { usageLogs: true } },
      },
    });
    res.json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

/**
 * POST /admin/models - Create a new model
 */
adminModelsRoutes.post('/', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      displayName,
      alias,
      endpointUrl,
      apiKey,
      extraHeaders,
      maxTokens,
      enabled,
    } = req.body as {
      name?: string;
      displayName?: string;
      alias?: string;
      endpointUrl?: string;
      apiKey?: string;
      extraHeaders?: Record<string, string>;
      maxTokens?: number;
      enabled?: boolean;
    };

    if (!name || !displayName || !endpointUrl) {
      res.status(400).json({ error: 'name, displayName, and endpointUrl are required' });
      return;
    }

    // Check uniqueness
    const existingName = await prisma.model.findUnique({ where: { name } });
    if (existingName) {
      res.status(409).json({ error: 'A model with this name already exists' });
      return;
    }

    if (alias) {
      const existingAlias = await prisma.model.findUnique({ where: { alias } });
      if (existingAlias) {
        res.status(409).json({ error: 'A model with this alias already exists' });
        return;
      }
    }

    // Get next sort order
    const maxSort = await prisma.model.aggregate({ _max: { sortOrder: true } });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const model = await prisma.model.create({
      data: {
        name,
        displayName,
        alias: alias || undefined,
        endpointUrl,
        apiKey: apiKey || undefined,
        extraHeaders: extraHeaders || undefined,
        maxTokens: maxTokens ?? 128000,
        enabled: enabled ?? true,
        sortOrder: nextSortOrder,
        createdBy: req.adminId || undefined,
      },
      include: { subModels: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'CREATE_MODEL',
        target: model.id,
        targetType: 'Model',
        details: { name, displayName, endpointUrl, enabled: model.enabled },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ model });
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

/**
 * PUT /admin/models/reorder - Reorder models
 */
adminModelsRoutes.put('/reorder', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelIds } = req.body as { modelIds?: string[] };

    if (!Array.isArray(modelIds) || modelIds.length === 0) {
      res.status(400).json({ error: 'modelIds array is required' });
      return;
    }

    await prisma.$transaction(
      modelIds.map((id, index) =>
        prisma.model.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'REORDER_MODELS',
        targetType: 'Model',
        details: { modelIds },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Models reordered successfully' });
  } catch (error) {
    console.error('Error reordering models:', error);
    res.status(500).json({ error: 'Failed to reorder models' });
  }
});

/**
 * PUT /admin/models/:id - Update model
 */
adminModelsRoutes.put('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      displayName,
      alias,
      endpointUrl,
      apiKey,
      extraHeaders,
      maxTokens,
      enabled,
    } = req.body as {
      name?: string;
      displayName?: string;
      alias?: string | null;
      endpointUrl?: string;
      apiKey?: string | null;
      extraHeaders?: Record<string, string> | null;
      maxTokens?: number;
      enabled?: boolean;
    };

    const existing = await prisma.model.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Check name uniqueness if changed
    if (name && name !== existing.name) {
      const nameConflict = await prisma.model.findUnique({ where: { name } });
      if (nameConflict) {
        res.status(409).json({ error: 'A model with this name already exists' });
        return;
      }
    }

    // Check alias uniqueness if changed
    if (alias !== undefined && alias !== existing.alias) {
      if (alias) {
        const aliasConflict = await prisma.model.findUnique({ where: { alias } });
        if (aliasConflict && aliasConflict.id !== id) {
          res.status(409).json({ error: 'A model with this alias already exists' });
          return;
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (displayName !== undefined) data.displayName = displayName;
    if (alias !== undefined) data.alias = alias || null;
    if (endpointUrl !== undefined) data.endpointUrl = endpointUrl;
    if (apiKey !== undefined) data.apiKey = apiKey || null;
    if (extraHeaders !== undefined) data.extraHeaders = extraHeaders;
    if (maxTokens !== undefined) data.maxTokens = maxTokens;
    if (enabled !== undefined) data.enabled = enabled;

    const model = await prisma.model.update({
      where: { id },
      data,
      include: { subModels: { orderBy: { sortOrder: 'asc' } } },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_MODEL',
        target: model.id,
        targetType: 'Model',
        details: JSON.parse(JSON.stringify({ changes: data })),
        ipAddress: req.ip,
      },
    });

    res.json({ model });
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

/**
 * DELETE /admin/models/:id - Delete model
 * Use ?force=true to delete models with existing usage logs
 */
adminModelsRoutes.delete('/:id', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const existing = await prisma.model.findUnique({
      where: { id },
      include: { _count: { select: { usageLogs: true, dailyUsageStats: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const hasUsage = existing._count.usageLogs > 0 || existing._count.dailyUsageStats > 0;
    if (hasUsage && !force) {
      res.status(400).json({
        error: 'Model has existing usage logs. Use ?force=true to delete anyway.',
        usageLogs: existing._count.usageLogs,
        dailyUsageStats: existing._count.dailyUsageStats,
      });
      return;
    }

    if (hasUsage && force) {
      // Delete related records first
      await prisma.$transaction([
        prisma.dailyUsageStat.deleteMany({ where: { modelId: id } }),
        prisma.usageLog.deleteMany({ where: { modelId: id } }),
        prisma.subModel.deleteMany({ where: { parentId: id } }),
        prisma.model.delete({ where: { id } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.subModel.deleteMany({ where: { parentId: id } }),
        prisma.model.delete({ where: { id } }),
      ]);
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'DELETE_MODEL',
        target: id,
        targetType: 'Model',
        details: { name: existing.name, forced: force },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

/**
 * POST /admin/models/test - Test endpoint health
 */
adminModelsRoutes.post('/test', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpointUrl, apiKey, extraHeaders, modelName } = req.body as {
      endpointUrl?: string;
      apiKey?: string;
      extraHeaders?: Record<string, string>;
      modelName?: string;
    };

    if (!endpointUrl) {
      res.status(400).json({ error: 'endpointUrl is required' });
      return;
    }

    const result = await testEndpointHealth(endpointUrl, apiKey, extraHeaders, modelName);
    res.json(result);
  } catch (error) {
    console.error('Error testing endpoint:', error);
    res.status(500).json({ error: 'Failed to test endpoint' });
  }
});

// ============================================
// Sub-Model Management
// ============================================

/**
 * GET /admin/models/:modelId/sub-models - List sub-models
 */
adminModelsRoutes.get('/:modelId/sub-models', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId } = req.params;

    const model = await prisma.model.findUnique({ where: { id: modelId } });
    if (!model) {
      res.status(404).json({ error: 'Parent model not found' });
      return;
    }

    const subModels = await prisma.subModel.findMany({
      where: { parentId: modelId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ subModels });
  } catch (error) {
    console.error('Error listing sub-models:', error);
    res.status(500).json({ error: 'Failed to list sub-models' });
  }
});

/**
 * POST /admin/models/:modelId/sub-models - Create sub-model
 */
adminModelsRoutes.post('/:modelId/sub-models', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId } = req.params;
    const { modelName, endpointUrl, apiKey, extraHeaders, enabled } = req.body as {
      modelName?: string;
      endpointUrl?: string;
      apiKey?: string;
      extraHeaders?: Record<string, string>;
      enabled?: boolean;
    };

    const model = await prisma.model.findUnique({ where: { id: modelId } });
    if (!model) {
      res.status(404).json({ error: 'Parent model not found' });
      return;
    }

    if (!endpointUrl) {
      res.status(400).json({ error: 'endpointUrl is required' });
      return;
    }

    const maxSort = await prisma.subModel.aggregate({
      where: { parentId: modelId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const subModel = await prisma.subModel.create({
      data: {
        parentId: modelId,
        modelName: modelName || undefined,
        endpointUrl,
        apiKey: apiKey || undefined,
        extraHeaders: extraHeaders || undefined,
        enabled: enabled ?? true,
        sortOrder: nextSortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'CREATE_SUB_MODEL',
        target: subModel.id,
        targetType: 'SubModel',
        details: { parentModelId: modelId, parentModelName: model.name, endpointUrl },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ subModel });
  } catch (error) {
    console.error('Error creating sub-model:', error);
    res.status(500).json({ error: 'Failed to create sub-model' });
  }
});

/**
 * PUT /admin/models/:modelId/sub-models/:subId - Update sub-model
 */
adminModelsRoutes.put('/:modelId/sub-models/:subId', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId, subId } = req.params;
    const { modelName, endpointUrl, apiKey, extraHeaders, enabled, sortOrder } = req.body as {
      modelName?: string | null;
      endpointUrl?: string;
      apiKey?: string | null;
      extraHeaders?: Record<string, string> | null;
      enabled?: boolean;
      sortOrder?: number;
    };

    const existing = await prisma.subModel.findFirst({
      where: { id: subId, parentId: modelId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Sub-model not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (modelName !== undefined) data.modelName = modelName || null;
    if (endpointUrl !== undefined) data.endpointUrl = endpointUrl;
    if (apiKey !== undefined) data.apiKey = apiKey || null;
    if (extraHeaders !== undefined) data.extraHeaders = extraHeaders;
    if (enabled !== undefined) data.enabled = enabled;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const subModel = await prisma.subModel.update({
      where: { id: subId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'UPDATE_SUB_MODEL',
        target: subId,
        targetType: 'SubModel',
        details: JSON.parse(JSON.stringify({ parentModelId: modelId, changes: data })),
        ipAddress: req.ip,
      },
    });

    res.json({ subModel });
  } catch (error) {
    console.error('Error updating sub-model:', error);
    res.status(500).json({ error: 'Failed to update sub-model' });
  }
});

/**
 * DELETE /admin/models/:modelId/sub-models/:subId - Delete sub-model
 */
adminModelsRoutes.delete('/:modelId/sub-models/:subId', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId, subId } = req.params;

    const existing = await prisma.subModel.findFirst({
      where: { id: subId, parentId: modelId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Sub-model not found' });
      return;
    }

    await prisma.subModel.delete({ where: { id: subId } });

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'DELETE_SUB_MODEL',
        target: subId,
        targetType: 'SubModel',
        details: { parentModelId: modelId, endpointUrl: existing.endpointUrl },
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Sub-model deleted successfully' });
  } catch (error) {
    console.error('Error deleting sub-model:', error);
    res.status(500).json({ error: 'Failed to delete sub-model' });
  }
});
