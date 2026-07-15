import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { getPlanStatus } from '@/contexts/billing/application/plan-status';
import { ClientRedirect } from '@/contexts/shared/presentation/components/client-redirect';
import { DashboardLayout } from '@/contexts/shared/presentation/components/layout/dashboard-layout';

/**
 * Server-side plan gate for the entire /dashboard segment.
 *
 * Runs on every full page load / cross-segment navigation. Reads the
 * authoritative subscription state from Core API via {@link getPlanStatus},
 * which requires BOTH an active/trialing status AND a real Stripe customer.
 *
 * If the tenant has not completed Stripe Checkout, the user is redirected
 * to `/onboarding/choose-plan` — admins pick a plan, non-admins see the
 * "ask your admin" message rendered by the choose-plan page.
 *
 * Note: we render {@link ClientRedirect} instead of calling `redirect()`
 * from the layout. `next/navigation`'s `redirect()` is broken inside
 * server-component layouts during client-side RSC navigation — Next.js
 * renders the new segment in parallel with throwing `NEXT_REDIRECT`, and
 * the client router fails to commit the redirect, leaving the browser
 * stuck at `/dashboard` with an empty body. Full-page refreshes work only
 * because they bypass the flight path entirely. Tracked upstream at
 * https://github.com/vercel/next.js/issues/67427 (closed as "not planned").
 *
 * Note: locale sync (NEXT_LOCALE ↔ Core API UserSettings.locale) is handled
 * in middleware.ts where NextResponse.cookies.set() is legal. The layout no
 * longer calls syncLocaleFromServer() — that helper has been deleted.
 */
export default async function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  if (!isOssRuntime()) {
    const plan = await getPlanStatus();
    if (!plan.hasActivePlan) {
      return <ClientRedirect to="/onboarding/choose-plan" />;
    }
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
