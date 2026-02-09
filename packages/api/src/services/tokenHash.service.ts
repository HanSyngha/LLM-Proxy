import crypto from 'crypto';

const PREFIX_LENGTH = 12; // "sk-" + 9 random chars

export function generateApiToken(): { rawKey: string; prefix: string; hashedKey: string } {
  const randomBytes = crypto.randomBytes(32);
  const base62Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (const byte of randomBytes) {
    randomPart += base62Chars[byte % base62Chars.length];
  }

  const rawKey = `sk-${randomPart}`;
  const prefix = rawKey.substring(0, PREFIX_LENGTH);
  const hashedKey = hashApiToken(rawKey);

  return { rawKey, prefix, hashedKey };
}

export function hashApiToken(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function extractPrefix(rawKey: string): string {
  return rawKey.substring(0, PREFIX_LENGTH);
}
