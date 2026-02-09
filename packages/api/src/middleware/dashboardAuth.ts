import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

export interface JWTPayload {
  loginid: string;
  deptname: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userId?: string;
  isAdmin?: boolean;
  adminRole?: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  isDeveloper?: boolean;
  adminId?: string;
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-jwt-secret-change-in-production';

function getDevelopers(): string[] {
  return (process.env['DEVELOPERS'] || '').split(',').map(d => d.trim()).filter(Boolean);
}

export function isDeveloper(loginid: string): boolean {
  return getDevelopers().includes(loginid);
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const internalPayload = verifyInternalToken(token);
    if (internalPayload && internalPayload.loginid) {
      req.user = internalPayload;
      next();
      return;
    }

    if (token.startsWith('sso.')) {
      const ssoData = decodeSSOToken(token.substring(4));
      if (ssoData && ssoData.loginid) {
        req.user = ssoData;
        next();
        return;
      }
    }

    // No valid token found - reject
    res.status(403).json({ error: 'Invalid token' });
    return;
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    if (isDeveloper(req.user.loginid)) {
      req.isAdmin = true;
      req.isDeveloper = true;
      req.adminRole = 'SUPER_ADMIN';
      next();
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { loginid: req.user.loginid } });
    if (!admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.isAdmin = true;
    req.isDeveloper = false;
    req.adminRole = admin.role as AuthenticatedRequest['adminRole'];
    req.adminId = admin.id;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    if (isDeveloper(req.user.loginid)) {
      req.isAdmin = true;
      req.isDeveloper = true;
      req.adminRole = 'SUPER_ADMIN';
      next();
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { loginid: req.user.loginid } });
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    req.isAdmin = true;
    req.isDeveloper = false;
    req.adminRole = admin.role as 'SUPER_ADMIN';
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireWriteAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.adminRole === 'VIEWER') {
    res.status(403).json({ error: 'Read-only access. Write operations are not permitted.' });
    return;
  }
  next();
}

function safeDecodeURIComponent(str: string): string {
  if (!str) return '';
  try {
    return str.includes('%') ? decodeURIComponent(str) : str;
  } catch {
    return str;
  }
}

function decodeSSOToken(base64Token: string): JWTPayload | null {
  try {
    const binaryString = Buffer.from(base64Token, 'base64').toString('binary');
    const jsonString = decodeURIComponent(
      binaryString.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonString);
    return {
      loginid: safeDecodeURIComponent(payload.loginid || ''),
      deptname: safeDecodeURIComponent(payload.deptname || ''),
      username: safeDecodeURIComponent(payload.username || ''),
    };
  } catch {
    return null;
  }
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
    return {
      loginid: safeDecodeURIComponent(payload.loginid || payload.sub || payload.user_id || ''),
      deptname: safeDecodeURIComponent(payload.deptname || payload.department || ''),
      username: safeDecodeURIComponent(payload.username || payload.name || ''),
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyInternalToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
