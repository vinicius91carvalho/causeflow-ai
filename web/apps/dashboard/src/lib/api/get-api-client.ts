import type { ICoreApiClient } from './core-api-client';

let _client: ICoreApiClient | null = null;

export function getApiClient(): ICoreApiClient {
  if (_client) return _client;

  const apiUrl = process.env.CORE_API_URL?.trim();

  if (!apiUrl) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockApiClient } = require('./mock-api-client') as typeof import('./mock-api-client');
    _client = new MockApiClient();
    return _client;
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
