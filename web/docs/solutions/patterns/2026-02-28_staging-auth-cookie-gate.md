---
title: Staging password gate — cookie-based auth middleware
date: 2026-02-28
category: patterns
tags: [staging, auth, middleware, cookie, password-gate, next.js]
app: website, dashboard
severity: medium
---

# Staging password gate — cookie-based auth middleware

## Problem

Staging deployments are publicly accessible URLs. We need a lightweight password gate to prevent public access without a full auth system on the staging environment.

## Solution

A shared middleware module in `packages/shared` handles staging authentication via a cookie check.

**Middleware file:** `packages/shared/src/infrastructure/middleware/staging-auth.ts`

**How it works:**
1. Activated only when `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'` AND `NEXT_PUBLIC_STAGING_PASSWORD` is set
2. Checks for a cookie named `staging-authorized:<base64(password)>` with value `true`
3. Bypasses: `/staging-auth`, `/_next/*`, `/api/*`, and static asset paths
4. Unauthenticated requests are redirected to `/staging-auth`

**Password:** `causeflow-staging-2026` (hardcoded in both `sst.config.ts` files)

**Cookie format:**
```ts
const cookieName = `staging-authorized:${btoa(password)}`;
// Cookie value: 'true'
```

**Playwright integration:**
The Playwright config auto-injects the staging cookie when `BASE_URL` contains `staging.causeflow.ai`:

```ts
// playwright.config.ts
storageState: BASE_URL.includes('staging.causeflow.ai')
  ? { cookies: [{ name: cookieName, value: 'true', ... }] }
  : undefined,
```

## Adding to a new app

1. Import the middleware helper from `@causeflow/shared`
2. Call it at the top of the app's `middleware.ts` before other checks
3. Add `NEXT_PUBLIC_STAGING_PASSWORD` to the app's `sst.config.ts` environment block

## Prevention

- Never commit the staging password in test output or logs
- If staging is publicly accessible, check that `NEXT_PUBLIC_DEPLOYMENT_STAGE` is correctly set in `sst.config.ts`

## Related

- `packages/shared/src/infrastructure/middleware/staging-auth.ts`
- [`patterns/2026-02-28_env-local-standard.md`](./2026-02-28_env-local-standard.md)
