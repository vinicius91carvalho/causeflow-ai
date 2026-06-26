/**
 * Resolve the correct dashboard URL for the current deployment environment.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_DASHBOARD_URL (explicit override, set by SST per stage)
 *   2. production stage → dashboard.causeflow.ai
 *   3. non-production production build → dashboard-staging.causeflow.ai
 *   4. local dev → http://localhost:3001
 *
 * All marketing-site CTAs that "sign in" / "get started" / "open dashboard"
 * must route through this helper. Never hardcode dashboard URLs in components.
 */
export function getDashboardUrl(): string {
  const override = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  if (override) return override;

  const stage = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE;
  if (stage === 'production') return 'https://dashboard.causeflow.ai';

  if (process.env.NODE_ENV === 'production') {
    return 'https://dashboard-staging.causeflow.ai';
  }

  return 'http://localhost:3001';
}
