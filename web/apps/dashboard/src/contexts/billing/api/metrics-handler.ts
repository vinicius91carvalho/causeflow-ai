import { type NextRequest, NextResponse } from 'next/server';
import type { IncidentAnalytics } from '@/lib/api/core-api-types';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/metrics
 * Returns dashboard overview metrics for the authenticated user's tenant.
 * OSS builds omit commercial credits quota fields (AC-074 / PD-OSS-BILLING-PURGE).
 */
export const GET = withAuth(async (_request: NextRequest, ctx) => {
  const api = getApiClient();

  // Run independent API calls in parallel — gracefully handle missing endpoints
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const defaultAnalytics: IncidentAnalytics = {
    totalIncidents: 0,
    openIncidents: 0,
    mttr: 0,
    byStatus: {},
    bySeverity: {},
    totalCostUsd: 0,
    avgCostUsd: null,
  };

  const [subscription, analytics, tenant, integrations] = await Promise.all([
    safe(api.getSubscription(), {} as Record<string, unknown>),
    safe(api.getIncidentAnalytics(), defaultAnalytics),
    safe(api.getTenant(ctx.tenantId), null),
    safe(api.listIntegrations(), [] as unknown),
  ]);

  const totalAnalyses = analytics.totalIncidents ?? 0;
  // Core's incident statuses include 'resolved'; we derive resolved count
  // from byStatus since the domain contract no longer carries a dedicated
  // `resolvedIncidents` field (it's a slice of byStatus).
  const resolvedAnalyses = analytics.byStatus?.resolved ?? 0;

  const HOURS_PER_ANALYSIS = 2;
  const hoursSaved = resolvedAnalyses * HOURS_PER_ANALYSIS;

  const sub = subscription as Record<string, unknown>;
  const plan = (sub.plan as string) ?? tenant?.plan ?? 'free';
  const subscriptionStatus = (sub.status as string) ?? null;

  // Core API returns `{ integrations: [...] }`; back-compat tolerates a raw array.
  // Only count integrations whose status is `connected` or `active` to match
  // what users see as "connected" on the integrations page.
  const rawIntegrations = Array.isArray(integrations)
    ? integrations
    : Array.isArray((integrations as { integrations?: unknown[] })?.integrations)
      ? (integrations as { integrations: unknown[] }).integrations
      : [];
  const integrationList = rawIntegrations.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const status = (entry as { status?: string }).status;
    if (typeof status !== 'string') return true;
    return status === 'connected' || status === 'active';
  });

  return NextResponse.json({
    metrics: {
      totalAnalyses,
      monthlyAnalyses: totalAnalyses,
      activeIntegrations: integrationList.length,
      teamMembers: 1,
      hoursSaved,
      plan,
      subscriptionStatus,
      currentPeriodEnd: (sub.currentPeriodEnd as string | null) ?? null,
      cancelAtPeriodEnd: (sub.cancelAtPeriodEnd as boolean) ?? false,
    },
  });
});
