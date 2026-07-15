'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Client-side guard that redirects to /onboarding/choose-plan if the tenant
 * has no active or trialing subscription. Returns `ready` once the check completes.
 */
export function useSubscriptionGuard(): { ready: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/billing/subscription');
        if (cancelled) return;

        // OSS billing proxy returns 410 — do not bounce to choose-plan (AC-081).
        if (res.status === 410) {
          if (!cancelled) setReady(true);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const status = data.subscriptionStatus;
          const hasPlan = status === 'active' || status === 'trialing';

          if (!hasPlan) {
            router.replace('/onboarding/choose-plan');
            return;
          }
        }
      } catch {
        // Network error — don't block the dashboard, let it render
      }

      if (!cancelled) setReady(true);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { ready };
}
