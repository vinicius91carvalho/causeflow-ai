import { CoreApiError } from '@/lib/api/http-api-client';

/** Clear message surfaced when Core returns 410 Gone for billing mutations (AC-043/AC-048). */
export const BILLING_DISABLED_MESSAGE = 'Billing is disabled in this build.';

/**
 * Map a Core API failure to a billing-disabled response when the upstream
 * status is 410 Gone (StubBillingService). Returns null for other errors so
 * callers can keep their generic 500 path.
 */
export function billingDisabledResponse(err: unknown): { error: string; status: number } | null {
  if (err instanceof CoreApiError && err.status === 410) {
    return { error: BILLING_DISABLED_MESSAGE, status: 410 };
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Core may surface the 410 body without a typed status in some proxy paths.
  if (/billing is disabled|410|gone/i.test(msg)) {
    return { error: BILLING_DISABLED_MESSAGE, status: 410 };
  }
  return null;
}
