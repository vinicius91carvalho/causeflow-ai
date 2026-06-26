'use client';

import { useEffect, useState } from 'react';

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
  /** Pre-fetched value (avoids duplicate fetch). */
  initialCreditsRemaining?: number;
}

/**
 * Fetches credit info from /api/metrics (core API).
 * Returns remaining, total, used credits and the current plan name.
 * Used by the sidebar badge to show remaining quota.
 */
export function useCredits(options?: UseCreditsOptions): CreditsState {
  const initialValue = options?.initialCreditsRemaining;
  const hasInitial = initialValue !== undefined;

  const [credits, setCredits] = useState<CreditsData | null>(
    hasInitial
      ? { creditsRemaining: initialValue, creditsTotal: 0, creditsUsed: 0, plan: null }
      : null,
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialValue !== undefined) {
      setCredits((prev) => ({ ...prev!, creditsRemaining: initialValue }));
      setLoading(false);
      setError(false);
    }
  }, [initialValue]);

  useEffect(() => {
    if (hasInitial) return;

    let cancelled = false;

    async function fetchCredits() {
      try {
        const res = await fetch('/api/metrics');
        if (cancelled) return;
        if (!res.ok) throw new Error('Failed to fetch metrics');
        const json = (await res.json()) as {
          metrics: {
            creditsTotal: number;
            creditsUsed: number;
            creditsRemaining: number;
            plan: string | null;
          };
        };
        if (cancelled) return;
        setCredits({
          creditsRemaining: json.metrics.creditsRemaining,
          creditsTotal: json.metrics.creditsTotal,
          creditsUsed: json.metrics.creditsUsed,
          plan: json.metrics.plan ?? null,
        });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCredits();

    return () => {
      cancelled = true;
    };
  }, [hasInitial]);

  return { credits, loading, error };
}
