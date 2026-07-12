export const sensitiveLogPaths = [
  '/auth',
  '/auth/*',
  '/webhooks/clerk',
  '/oauth',
  '/oauth/*',
  '/v1/integrations/credentials',
  '/v1/integrations/credentials/*',
  '/v1/integrations/test-connection',
  '/v1/billing/webhook',
  '/v1/api-keys',
  '/v1/api-keys/*',
  '/v1/relay/tokens',
  '/v1/relay/tokens/*',
] as const;

export function isSensitivePath(path: string): boolean {
  for (const pattern of sensitiveLogPaths) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + '/')) return true;
    } else if (path === pattern) {
      return true;
    }
  }
  return false;
}

export const silentLogPaths = [
  '/health',
  '/health/detailed',
  '/',
  '/favicon.ico',
  '/v1/notifications/stream',
] as const;

export function isSilentPath(path: string): boolean {
  return silentLogPaths.some((p) => path === p);
}
