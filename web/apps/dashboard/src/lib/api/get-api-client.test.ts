import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clientConstructors = vi.hoisted(() => ({
  mockCalls: 0,
  httpCalls: 0,
}));

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require('node:module') as typeof import('node:module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (this: NodeModule, id: string) {
    if (id === './mock-api-client') {
      return {
        MockApiClient: class MockApiClient {
          constructor() {
            clientConstructors.mockCalls += 1;
          }
        },
      };
    }

    if (id === './http-api-client') {
      return {
        HttpApiClient: class HttpApiClient {
          constructor(_url: string, _tokenFn: () => Promise<string>) {
            clientConstructors.httpCalls += 1;
          }
        },
      };
    }

    return originalRequire.call(this, id);
  };
});

import { getApiClient, resetApiClient } from './get-api-client';

describe('getApiClient', () => {
  const originalCoreApiUrl = process.env.CORE_API_URL;

  beforeEach(() => {
    resetApiClient();
    clientConstructors.mockCalls = 0;
    clientConstructors.httpCalls = 0;
  });

  afterEach(() => {
    resetApiClient();
    if (originalCoreApiUrl === undefined) {
      delete process.env.CORE_API_URL;
    } else {
      process.env.CORE_API_URL = originalCoreApiUrl;
    }
  });

  it('selects MockApiClient when CORE_API_URL is unset', () => {
    delete process.env.CORE_API_URL;
    const client = getApiClient();
    expect(client.constructor.name).toBe('MockApiClient');
    expect(clientConstructors.mockCalls).toBe(1);
    expect(clientConstructors.httpCalls).toBe(0);
  });

  it('selects MockApiClient when CORE_API_URL is blank or whitespace', () => {
    process.env.CORE_API_URL = '   ';
    const client = getApiClient();
    expect(client.constructor.name).toBe('MockApiClient');
    expect(clientConstructors.mockCalls).toBe(1);
    expect(clientConstructors.httpCalls).toBe(0);
  });

  it('selects HttpApiClient when CORE_API_URL is set', () => {
    process.env.CORE_API_URL = 'https://api.example.com';
    const client = getApiClient();
    expect(client.constructor.name).toBe('HttpApiClient');
    expect(clientConstructors.httpCalls).toBe(1);
    expect(clientConstructors.mockCalls).toBe(0);
  });

  it('resetApiClient clears the cached client between cases', () => {
    delete process.env.CORE_API_URL;
    getApiClient();
    expect(clientConstructors.mockCalls).toBe(1);

    resetApiClient();
    process.env.CORE_API_URL = 'https://api.example.com';
    getApiClient();
    expect(clientConstructors.httpCalls).toBe(1);
    expect(clientConstructors.mockCalls).toBe(1);
  });
});
