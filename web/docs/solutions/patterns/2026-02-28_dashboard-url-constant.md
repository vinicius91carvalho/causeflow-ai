---
title: SITE.dashboardUrl — environment-aware URL pattern for staging vs production
date: 2026-02-28
category: patterns
tags: [url, env, staging, production, sst, site-constant, dashboard]
app: website, shared
severity: medium
---

# SITE.dashboardUrl — environment-aware URL pattern for staging vs production

## Problem

The website needs to link to the dashboard, but the dashboard URL differs between environments:
- Production: `https://dashboard.causeflow.ai`
- Staging: `https://dashboard-staging.causeflow.ai`

Hardcoding the production URL breaks staging. Hardcoding an env var without a fallback breaks production builds that don't set the var.

## Solution

The `SITE` constant in `packages/shared/src/domain/constants/site.ts` reads `NEXT_PUBLIC_DASHBOARD_URL` with a fallback:

```ts
export const SITE = {
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.causeflow.ai',
  // ...
} as const;
```

SST injects the correct value per stage in `apps/website/sst.config.ts`:

```ts
environment: {
  NEXT_PUBLIC_DASHBOARD_URL:
    $app.stage === 'production'
      ? 'https://dashboard.causeflow.ai'
      : `https://dashboard-${$app.stage}.causeflow.ai`,
},
```

Components use `SITE.dashboardUrl` — never hardcode URLs:

```tsx
// apps/website/src/components/navigation/header.tsx
import { SITE } from '@causeflow/shared';

// In staging/dev: links to dashboard
// In production: links to /get-started (Coming Soon overlay)
const isDashboardLive = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE !== 'production';

{isDashboardLive ? (
  <a href={SITE.dashboardUrl}>Dashboard</a>
) : (
  <a href="/get-started">Get Started</a>
)}
```

## URL Patterns

| Environment | Website | Dashboard |
|---|---|---|
| Production | `causeflow.ai` | `dashboard.causeflow.ai` |
| Staging | `staging.causeflow.ai` | `dashboard-staging.causeflow.ai` |
| Local Dev | `127.0.0.1:3000` | `127.0.0.1:3001` |

The pattern for custom stages: `dashboard-${stage}.causeflow.ai` and `${stage}.causeflow.ai`.

## Prevention

- Never hardcode `dashboard.causeflow.ai` in component code — always use `SITE.dashboardUrl`.
- When adding new inter-app links, follow the same env-var pattern via the `SITE` constant.
- Verify URL correctness after any SST stage rename against the actual `sst.config.ts`.

## Related

- `packages/shared/src/domain/constants/site.ts`
- `apps/website/sst.config.ts`
- `apps/website/src/components/navigation/header.tsx`
