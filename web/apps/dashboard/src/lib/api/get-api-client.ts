import type { ICoreApiClient } from './core-api-client';

let _client: ICoreApiClient | null = null;

export function getApiClient(): ICoreApiClient {
  if (_client) return _client;

  const apiUrl = process.env.CORE_API_URL;
  if (!apiUrl) {
    throw new Error('CORE_API_URL environment variable is required');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HttpApiClient } = require('./http-api-client') as typeof import('./http-api-client');
  _client = new HttpApiClient(apiUrl, async () => {
    const { getBackendToken } = await import('./get-backend-token');
    return getBackendToken();
  });

  return _client;
}

/** Reset the cached client — useful in tests. */
export function resetApiClient(): void {
  _client = null;
}
