# Sprint 3: Fire Test Error Refactor

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 4
- **Depends on:** None
- **Batch:** 2 (parallel with Sprint 2)
- **Model:** sonnet
- **Estimated effort:** S

## Objective

Replace the Core-API-forward in the "Fire Test Error" dashboard route with a direct `Sentry.captureException` call that sends exactly 1 randomly-selected synthetic error to Sentry, returning `{ fired: 1, name }` with HTTP 200.

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `web/apps/dashboard/src/contexts/settings/api/fire-test-errors-handler.ts` — replace core-API-forward with Sentry.captureException
- `web/apps/dashboard/src/contexts/settings/presentation/components/fire-test-errors-card.tsx` — update response type, remove incidents list, show fired variant name

### Read-Only (reference but do NOT modify)

- `web/apps/dashboard/sentry.server.config.ts` — confirm Sentry.init is called; DSN from `NEXT_PUBLIC_SENTRY_DSN`
- `web/apps/dashboard/src/app/global-error.tsx` — example of Sentry.captureException usage in dashboard
- `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts` — thin re-export, no change needed

### Shared Contracts (consume from PRD)

- Response type: `{ fired: 1; name: string }` — defined here

### Consumed Invariants

None

## Tasks

- [ ] Define the 10 synthetic error variants as a const array in `fire-test-errors-handler.ts`:
  ```ts
  const ERROR_VARIANTS = [
    'DatabaseTimeoutError',
    'RedisConnectionError',
    'S3UploadFailure',
    'NullPointerInPaymentFlow',
    'RateLimitExceeded',
    'JWTSignatureMismatch',
    'OutOfMemoryHeapCorruption',
    'ZeroDivisionInMetrics',
    'WebhookSignatureInvalid',
    'KafkaConsumerLag',
  ] as const;
  ```
- [ ] Rewrite `fire-test-errors-handler.ts` body of `POST`:
  1. Pick one variant at random: `const name = ERROR_VARIANTS[Math.floor(Math.random() * ERROR_VARIANTS.length)]`
  2. Construct error: `const err = new Error(\`[CauseFlow Test] ${name}: synthetic error for Sentry integration testing\`); err.name = name;`
  3. Call `Sentry.captureException(err)` (import from `@sentry/nextjs`)
  4. Return `Response.json({ fired: 1, name }, { status: 200 })`
  - Remove the existing `withAuth` wrapper if it was only needed for the core API forward. If auth is still desired on this admin endpoint, keep `withAuth`.
  - Remove the `CORE_API_URL` forward entirely.
- [ ] Update `fire-test-errors-card.tsx`:
  - Change response type from `{ fired: number; results: FireResult[] }` to `{ fired: 1; name: string }`
  - Remove the "Created incidents:" list section (lines 71-78)
  - After success, show: `"Fired 1 random Sentry error: ${result.name}"` — either in toast or in card body
  - Toast message: `"Fired 1 random Sentry error: ${result.name}"`
  - Card subtitle already says "Fires 1 random synthetic Sentry error" — no change needed
- [ ] Remove the `FireResult` type if unused after the update (check for other usages first)

## Acceptance Criteria

- [ ] Clicking "Fire Test Error" once returns `{ fired: 1, name: "<one of 10 variants>" }` with HTTP 200
- [ ] The response `name` is one of the 10 defined variants
- [ ] `Sentry.captureException` is called with an `Error` whose `.name` matches the selected variant
- [ ] No HTTP call to `CORE_API_URL/v1/admin/fire-test-errors` occurs
- [ ] Dashboard incidents list is NOT rendered after clicking the button
- [ ] Toast shows the variant name
- [ ] `pnpm --filter dashboard build` passes

## Verification

- [ ] `cd web && pnpm --filter dashboard build`
- [ ] `cd web && pnpm --filter dashboard typecheck`
- [ ] Manual: start local dev server, navigate to `/dashboard/settings` (staging gate: `isStaging` must be true locally — check env), click "Fire Test Error", verify toast shows variant name, verify Sentry UI receives 1 event

## Context

### Current Handler Location

Full path: `web/apps/dashboard/src/contexts/settings/api/fire-test-errors-handler.ts`

The route is re-exported from: `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts`

The re-export file does `export { POST } from '@/contexts/settings/api/fire-test-errors-handler'` — no change needed there.

### Sentry SDK Import

In dashboard, import Sentry via:
```ts
import * as Sentry from '@sentry/nextjs';
```

`Sentry.captureException(err)` buffers the event and flushes to Sentry's ingest asynchronously. No need to await — it returns a string (event ID). Example usage in the codebase: `web/apps/dashboard/src/app/global-error.tsx` line where `Sentry.captureException(error)` is called.

### Auth Note

Current handler uses `withAuth` (Clerk). The admin route is meant to be protected. Keep `withAuth` unless the executor has a clear reason to remove it. The Sentry `captureException` call does not need the user token.

### isStaging Gate

The "Fire Test Error" card is rendered only when `isStaging` is true (`fire-test-errors-card.tsx` is mounted in `settings/page.tsx` inside an `isStaging` block). This gating is unchanged. The route itself has no `isStaging` check — it fires in any environment if called directly.

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:
