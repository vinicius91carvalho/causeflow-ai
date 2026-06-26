import { describe, it, expect } from 'vitest';
import { checkHealth } from '../check-health.js';
import { TimeoutError, VerifyError } from '../lib/errors.js';
import type { HealthResponse } from '../lib/types.js';

const noopSleep = async (): Promise<void> => undefined;

function makeClock(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i++;
    return v;
  };
}

function makeJsonResponse(body: HealthResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('checkHealth', () => {
  const okBody: HealthResponse = {
    status: 'ok',
    service: 'causeflow',
    version: '0.1.0',
    commit: 'abcdef1',
    timestamp: '2026-04-11T22:00:00.000Z',
  };

  it('returns ok when commit matches the short SHA', async () => {
    const fetchFn = async (): Promise<Response> => makeJsonResponse(okBody);

    const result = await checkHealth({
      url: 'https://api-staging.causeflow.ai/health',
      expectedSha: 'abcdef1234567890',
      timeoutMs: 30_000,
      pollIntervalMs: 500,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000]),
    });

    expect(result.ok).toBe(true);
    expect(result.commit).toBe('abcdef1');
    expect(result.body.commit).toBe('abcdef1');
  });

  it('compares only against the first 7 chars of expectedSha', async () => {
    const fetchFn = async (): Promise<Response> =>
      makeJsonResponse({ ...okBody, commit: '1234567' });

    const result = await checkHealth({
      url: 'https://api-staging.causeflow.ai/health',
      expectedSha: '1234567890abcdef',
      timeoutMs: 30_000,
      pollIntervalMs: 500,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500]),
    });

    expect(result.commit).toBe('1234567');
  });

  it('retries until commit matches', async () => {
    let callCount = 0;
    const fetchFn = async (): Promise<Response> => {
      callCount++;
      if (callCount < 3) {
        return makeJsonResponse({ ...okBody, commit: 'oldcom1' });
      }
      return makeJsonResponse({ ...okBody, commit: 'abcdef1' });
    };

    const result = await checkHealth({
      url: 'https://api-staging.causeflow.ai/health',
      expectedSha: 'abcdef1234567',
      timeoutMs: 60_000,
      pollIntervalMs: 500,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000, 1_500]),
    });

    expect(result.ok).toBe(true);
    expect(callCount).toBe(3);
  });

  it('retries on network error and eventually succeeds', async () => {
    let callCount = 0;
    const fetchFn = async (): Promise<Response> => {
      callCount++;
      if (callCount === 1) throw new Error('ECONNREFUSED');
      return makeJsonResponse(okBody);
    };

    const result = await checkHealth({
      url: 'https://api-staging.causeflow.ai/health',
      expectedSha: 'abcdef1',
      timeoutMs: 30_000,
      pollIntervalMs: 500,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000]),
    });

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it('retries on non-200 status', async () => {
    let callCount = 0;
    const fetchFn = async (): Promise<Response> => {
      callCount++;
      if (callCount === 1) return new Response('', { status: 503 });
      return makeJsonResponse(okBody);
    };

    const result = await checkHealth({
      url: 'https://api-staging.causeflow.ai/health',
      expectedSha: 'abcdef1',
      timeoutMs: 30_000,
      pollIntervalMs: 500,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000]),
    });

    expect(result.ok).toBe(true);
  });

  it('throws VerifyError when commit field is missing', async () => {
    // Body with empty commit triggers the shape guard.
    const fetchFn = async (): Promise<Response> =>
      makeJsonResponse({ ...okBody, commit: '' });

    await expect(
      checkHealth({
        url: 'https://api-staging.causeflow.ai/health',
        expectedSha: 'abcdef1',
        timeoutMs: 30_000,
        pollIntervalMs: 500,
        fetchFn: fetchFn as typeof fetch,
        sleep: noopSleep,
        now: makeClock([0, 500]),
      })
    ).rejects.toBeInstanceOf(VerifyError);
  });

  it('throws TimeoutError when the budget is exhausted', async () => {
    const fetchFn = async (): Promise<Response> =>
      makeJsonResponse({ ...okBody, commit: 'oldcom1' });

    await expect(
      checkHealth({
        url: 'https://api-staging.causeflow.ai/health',
        expectedSha: 'abcdef1',
        timeoutMs: 1_000,
        pollIntervalMs: 500,
        fetchFn: fetchFn as typeof fetch,
        sleep: noopSleep,
        now: makeClock([0, 5_000]),
      })
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
