import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// Mock getApiClient
const mockGetMemoryInsights = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getMemoryInsights: mockGetMemoryInsights,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./memory-insights-handler');

function makeRequest(url = 'http://localhost:3001/api/memory/insights'): Request {
  return new Request(url, { method: 'GET' });
}

describe('memory-insights-handler', () => {
  // Core's live shape (see core/src/modules/memory/infra/memory.routes.ts)
  const mockCoreInsights = {
    topology: {
      services: [{ type: 'service', text: 'api-gateway depends on postgres' }],
    },
    investigations: {
      recent: [{ type: 'incident', text: 'database latency spike' }],
    },
    remediations: {
      outcomes: [{ type: 'fix', text: 'restarted auth-svc → recovery in 2m' }],
    },
  };

  beforeEach(() => {
    mockGetMemoryInsights.mockResolvedValue(mockCoreInsights);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flattens Core grouped memories into `{ insights: [...] }`', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = (await response.json()) as {
      insights: Array<{
        id: string;
        title: string;
        summary: string;
        category: 'topology' | 'pattern' | 'remediation' | 'anomaly';
        severity: 'info';
        confidence: number;
        createdAt: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(mockGetMemoryInsights).toHaveBeenCalledOnce();
    expect(data.insights).toHaveLength(3);

    // ids use prefix + index
    expect(data.insights.map((i) => i.id)).toEqual([
      'topology-0',
      'investigation-0',
      'remediation-0',
    ]);

    // summaries (full text)
    expect(data.insights.map((i) => i.summary)).toEqual([
      'api-gateway depends on postgres',
      'database latency spike',
      'restarted auth-svc → recovery in 2m',
    ]);

    // titles = first 80 chars of text
    expect(data.insights.map((i) => i.title)).toEqual([
      'api-gateway depends on postgres',
      'database latency spike',
      'restarted auth-svc → recovery in 2m',
    ]);

    // category mapping: topology→topology, investigation→pattern, remediation→remediation
    expect(data.insights.map((i) => i.category)).toEqual(['topology', 'pattern', 'remediation']);

    // severity is always 'info'
    expect(data.insights.every((i) => i.severity === 'info')).toBe(true);

    // confidence is always 1 when not provided
    expect(data.insights.every((i) => i.confidence === 1)).toBe(true);

    // createdAt is a string (ISO date)
    expect(data.insights.every((i) => typeof i.createdAt === 'string')).toBe(true);
  });

  it('forwards `{ insights }` as-is when Core already returns the flat shape', async () => {
    const flat = {
      insights: [{ id: 'a', summary: 'already flat', confidence: 0.9 }],
    };
    mockGetMemoryInsights.mockResolvedValueOnce(flat);

    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    // The handler normalises even the flat shape into the full Insight contract.
    expect(data.insights).toHaveLength(1);
    expect(data.insights[0].id).toBe('a');
    expect(data.insights[0].summary).toBe('already flat');
    expect(data.insights[0].title).toBe('already flat');
    expect(data.insights[0].category).toBe('pattern');
    expect(data.insights[0].severity).toBe('info');
    expect(data.insights[0].confidence).toBe(0.9);
    expect(typeof data.insights[0].createdAt).toBe('string');
  });

  it('propagates errors from getMemoryInsights', async () => {
    mockGetMemoryInsights.mockRejectedValue(new Error('Core API unavailable'));

    const req = makeRequest();
    await expect((GET as Function)(req, {})).rejects.toThrow('Core API unavailable');
  });
});

describe('memory-insights-handler — auth contract', () => {
  it('withAuth is used to wrap the handler', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./memory-insights-handler.ts', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('withAuth');
    expect(source).toContain('getMemoryInsights');
  });
});
