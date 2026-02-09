import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { hashApiToken, extractPrefix } from '../services/tokenHash.service.js';

export interface TokenAuthenticatedRequest extends Request {
  user?: {
    id: string;
    loginid: string;
    username: string;
    deptname: string;
    businessUnit: string | null;
  };
  apiToken?: {
    id: string;
    name: string;
    userId: string;
    rpmLimit: number | null;
    tpmLimit: number | null;
    tphLimit: number | null;
    tpdLimit: number | null;
    monthlyOutputTokenBudget: number | null;
    allowedModels: string[];
  };
  apiTokenId?: string;
  userId?: string;
}

export async function authenticateApiToken(
  req: TokenAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { type: 'authentication_error', message: 'Missing or invalid Authorization header. Use: Bearer sk-xxx' },
    });
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith('sk-')) {
    res.status(401).json({
      error: { type: 'authentication_error', message: 'Invalid API key format. Keys must start with sk-' },
    });
    return;
  }

  try {
    const prefix = extractPrefix(rawKey);
    const token = await prisma.apiToken.findUnique({
      where: { prefix },
      include: {
        user: {
          select: { id: true, loginid: true, username: true, deptname: true, businessUnit: true, isBanned: true },
        },
      },
    });

    if (!token) {
      res.status(401).json({
        error: { type: 'authentication_error', message: 'Invalid API key' },
      });
      return;
    }

    // Verify full hash
    const hashedKey = hashApiToken(rawKey);
    if (hashedKey !== token.hashedKey) {
      res.status(401).json({
        error: { type: 'authentication_error', message: 'Invalid API key' },
      });
      return;
    }

    // Check enabled
    if (!token.enabled) {
      res.status(401).json({
        error: { type: 'authentication_error', message: 'API key is disabled' },
      });
      return;
    }

    // Check expiration
    if (token.expiresAt && new Date() > token.expiresAt) {
      res.status(401).json({
        error: { type: 'authentication_error', message: 'API key has expired' },
      });
      return;
    }

    // Check user banned
    if (token.user.isBanned) {
      res.status(403).json({
        error: { type: 'permission_error', message: 'Your account has been suspended' },
      });
      return;
    }

    // Attach to request
    req.user = {
      id: token.user.id,
      loginid: token.user.loginid,
      username: token.user.username,
      deptname: token.user.deptname,
      businessUnit: token.user.businessUnit,
    };
    req.apiToken = {
      id: token.id,
      name: token.name,
      userId: token.userId,
      rpmLimit: token.rpmLimit,
      tpmLimit: token.tpmLimit,
      tphLimit: token.tphLimit,
      tpdLimit: token.tpdLimit,
      monthlyOutputTokenBudget: token.monthlyOutputTokenBudget,
      allowedModels: token.allowedModels,
    };
    req.apiTokenId = token.id;
    req.userId = token.user.id;

    // Update lastUsedAt (fire-and-forget)
    prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // Update user lastActive (fire-and-forget)
    prisma.user.update({
      where: { id: token.user.id },
      data: { lastActive: new Date() },
    }).catch(() => {});

    next();
  } catch (error) {
    console.error('Token auth error:', error);
    res.status(500).json({
      error: { type: 'server_error', message: 'Authentication failed' },
    });
  }
}
