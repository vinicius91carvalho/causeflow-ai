'use client';

/**
 * OSS builds: credits quota chrome is removed (AC-074 / PD-OSS-BILLING-PURGE).
 * Hook retained as a no-op so stale imports never surface remaining-credit limits.
 */

interface CreditsData {
  creditsRemaining: number;
  creditsTotal: number;
  creditsUsed: number;
  plan: string | null;
}

interface CreditsState {
  credits: CreditsData | null;
  loading: boolean;
  error: boolean;
}

interface UseCreditsOptions {
  /** Pre-fetched value (ignored in OSS — quota chrome is disabled). */
  initialCreditsRemaining?: number;
}

/**
 * Always returns empty credits state. Does not call /api/metrics.
 */
export function useCredits(_options?: UseCreditsOptions): CreditsState {
  return { credits: null, loading: false, error: false };
}
