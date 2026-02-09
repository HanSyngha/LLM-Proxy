import { Request, Response, NextFunction } from 'express';

function safeDecode(value: string | undefined): string {
  if (!value) return '';
  try {
    if (value.includes('%')) return decodeURIComponent(value);
    return value;
  } catch {
    return value;
  }
}

function decodeAuthHeader(authHeader: string | undefined): Record<string, unknown> | null {
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // API Token (sk-xxx)
  if (token.startsWith('sk-')) {
    return { type: 'api_token', prefix: token.substring(0, 12) + '...' };
  }

  // SSO token
  if (token.startsWith('sso.')) {
    try {
      const binaryString = Buffer.from(token.substring(4), 'base64').toString('binary');
      const jsonString = decodeURIComponent(
        binaryString.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      const payload = JSON.parse(jsonString);
      return { type: 'sso', loginid: payload.loginid };
    } catch {
      return { type: 'sso', error: 'decode_failed' };
    }
  }

  // JWT
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payloadBase64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      return { type: 'jwt', loginid: payload.loginid || payload.sub || '' };
    } catch {
      return { type: 'jwt', error: 'decode_failed' };
    }
  }

  return { type: 'unknown' };
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authInfo = decodeAuthHeader(req.headers['authorization'] as string);
  const model = req.body?.model || '';
  const stream = req.body?.stream || false;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    const logLine = `[Request] ${req.method} ${req.originalUrl || req.url} ${status} ${duration}ms` +
      (model ? ` | model=${model}` : '') +
      (stream ? ` | stream=${stream}` : '') +
      (authInfo ? ` | auth=${authInfo.type}(${authInfo.loginid || authInfo.prefix || ''})` : '');

    if (status >= 500) {
      console.error(logLine);
    } else if (status >= 400) {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}
