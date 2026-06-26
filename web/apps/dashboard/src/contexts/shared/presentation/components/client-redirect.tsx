'use client';

import { useEffect } from 'react';
import { CauseFlowLoader } from '@/contexts/shared/presentation/components/causeflow-loader';

interface ClientRedirectProps {
  /** Destination URL to navigate to. */
  to: string;
}

/**
 * Client-side redirect component used as a workaround for a Next.js App
 * Router bug where `redirect()` thrown from a server-component layout — or
 * even a client-side `router.replace()` — leaves the browser on a blank
 * page during client-side RSC navigation. Repro steps: Clerk sign-in
 * → router.push('/dashboard') → layout's RSC flight response contains a
 * rendered dashboard tree AND a NEXT_REDIRECT marker; the client router
 * retries the redirect-target RSC fetch a few times and then gives up,
 * leaving a blank document at `/dashboard`.
 *
 * Tracked upstream at https://github.com/vercel/next.js/issues/67427
 * (closed as "not planned"). `router.replace()` from within a client
 * component is affected by the same flight-layer bug, so we fall through
 * to `window.location.replace()` which forces a full-page navigation and
 * bypasses the broken RSC flight path entirely. The tradeoff is a brief
 * full reload on the plan-gate miss path — acceptable because this only
 * fires for users who do not yet have a plan.
 */
export function ClientRedirect({ to }: ClientRedirectProps) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <CauseFlowLoader size="sm" />
    </div>
  );
}
