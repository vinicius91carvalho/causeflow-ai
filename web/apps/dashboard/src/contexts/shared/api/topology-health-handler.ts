import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { SystemHealthSummary } from '@/lib/api/core-api-types';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/topology/health
 *
 * Returns a system-wide health summary across all service nodes.
 * Proxies to Core API GET /v1/graph/health and normalizes the response to
 * the dashboard-side `SystemHealthSummary` contract.
 *
 * Used by the dashboard overview to show overall infrastructure health.
 */
const EMPTY_HEALTH: SystemHealthSummary = {
  totalServices: 0,
  healthy: 0,
  degraded: 0,
  unhealthy: 0,
  unknown: 0,
};

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Normalize the Core API payload into the shape the dashboard's
 * SystemHealthSection consumes. Core has shipped two wire formats historically:
 *
 *   - `{ total, healthy, degraded, down, unknown }`     (legacy / graph)
 *   - `{ totalServices, healthy, degraded, unhealthy, unknown }` (current)
 *
 * If we pass the legacy shape straight through, the component renders the
 * "Unhealthy" label with an empty count (because `data.unhealthy` is
 * `undefined`). Normalize here so the UI always receives a complete summary.
 */
function normalizeHealth(raw: unknown): SystemHealthSummary {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_HEALTH };
  const r = raw as Record<string, unknown>;
  return {
    totalServices: toNumber(r.totalServices ?? r.total),
    healthy: toNumber(r.healthy),
    degraded: toNumber(r.degraded),
    unhealthy: toNumber(r.unhealthy ?? r.down),
    unknown: toNumber(r.unknown),
  };
}

export const GET = withAuth(async (request, ctx) => {
  const start = Date.now();
  try {
    const raw = await getApiClient().getSystemHealth();
    return NextResponse.json(normalizeHealth(raw));
  } catch (err) {
    // Core API may not have the topology health endpoint deployed in every
    // environment (staging currently returns 404). Degrade gracefully so the
    // dashboard section can render its empty state instead of crashing.
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (/not found/i.test(message)) {
      return NextResponse.json({ ...EMPTY_HEALTH });
    }
    const logPath = new URL(request.url).pathname;
    const logPayload = {
      method: request.method,
      path: logPath,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      duration: Date.now() - start,
    };
    dashLogger.error({ err, ...logPayload }, `Unhandled API handler error`);
    Sentry.captureException(err, { extra: logPayload });
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
