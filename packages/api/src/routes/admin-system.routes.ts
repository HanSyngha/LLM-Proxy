import { Router, Response } from 'express';
import { prisma, redis } from '../index.js';
import { AuthenticatedRequest, requireWriteAccess } from '../middleware/dashboardAuth.js';
import { getEndpointStatus } from '../services/circuitBreaker.service.js';

export const adminSystemRoutes = Router();

// ============================================
// Helper: Health check a model endpoint
// ============================================
async function healthCheckEndpoint(
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
// System Health
// ============================================

/**
 * GET /admin/system/health - Overall system health
 */
adminSystemRoutes.get('/health', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // DB connectivity + latency
    const dbStart = Date.now();
    let dbHealthy = false;
    let dbLatencyMs = 0;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbLatencyMs = Date.now() - dbStart;
    }

    // Redis connectivity + latency
    const redisStart = Date.now();
    let redisHealthy = false;
    let redisLatencyMs = 0;
    try {
      await redis.ping();
      redisHealthy = true;
      redisLatencyMs = Date.now() - redisStart;
    } catch {
      redisLatencyMs = Date.now() - redisStart;
    }

    // Endpoint health summary
    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: { id: true, name: true, displayName: true, endpointUrl: true },
    });

    const endpointStatuses = await Promise.all(
      models.map(async (model) => {
        const status = await getEndpointStatus(model.endpointUrl);
        return {
          modelId: model.id,
          modelName: model.displayName || model.name,
          endpointUrl: model.endpointUrl,
          ...status,
        };
      })
    );

    const healthyEndpoints = endpointStatuses.filter(e => e.isHealthy).length;

    res.json({
      status: dbHealthy && redisHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        healthy: dbHealthy,
        latencyMs: dbLatencyMs,
      },
      redis: {
        healthy: redisHealthy,
        latencyMs: redisLatencyMs,
      },
      endpoints: {
        total: endpointStatuses.length,
        healthy: healthyEndpoints,
        unhealthy: endpointStatuses.length - healthyEndpoints,
        details: endpointStatuses,
      },
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({ error: 'Failed to check system health' });
  }
});

/**
 * GET /admin/system/endpoints - All model endpoints with circuit breaker status
 */
adminSystemRoutes.get('/endpoints', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await prisma.model.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        endpointUrl: true,
        enabled: true,
        subModels: {
          select: {
            id: true,
            modelName: true,
            endpointUrl: true,
            enabled: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const endpoints = await Promise.all(
      models.map(async (model) => {
        const mainStatus = await getEndpointStatus(model.endpointUrl);

        const subModelStatuses = await Promise.all(
          model.subModels.map(async (sub) => {
            const status = await getEndpointStatus(sub.endpointUrl);
            return {
              subModelId: sub.id,
              modelName: sub.modelName,
              endpointUrl: sub.endpointUrl,
              enabled: sub.enabled,
              ...status,
            };
          })
        );

        return {
          modelId: model.id,
          name: model.name,
          displayName: model.displayName,
          endpointUrl: model.endpointUrl,
          enabled: model.enabled,
          circuitBreaker: mainStatus,
          subModels: subModelStatuses,
        };
      })
    );

    res.json({ endpoints });
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    res.status(500).json({ error: 'Failed to fetch endpoints' });
  }
});

/**
 * POST /admin/system/endpoints/:modelId/check - Force health check on a model's endpoint
 */
adminSystemRoutes.post('/endpoints/:modelId/check', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { modelId } = req.params;

    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        name: true,
        displayName: true,
        endpointUrl: true,
        apiKey: true,
        extraHeaders: true,
      },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const result = await healthCheckEndpoint(
      model.endpointUrl,
      model.apiKey,
      model.extraHeaders as Record<string, string> | null,
      model.name
    );

    // Update EndpointHealth record
    await prisma.endpointHealth.upsert({
      where: { endpointUrl: model.endpointUrl },
      create: {
        endpointUrl: model.endpointUrl,
        modelId: model.id,
        isHealthy: result.success,
        consecutiveFails: result.success ? 0 : 1,
        lastCheckAt: new Date(),
        lastErrorAt: result.success ? undefined : new Date(),
        lastErrorMsg: result.error || undefined,
      },
      update: {
        isHealthy: result.success,
        consecutiveFails: result.success ? 0 : { increment: 1 },
        lastCheckAt: new Date(),
        ...(result.success
          ? {}
          : { lastErrorAt: new Date(), lastErrorMsg: result.error || undefined }),
      },
    });

    res.json({
      modelId: model.id,
      modelName: model.displayName || model.name,
      endpointUrl: model.endpointUrl,
      ...result,
    });
  } catch (error) {
    console.error('Error checking endpoint:', error);
    res.status(500).json({ error: 'Failed to check endpoint' });
  }
});

/**
 * POST /admin/system/endpoints/check-all - Health check all enabled models
 */
adminSystemRoutes.post('/endpoints/check-all', requireWriteAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        endpointUrl: true,
        apiKey: true,
        extraHeaders: true,
      },
    });

    const results = await Promise.all(
      models.map(async (model) => {
        const result = await healthCheckEndpoint(
          model.endpointUrl,
          model.apiKey,
          model.extraHeaders as Record<string, string> | null,
          model.name
        );

        // Update EndpointHealth record
        await prisma.endpointHealth.upsert({
          where: { endpointUrl: model.endpointUrl },
          create: {
            endpointUrl: model.endpointUrl,
            modelId: model.id,
            isHealthy: result.success,
            consecutiveFails: result.success ? 0 : 1,
            lastCheckAt: new Date(),
            lastErrorAt: result.success ? undefined : new Date(),
            lastErrorMsg: result.error || undefined,
          },
          update: {
            isHealthy: result.success,
            consecutiveFails: result.success ? 0 : { increment: 1 },
            lastCheckAt: new Date(),
            ...(result.success
              ? {}
              : { lastErrorAt: new Date(), lastErrorMsg: result.error || undefined }),
          },
        });

        return {
          modelId: model.id,
          modelName: model.displayName || model.name,
          endpointUrl: model.endpointUrl,
          ...result,
        };
      })
    );

    const healthy = results.filter(r => r.success).length;

    await prisma.auditLog.create({
      data: {
        adminId: req.adminId || undefined,
        loginid: req.user!.loginid,
        action: 'HEALTH_CHECK_ALL',
        targetType: 'Model',
        details: {
          totalModels: results.length,
          healthy,
          unhealthy: results.length - healthy,
        },
        ipAddress: req.ip,
      },
    });

    res.json({
      results,
      summary: {
        total: results.length,
        healthy,
        unhealthy: results.length - healthy,
      },
    });
  } catch (error) {
    console.error('Error checking all endpoints:', error);
    res.status(500).json({ error: 'Failed to check all endpoints' });
  }
});

/**
 * GET /admin/system/error-rates - Error rate per model in last hour and last day
 */
adminSystemRoutes.get('/error-rates', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourlyStats, dailyStats] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          model_name: string;
          total_requests: bigint;
          error_requests: bigint;
          error_rate: number;
        }>
      >`
        SELECT
          model_name,
          COUNT(*) AS total_requests,
          COUNT(*) FILTER (WHERE status_code >= 400) AS error_requests,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status_code >= 400)::numeric / COUNT(*)::numeric * 100, 2)
            ELSE 0
          END AS error_rate
        FROM request_logs
        WHERE timestamp >= ${oneHourAgo}
        GROUP BY model_name
        ORDER BY error_rate DESC
      `,
      prisma.$queryRaw<
        Array<{
          model_name: string;
          total_requests: bigint;
          error_requests: bigint;
          error_rate: number;
        }>
      >`
        SELECT
          model_name,
          COUNT(*) AS total_requests,
          COUNT(*) FILTER (WHERE status_code >= 400) AS error_requests,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status_code >= 400)::numeric / COUNT(*)::numeric * 100, 2)
            ELSE 0
          END AS error_rate
        FROM request_logs
        WHERE timestamp >= ${oneDayAgo}
        GROUP BY model_name
        ORDER BY error_rate DESC
      `,
    ]);

    const hourly = hourlyStats.map(row => ({
      modelName: row.model_name,
      totalRequests: Number(row.total_requests),
      errorRequests: Number(row.error_requests),
      errorRate: Number(row.error_rate),
    }));

    const daily = dailyStats.map(row => ({
      modelName: row.model_name,
      totalRequests: Number(row.total_requests),
      errorRequests: Number(row.error_requests),
      errorRate: Number(row.error_rate),
    }));

    res.json({ hourly, daily });
  } catch (error) {
    console.error('Error fetching error rates:', error);
    res.status(500).json({ error: 'Failed to fetch error rates' });
  }
});
