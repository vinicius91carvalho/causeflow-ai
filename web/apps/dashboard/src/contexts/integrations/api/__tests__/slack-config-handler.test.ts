import type { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SlackConfigResponse } from '@/lib/api/core-api-types';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: NextRequest) => Promise<NextResponse>) => handler,
}));

const mockGetSlackConfig = vi.fn();
const mockUpdateSlackConfig = vi.fn();
const mockDeleteSlackOAuth = vi.fn();
const mockTestSlackConnection = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getSlackConfig: mockGetSlackConfig,
    updateSlackConfig: mockUpdateSlackConfig,
    deleteSlackOAuth: mockDeleteSlackOAuth,
    testSlackConnection: mockTestSlackConnection,
  }),
}));

import {
  handleDeleteSlackOAuth,
  handleGetSlackConfig,
  handleTestSlack,
  handleUpdateSlackConfig,
} from '../slack-config-handler';

function makeRequest(method: string, body?: unknown): NextRequest {
  return {
    method,
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleGetSlackConfig', () => {
  it('returns SlackConfigResponse from api client', async () => {
    const config: SlackConfigResponse = {
      connected: true,
      channel: '#incidents',
      workspaceName: 'Acme',
    };
    mockGetSlackConfig.mockResolvedValue(config);

    const req = makeRequest('GET');
    const res = await handleGetSlackConfig(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(config);
    expect(mockGetSlackConfig).toHaveBeenCalledOnce();
  });

  it('returns 500 on api client error', async () => {
    mockGetSlackConfig.mockRejectedValue(new Error('upstream error'));

    const req = makeRequest('GET');
    const res = await handleGetSlackConfig(req);

    expect(res.status).toBe(500);
  });
});

describe('handleUpdateSlackConfig', () => {
  it('forwards channel to updateSlackConfig and returns result', async () => {
    const updated: SlackConfigResponse = { connected: true, channel: '#alerts' };
    mockUpdateSlackConfig.mockResolvedValue(updated);

    const req = makeRequest('PATCH', { channel: '#alerts' });
    const res = await handleUpdateSlackConfig(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(updated);
    expect(mockUpdateSlackConfig).toHaveBeenCalledWith({ channel: '#alerts' });
  });

  it('returns 400 when channel is missing', async () => {
    const req = makeRequest('PATCH', {});
    const res = await handleUpdateSlackConfig(req);

    expect(res.status).toBe(400);
    expect(mockUpdateSlackConfig).not.toHaveBeenCalled();
  });

  it('returns 500 on api client error', async () => {
    mockUpdateSlackConfig.mockRejectedValue(new Error('upstream error'));

    const req = makeRequest('PATCH', { channel: '#incidents' });
    const res = await handleUpdateSlackConfig(req);

    expect(res.status).toBe(500);
  });
});

describe('handleDeleteSlackOAuth', () => {
  it('calls deleteSlackOAuth and returns 204', async () => {
    mockDeleteSlackOAuth.mockResolvedValue(undefined);

    const req = makeRequest('DELETE');
    const res = await handleDeleteSlackOAuth(req);

    expect(res.status).toBe(204);
    expect(mockDeleteSlackOAuth).toHaveBeenCalledOnce();
  });

  it('returns 500 on api client error', async () => {
    mockDeleteSlackOAuth.mockRejectedValue(new Error('upstream error'));

    const req = makeRequest('DELETE');
    const res = await handleDeleteSlackOAuth(req);

    expect(res.status).toBe(500);
  });
});

describe('handleTestSlack', () => {
  it('calls testSlackConnection and returns ok:true on success', async () => {
    mockTestSlackConnection.mockResolvedValue({ ok: true });

    const req = makeRequest('POST');
    const res = await handleTestSlack(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockTestSlackConnection).toHaveBeenCalledOnce();
  });

  it('returns ok:false with error field when test fails', async () => {
    mockTestSlackConnection.mockResolvedValue({ ok: false, error: 'channel_not_found' });

    const req = makeRequest('POST');
    const res = await handleTestSlack(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('channel_not_found');
  });

  it('returns 500 on api client error', async () => {
    mockTestSlackConnection.mockRejectedValue(new Error('upstream error'));

    const req = makeRequest('POST');
    const res = await handleTestSlack(req);

    expect(res.status).toBe(500);
  });
});
