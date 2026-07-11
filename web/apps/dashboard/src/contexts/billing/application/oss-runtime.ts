/**
 * Detect the open-source local runtime (AC-048).
 *
 * Prefer the explicit `CAUSEFLOW_RUNTIME=oss` flag (set by docker-compose and
 * harness `.env.local`). Fall back to "no Stripe publishable key" so a bare
 * local checkout without Stripe still takes the OSS billing path.
 */
export function isOssRuntime(): boolean {
  if (process.env.CAUSEFLOW_RUNTIME === 'oss') return true;
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return !stripeKey || stripeKey.trim() === '';
}

/**
 * Core's StubBillingService (AC-043) returns `{ plan: 'free', status: 'active' }`
 * (or `trialing`) with no `currentPeriodEnd` for fresh OSS tenants. Treat that
 * as an active plan so the commercial currentPeriodEnd gate (AC-023) does not
 * trap OSS users on /onboarding/choose-plan.
 */
export function isOssFreeActiveSubscription(
  sub: {
    plan?: string | null;
    status?: string | null;
    currentPeriodEnd?: string | null;
  } | null,
): boolean {
  if (!isOssRuntime() || !sub) return false;
  if (sub.plan !== 'free') return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  return sub.currentPeriodEnd == null;
}
