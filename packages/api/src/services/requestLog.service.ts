import { prisma } from '../index.js';

// Strip base64 image data from request body for storage
function sanitizeRequestBody(body: any): string {
  if (!body) return '';
  try {
    const str = JSON.stringify(body, (key, value) => {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        return `[BASE64_IMAGE:${value.length} chars]`;
      }
      if (key === 'image_url' && typeof value === 'object' && value?.url?.startsWith('data:')) {
        return { ...value, url: `[BASE64_IMAGE:${value.url.length} chars]` };
      }
      return value;
    });
    return str.substring(0, 50000); // 50KB max
  } catch {
    return '[serialization_error]';
  }
}

function truncateResponse(body: any): string {
  if (!body) return '';
  try {
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    return str.substring(0, 10000); // 10KB max
  } catch {
    return '[serialization_error]';
  }
}

export async function logRequest(params: {
  apiTokenId: string | null;
  userId: string | null;
  modelName: string;
  resolvedModel: string | null;
  method: string;
  path: string;
  statusCode: number;
  requestBody: any;
  responseBody: any;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  stream: boolean;
}): Promise<void> {
  try {
    await prisma.requestLog.create({
      data: {
        apiTokenId: params.apiTokenId,
        userId: params.userId,
        modelName: params.modelName,
        resolvedModel: params.resolvedModel,
        method: params.method,
        path: params.path,
        statusCode: params.statusCode,
        requestBody: sanitizeRequestBody(params.requestBody),
        responseBody: truncateResponse(params.responseBody),
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs: params.latencyMs,
        errorMessage: params.errorMessage,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        stream: params.stream,
      },
    });
  } catch (error) {
    console.error('[RequestLog] Failed to log request:', error);
  }
}

export async function cleanupOldLogs(retentionDays: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = await prisma.requestLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
  console.log(`[RequestLog] Cleaned up ${result.count} logs older than ${retentionDays} days`);
  return result.count;
}
