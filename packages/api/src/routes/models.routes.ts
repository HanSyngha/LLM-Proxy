/**
 * Models Routes
 *
 * 활성화된 LLM 모델 목록 조회 (Dashboard 사용자용)
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/dashboardAuth.js';

export const modelsRoutes = Router();

/**
 * GET /models
 * 활성화된 모든 모델 목록 반환
 * Returns: { models: [{ id, name, displayName, alias, maxTokens }] }
 */
modelsRoutes.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        alias: true,
        maxTokens: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { displayName: 'asc' },
      ],
    });

    res.json({ models });
  } catch (error) {
    console.error('List models error:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});
