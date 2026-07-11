import { cache } from 'react';
import { getApiClient } from '@/lib/api/get-api-client';
import { isOssFreeActiveSubscription, isOssRuntime } from './oss-runtime';

export interface PlanStatus {
  /** True only when status is active/trialing AND the tenant has a real Stripe subscription (or OSS free stub). */
  hasActivePlan: boolean;
  plan: string | null;
  status: string | null;
  /** ISO timestamp at which the current Stripe billing period ends. null when the tenant has never completed checkout. */
  currentPeriodEnd: string | null;
  /** True when the Core API reports a real Stripe-managed subscription (presence of currentPeriodEnd). */
  hasStripeSubscription: boolean;
}

/**
 * Computes plan status from the Core API's GET /v1/billing/subscription.
 *
 * Commercial (non-OSS): a plan is "active" only when BOTH:
 *   1. `status` is 'active' or 'trialing'
 *   2. `currentPeriodEnd` is set — Stripe webhooks populate this on every
 *      real subscription update.
 *
 * OSS local runtime (AC-048): Core's StubBillingService returns
 * `{ plan: 'free', status: 'active' }` with no currentPeriodEnd. That stub
 * must pass the plan gate so fresh tenants can reach /dashboard/billing.
 *
 * This is the uncached form — prefer {@link getPlanStatus} from server
 * components so React de-duplicates per request.
 */
export async function fetchPlanStatus(): Promise<PlanStatus> {
  try {
    const api = getApiClient();
    const sub = (await api.getSubscription()) as {
      status?: string;
      plan?: string;
      currentPeriodEnd?: string | null;
    } | null;

    const statusOk = ['active', 'trialing'].includes(sub?.status ?? '');
    const currentPeriodEnd = sub?.currentPeriodEnd ?? null;
    const hasStripeSubscription = Boolean(currentPeriodEnd);
    const ossFreeActive = isOssFreeActiveSubscription(sub);

    return {
      hasActivePlan: ossFreeActive || (statusOk && hasStripeSubscription),
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      currentPeriodEnd,
      hasStripeSubscription,
    };
  } catch {
    // Do not fail-open on commercial builds. OSS may still allow access when
    // the subscription proxy is briefly unavailable (AC-048).
    if (isOssRuntime()) {
      return {
        hasActivePlan: true,
        plan: 'free',
        status: 'active',
        currentPeriodEnd: null,
        hasStripeSubscription: false,
      };
    }
    return {
      hasActivePlan: false,
      plan: null,
      status: null,
      currentPeriodEnd: null,
      hasStripeSubscription: false,
    };
  }
}

/**
 * Cached plan status reader for server components. React `cache()` dedupes
 * calls within a single request render, so layouts + pages that each need
 * the status only hit Core API once per navigation.
 */
export const getPlanStatus = cache(fetchPlanStatus);
