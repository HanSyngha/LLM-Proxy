/**
 * LLM Gateway API Server
 *
 * Dual-port Express server:
 * - Port 3000: LLM Proxy (API Token auth)
 * - Port 3001: Dashboard API (SSO/JWT auth)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { createRedisClient } from './services/redis.service.js';
import { requestLogger } from './middleware/requestLogger.js';
import { proxyRoutes } from './routes/proxy.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { tokenRoutes } from './routes/token.routes.js';
import { myUsageRoutes } from './routes/my-usage.routes.js';
import { modelsRoutes } from './routes/models.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { holidaysRoutes } from './routes/holidays.routes.js';
import { llmTestRoutes } from './routes/llm-test.routes.js';
import { startLLMTestScheduler, stopLLMTestScheduler } from './services/llm-test.service.js';

import 'dotenv/config';

const PROXY_PORT = process.env['PROXY_PORT'] || 3000;
const DASHBOARD_PORT = process.env['DASHBOARD_PORT'] || 3001;

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = createRedisClient();

// ============================================
// Proxy App (Port 3000) - API Token auth
// ============================================
const proxyApp = express();
proxyApp.set('trust proxy', 1);
proxyApp.use(helmet());
proxyApp.use(cors());
proxyApp.use(express.json({ limit: '50mb' }));
proxyApp.use(requestLogger);
proxyApp.use(morgan('combined'));

proxyApp.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
  }
});

proxyApp.use('/v1', proxyRoutes);

proxyApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Proxy error:', err);
  res.status(500).json({
    error: { type: 'server_error', message: 'Internal server error' },
  });
});

proxyApp.use((_req, res) => {
  res.status(404).json({ error: 'Not found. Use /v1/ endpoints.' });
});

// ============================================
// Dashboard App (Port 3001) - SSO/JWT auth
// ============================================
const dashboardApp = express();
dashboardApp.set('trust proxy', 1);
dashboardApp.use(helmet());
dashboardApp.use(cors({
  origin: process.env['CORS_ORIGIN'] || true,
  credentials: true,
}));
dashboardApp.use(express.json({ limit: '10mb' }));
dashboardApp.use(requestLogger);
dashboardApp.use(morgan('combined'));

dashboardApp.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
  }
});

// Dashboard routes
dashboardApp.use('/auth', authRoutes);
dashboardApp.use('/tokens', tokenRoutes);
dashboardApp.use('/my-usage', myUsageRoutes);
dashboardApp.use('/models', modelsRoutes);
dashboardApp.use('/admin', adminRoutes);
dashboardApp.use('/holidays', holidaysRoutes);
dashboardApp.use('/llm-test', llmTestRoutes);

dashboardApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? err.message : undefined,
  });
});

dashboardApp.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================
// Startup
// ============================================
async function ensureDefaultRateLimits() {
  const existing = await prisma.rateLimitConfig.findUnique({ where: { key: 'default' } });
  if (!existing) {
    await prisma.rateLimitConfig.create({
      data: {
        key: 'default',
        rpmLimit: parseInt(process.env['DEFAULT_RPM'] || '60'),
        tpmLimit: parseInt(process.env['DEFAULT_TPM'] || '100000'),
        tphLimit: parseInt(process.env['DEFAULT_TPH'] || '1000000'),
        tpdLimit: parseInt(process.env['DEFAULT_TPD'] || '10000000'),
      },
    });
    console.log('[RateLimit] Default rate limits created');
  }
}

async function shutdown() {
  console.log('Shutting down gracefully...');
  stopLLMTestScheduler();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    await redis.ping();
    console.log('Redis connected');

    await ensureDefaultRateLimits();

    proxyApp.listen(PROXY_PORT, () => {
      console.log(`LLM Proxy API running on port ${PROXY_PORT}`);
    });

    dashboardApp.listen(DASHBOARD_PORT, () => {
      console.log(`Dashboard API running on port ${DASHBOARD_PORT}`);
    });

    // Start LLM Test Scheduler
    startLLMTestScheduler();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
