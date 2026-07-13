import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncidentAnalytics } from './core-api-types';
import { CoreApiError, HttpApiClient } from './http-api-client';

/**
 * Tests for HttpApiClient — focused on the Core wire → dashboard domain
 * schema remap for incident analytics (see PRD sprint 01). Core returns
 * { total, openCount, mttrMinutes, ... } but the dashboard consumes the
 * domain shape { totalIncidents, openIncidents, mttr, ... }. The remap
 * MUST happen inside the client so every consumer sees the domain shape.
 */

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const mock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function createClient() {
  return new HttpApiClient('https://core.test', async () => 'fake-token');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HttpApiClient.getIncidentAnalytics — schema remap', () => {
  it('remaps all wire fields to the dashboard IncidentAnalytics shape', async () => {
    const wire = {
      total: 42,
      openCount: 7,
      mttrMinutes: 135,
      byStatus: { open: 7, resolved: 30, triaging: 5 },
      bySeverity: { high: 10, medium: 20, low: 12 },
      totalCostUsd: 1234.5,
      avgCostUsd: 29.39,
    };
    const fetchMock = mockFetchOnce(wire);

    const client = createClient();
    const result: IncidentAnalytics = await client.getIncidentAnalytics();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/analytics/incidents');

    expect(result).toEqual({
      totalIncidents: 42,
      openIncidents: 7,
      mttr: 135,
      byStatus: { open: 7, resolved: 30, triaging: 5 },
      bySeverity: { high: 10, medium: 20, low: 12 },
      totalCostUsd: 1234.5,
      avgCostUsd: 29.39,
    });

    // Assert wire field names do NOT leak into the domain shape.
    const shape = result as unknown as Record<string, unknown>;
    expect(shape.total).toBeUndefined();
    expect(shape.openCount).toBeUndefined();
    expect(shape.mttrMinutes).toBeUndefined();
  });

  it('maps mttrMinutes: null → mttr: 0', async () => {
    mockFetchOnce({
      total: 0,
      openCount: 0,
      mttrMinutes: null,
      byStatus: {},
      bySeverity: {},
      totalCostUsd: 0,
      avgCostUsd: null,
    });

    const result = await createClient().getIncidentAnalytics();

    expect(result.mttr).toBe(0);
    expect(result.avgCostUsd).toBeNull();
  });

  it('preserves byStatus, bySeverity, totalCostUsd, avgCostUsd exactly', async () => {
    const byStatus = { open: 1, triaging: 2, investigating: 3, resolved: 4 };
    const bySeverity = { critical: 1, high: 2, medium: 3, low: 4 };
    mockFetchOnce({
      total: 10,
      openCount: 6,
      mttrMinutes: 60,
      byStatus,
      bySeverity,
      totalCostUsd: 500,
      avgCostUsd: 50,
    });

    const result = await createClient().getIncidentAnalytics();

    expect(result.byStatus).toEqual(byStatus);
    expect(result.bySeverity).toEqual(bySeverity);
    expect(result.totalCostUsd).toBe(500);
    expect(result.avgCostUsd).toBe(50);
  });
});

describe('HttpApiClient.healthCheck', () => {
  it('calls GET /health and returns HealthStatus', async () => {
    const fetchMock = mockFetchOnce({
      status: 'ok',
      version: '1.2.3',
      timestamp: '2026-04-07T00:00:00.000Z',
    });

    const result = await createClient().healthCheck();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://core.test/health');
    expect(result).toEqual({
      status: 'ok',
      version: '1.2.3',
      timestamp: '2026-04-07T00:00:00.000Z',
    });
  });
});

describe('HttpApiClient.request — Core error messages (AC-072)', () => {
  it('prefers body.message over body.error for ValidationError responses', async () => {
    mockFetchText(
      {
        error: 'VALIDATION_ERROR',
        message: 'Stub upstream unreachable at http://causeflow-test-app:5190: ECONNREFUSED',
      },
      { ok: false, status: 400 },
    );

    await expect(createClient().probeStubIntegration()).rejects.toMatchObject({
      name: 'CoreApiError',
      status: 400,
      message: 'Stub upstream unreachable at http://causeflow-test-app:5190: ECONNREFUSED',
    });
  });
});

// Shared fixture for UserSettings tests
const userSettingsFixture = {
  theme: 'dark' as const,
  locale: 'en' as const,
  notifications: {
    emailOnComplete: true,
    emailOnError: true,
    slackOnComplete: false,
    slackOnError: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z',
};

describe('HttpApiClient.getUserSettings', () => {
  it('calls GET /v1/users/:userId/settings with Bearer token', async () => {
    const fetchMock = mockFetchOnce(userSettingsFixture);

    await createClient().getUserSettings('user-abc');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://core.test/v1/users/user-abc/settings');
    expect((init as RequestInit).method).toBeUndefined(); // defaults to GET
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer fake-token',
    );
  });

  it('returns the parsed UserSettings response', async () => {
    mockFetchOnce(userSettingsFixture);
    const result = await createClient().getUserSettings('user-abc');
    expect(result).toEqual(userSettingsFixture);
  });

  it('URL-encodes userId', async () => {
    const fetchMock = mockFetchOnce(userSettingsFixture);
    await createClient().getUserSettings('user/with/slashes');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://core.test/v1/users/user%2Fwith%2Fslashes/settings');
  });
});

// Helper that mocks fetch with a text() response (fireTestError uses res.text(), not res.json())
function mockFetchText(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const mock = vi.fn().mockResolvedValue({
    ok: init.ok ?? ((init.status ?? 200) >= 200 && (init.status ?? 200) < 300),
    status: init.status ?? 200,
    statusText: 'OK',
    text: () => Promise.resolve(bodyStr),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('HttpApiClient.fireTestError — AD-7/AD-8 contract', () => {
  it('calls POST /v1/admin/fire-test-errors with Bearer token', async () => {
    const fetchMock = mockFetchText(
      { error: 'TestErrorFired', traceId: 'trace-abc' },
      { ok: false, status: 500 },
    );

    await createClient().fireTestError();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    // Fix 1: URL MUST include /v1 prefix
    expect(url).toBe('https://core.test/v1/admin/fire-test-errors');
    expect(url).toContain('/v1/admin/fire-test-errors');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer fake-token',
    );
  });

  it('treats HTTP 500 + TestErrorFired body as success — returns triggered: true with traceId', async () => {
    mockFetchText({ error: 'TestErrorFired', traceId: 'trace-xyz' }, { ok: false, status: 500 });

    const result = await createClient().fireTestError();

    expect(result).toEqual({ triggered: true, traceId: 'trace-xyz' });
  });

  it('treats HTTP 500 + other error body as failure — throws CoreApiError', async () => {
    mockFetchText({ error: 'InternalServerError' }, { ok: false, status: 500 });

    await expect(createClient().fireTestError()).rejects.toMatchObject({
      name: 'CoreApiError',
      status: 500,
    });
  });

  it('treats non-2xx non-TestErrorFired as failure — throws CoreApiError with correct status', async () => {
    mockFetchText({ error: 'Forbidden' }, { ok: false, status: 403 });

    await expect(createClient().fireTestError()).rejects.toMatchObject({
      name: 'CoreApiError',
      status: 403,
    });
  });

  it('Fix 3: throws CoreApiError on unexpected 2xx — per contract, success is strictly 5xx+TestErrorFired', async () => {
    mockFetchText({ ok: true }, { ok: true, status: 200 });

    await expect(createClient().fireTestError()).rejects.toMatchObject({
      name: 'CoreApiError',
      status: 200,
      message: expect.stringContaining('Unexpected 2xx'),
    });
  });

  it('Fix 2: throws CoreApiError on non-JSON body (HTML edge error page) — not an unhandled rejection', async () => {
    const htmlBody = '<html><body>502 Bad Gateway</body></html>';
    mockFetchText(htmlBody, { ok: false, status: 502 });

    await expect(createClient().fireTestError()).rejects.toMatchObject({
      name: 'CoreApiError',
      status: 502,
      message: expect.stringContaining('Non-JSON response'),
    });
  });

  it('does NOT include tenantId in the request (W4 invariant)', async () => {
    const fetchMock = mockFetchText(
      { error: 'TestErrorFired', traceId: 'x' },
      { ok: false, status: 500 },
    );

    await createClient().fireTestError();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('tenantId');
    const reqBody = (init as RequestInit).body;
    if (reqBody) {
      expect(String(reqBody)).not.toContain('tenantId');
    }
  });
});

describe('HttpApiClient.updateUserSettings', () => {
  it('calls PATCH /v1/users/:userId/settings with Bearer token', async () => {
    const fetchMock = mockFetchOnce(userSettingsFixture);
    const input = { locale: 'pt-br' as const };

    await createClient().updateUserSettings('user-abc', input);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://core.test/v1/users/user-abc/settings');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer fake-token',
    );
  });

  it('sends the input body as JSON', async () => {
    const fetchMock = mockFetchOnce(userSettingsFixture);
    const input = { theme: 'light' as const, locale: 'pt-br' as const };

    await createClient().updateUserSettings('user-abc', input);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
  });

  it('returns the updated UserSettings from the response', async () => {
    const updated = { ...userSettingsFixture, locale: 'pt-br' as const };
    mockFetchOnce(updated);

    const result = await createClient().updateUserSettings('user-abc', { locale: 'pt-br' });
    expect(result.locale).toBe('pt-br');
    expect(result).toEqual(updated);
  });

  it('accepts partial input (only notifications)', async () => {
    const fetchMock = mockFetchOnce(userSettingsFixture);
    const input = {
      notifications: {
        emailOnComplete: false,
        emailOnError: true,
        slackOnComplete: true,
        slackOnError: false,
      },
    };

    await createClient().updateUserSettings('user-abc', input);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
  });
});
