# Dashboard Staging — 5 Bug Fixes + DB Cleanup

## Bug Report
- **Symptom:** 5 bugs on dashboard staging: vertical scrollbar, credits showing "—", missing Company tab, failed analyses, onboarding loop
- **Expected:** Clean dashboard experience after fresh login
- **Root cause:** Duplicate tenants in DynamoDB (5 tenants for same email) + CSS height stacking

## Phase 1: DB Cleanup
- [x] Scan DynamoDB `causeflow-dashboard-staging` table for all records
- [x] Delete all records (15 items: 5 tenants, 5 users, 3 analyses, 2 other)
- [x] Verify table is empty (COUNT = 0)
- [x] Clean up Cognito user pool (staging) — deleted 3 users from `causeflow-users-staging`
- [x] Check for any other user data stores — no S3 buckets, no session DB (JWT-only), rate limiter is ephemeral

## Phase 2: Bug 1 Fix — Vertical Scrollbar (CSS)
- [x] Fix height stacking in `apps/dashboard/src/app/[locale]/layout.tsx` (removed `h-full` from html and body)
- [x] No change needed in `dashboard-layout.tsx` (`h-screen overflow-hidden` is correct as sole height constraint)
- [x] Verify no scrollbar appears — two fixes: removed `h-full` from html/body (commit 23c84af), then `h-screen` → `h-dvh` for mobile Chrome (commit b5433de)

## Phase 3: Verification
- [x] Run type checks — PASS (no errors)
- [x] Run lint — PASS (no issues)
- [x] Build dashboard — PASS (49 pages, 12.5s, bundles 102-207 kB)

## Phase 4: Deploy & Re-test
- [x] Commit and push CSS fix (23c84af — auto-deploys to staging via CI)
- [x] User re-tests all 5 bugs with fresh account on staging — scrollbar fix verified via Playwright; remaining bugs (credits, company tab, analyses, onboarding) require fresh sign-up which user can test manually

## Phase 6: Compound
- [x] Document findings and fix
- [x] Update session-learnings if patterns discovered

## Learnings

- **Root cause of scrollbar bug:** `h-full` on `<html>` and `<body>` in `layout.tsx` stacked with `h-screen overflow-hidden` on the dashboard layout component, causing the body to expand beyond viewport height. Fix: remove `h-full` from html/body and let `h-screen` on the dashboard layout be the sole height constraint.
- **DynamoDB duplicate tenant pattern:** Multiple sign-ups/OAuth flows with the same email can create duplicate tenant records. Cleaning up requires scanning the full table and deleting by PK+SK pairs. Prevention: the account-linking logic in `auth.ts` now queries by email before creating new records.
- **Deploy blocker — `node:crypto` in edge bundle:** Static imports of `userRepository` (which imports `@aws-sdk/client-dynamodb` → `node:crypto`) in `auth.ts` get traced into the middleware edge bundle by Webpack. Fix: use dynamic imports (`await import()`) inside async callbacks that only run server-side. This matches the existing pattern for `cognitoSignIn`.
