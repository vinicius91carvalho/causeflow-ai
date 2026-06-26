# Dashboard Codebase Simplification

## Context (The Why)
`apps/dashboard` (~32,000 lines, 325 files) has accumulated code duplication, oversized files, dead code, inconsistent patterns, quality issues, and efficiency problems. Full three-dimensional review (reuse, quality, efficiency) identified 40+ actionable findings.

## Definition (The What)
Systematically simplify the dashboard codebase: remove dead code, extract shared utilities, reduce file sizes, fix code quality issues, resolve efficiency problems, and consolidate duplicated patterns.

## Acceptance Criteria (The How to Test)
- [x] All tests pass (`pnpm turbo test --filter=dashboard`) — 629/629
- [x] Build succeeds (`pnpm turbo build --filter=dashboard`) — 6/6 tasks
- [x] Lint passes (`pnpm exec biome check apps/dashboard/`) — 0 errors
- [x] Type check passes (`pnpm turbo check-types --filter=dashboard`) — clean
- [x] Dev server starts without errors
- [x] No regression in existing functionality
- [x] No duplicate `/api/metrics` calls on dashboard overview load

## Restrictions (The Boundaries)
- No new features — simplification and deduplication only
- No changes to external APIs or user-facing behavior
- Preserve all existing test coverage
- Don't consolidate utilities to packages unless they're already duplicated cross-app

---

## Phase 1: Dead Code & Trivial Cleanup

- [x] **Audit orphaned API endpoint** `app/api/onboarding/connect-integration/route.ts` — KEPT: still has active caller in `integration-modal.tsx` line 187
- [x] **Audit `lib/db/repositories/` stubs** — Deleted 5 orphaned stubs (analysis, remediation, integration, settings, invite). Kept 3 with active callers (incident, tenant, user). Updated 2 test files.
- [x] **Remove unused `onPortal` prop** from `PlanCardProps` in `billing-page.tsx` — removed from interface and call site
- [x] **Remove `time-utils.ts`** — extracted `isStaleConnection` to `stale-connection.ts`, updated callers to import `formatRelativeTime` directly from shared, deleted wrapper

---

## Phase 2: Extract Shared Utilities to Packages

### `deepMerge` → `@causeflow/shared` (duplicated in both apps)
- [x] Create `packages/shared/src/domain/utils/deep-merge.ts` with the `deepMerge` function and `DeepPartial` type (if not already done by website task)
- [x] Export from `packages/shared` index
- [x] Update `apps/dashboard/src/lib/i18n/compose.ts` to import from `@causeflow/shared`
- [x] Delete local `deepMerge` implementation from compose.ts

### `generateSlug` → `@causeflow/shared`
- [x] Move `apps/dashboard/src/lib/slug.ts` content to `packages/shared/src/domain/utils/slug.ts`
- [x] Export from `packages/shared` index
- [x] Update all dashboard importers to use `@causeflow/shared`
- [x] Delete `apps/dashboard/src/lib/slug.ts`

### `getClientIp` → `@causeflow/shared`
- [x] Extract `getClientIp` from `apps/dashboard/src/lib/rate-limit.ts` to `packages/shared/src/infrastructure/utils/request.ts`
- [x] Export from `@causeflow/shared`
- [x] Update dashboard rate-limit to import from `@causeflow/shared`

### `PageHeader` → `@causeflow/ui`
- [x] Move `contexts/shared/presentation/components/page-header.tsx` to `packages/ui/src/components/page-header.tsx`
- [x] Export from `packages/ui` index
- [x] Update all 6+ dashboard importers to use `@causeflow/ui`

---

## Phase 3: Code Reuse — Internal Deduplication

### Batch 3A: `RemediationStatusBadge` — Triplicate Color Mapping (3 files → 1 component)
- [x] Create `contexts/investigation/presentation/components/remediation-status-badge.tsx` with the unified status-to-color mapping
- [x] Update `incident-detail.tsx` to import shared `RemediationStatusBadge` (lines 18–31)
- [x] Update `remediations-list.tsx` to import shared badge (lines 11–24)
- [x] Update `remediation-detail.tsx` to import shared badge (lines 19–32)
- [x] Fix inconsistent colors: standardize `failed` shade (`red-300/red-50` vs `red-400/red-100`)

### Batch 3B: `INTEGRATION_FIELDS` + `buildValidationSchema` (2 files → 1 module)
- [x] Extract `INTEGRATION_FIELDS`, `buildValidationSchema`, and `FieldDef` type into `contexts/integrations/domain/integration-fields.ts`
- [x] Update `connection-modal.tsx` (lines 18–161) to import from shared module
- [x] Update `integration-modal.tsx` (lines 19–100+) to import from shared module (filter to its 6 supported types)

### Batch 3C: `useBodyScrollLock` Hook (3 files → 1 hook)
- [x] Create `contexts/shared/presentation/hooks/use-body-scroll-lock.ts` with `useBodyScrollLock(isOpen: boolean)`
- [x] Update `connection-modal.tsx` (lines 223–231) to use hook
- [x] Update `disconnect-dialog.tsx` (lines 53–58) to use hook
- [x] Update `integration-modal.tsx` (lines 151–156) to use hook

### Batch 3D: Duplicate Spinner SVG → Shared Component
- [x] Import `Loader2` from `lucide-react` (already used elsewhere) or extract `Spinner` from `remediation-detail.tsx` (lines 56–73) to `contexts/shared/presentation/components/ui/spinner.tsx`
- [x] Replace duplicate inline spinner SVGs in `incident-detail.tsx` (lines 454–474 and 490–511)

### Batch 3E: Theme Cycle Logic (2 files → 1 utility)
- [x] Extract theme cycle logic into `contexts/shared/lib/theme-cycle.ts`: `const CYCLE = ['light', 'dark', 'system'] as const`
- [x] Update `topbar.tsx` (lines 34–38) to use shared cycle
- [x] Update `command-palette.tsx` (line 173) to use shared cycle

---

## Phase 4: Code Quality Fixes

### Redundant State
- [x] **`incident-detail.tsx` lines 115–117**: Replace 3 boolean loading states (`isApproving`, `isRejecting`, `isExecuting`) with a single `loadingAction: 'approve' | 'reject' | 'execute' | null`
- [x] **`sign-up-page.tsx` lines 77–78**: Merge `signUpEmail` and `signUpSuccess` into a single `signUpResult: { success: boolean; email: string }` state

### Stringly-Typed Code
- [x] **`incident-detail.tsx` lines 142–154, 511**: Replace hardcoded toast strings with i18n keys (`remediations.actionFailed`, `incidents.resolved`, etc.)
- [x] **`audit-list.tsx` line 91**: Replace hardcoded `'Action:'` label with i18n key
- [x] **`connection-modal.tsx` lines 282, 292 + `integration-modal.tsx` lines 195, 206 + `complete-profile-page.tsx` lines 108, 123**: Replace hardcoded `'Something went wrong...'` with existing `t('errors.generic')` key
- [x] **`approvals-list.tsx` line 309**: Remove `'current-user'` magic string fallback — throw or return early if not authenticated

### Leaky Abstractions
- [x] **`sign-up-page.tsx` lines 347, 356**: Replace hardcoded `https://causeflow.ai/terms` and `/privacy` URLs with `SITE.url` constant
- [x] **`approvals-list.tsx` lines 307–310**: Remove `respondedBy` from client POST body — server should derive identity from session via `withAuth()`
- [x] **`command-palette.tsx` line 53**: Merge duplicate React import into single import statement at top of file

### Complex Conditionals
- [x] **`billing-page.tsx` lines 525–531**: Replace 4-level nested ternary for CTA labels with a `Record<typeof ctaType, string>` lookup

### Inconsistent Error Handling
- [x] **`incident-detail.tsx` lines 285–290**: Convert `.then().catch()` to `async/await` with `try/catch` + user feedback (consistent with rest of file)
- [x] **`topology-view.tsx` lines 183–191, 449–455**: Convert `.then().catch()` to `async/await` with `try/catch`
- [x] **`pattern-insights.tsx` line 89**: Fix silent failure — add error state and error message instead of leaving component in permanent loading skeleton

---

## Phase 5: Efficiency Fixes

### HIGH PRIORITY: Double `/api/metrics` Fetch
- [x] **`use-credits.ts` line 29 + `use-dashboard-data.ts` line 43**: Both hooks fetch `/api/metrics` independently on dashboard load — `useCredits` now accepts optional `initialCreditsRemaining` parameter
- [x] Verify only one `/api/metrics` call per page load after fix

### HIGH PRIORITY: Credit TOCTOU Race Condition
- [x] **`analyses-handler.ts` lines 60–105**: Add DynamoDB conditional expression to `updateTenant`: `ConditionExpression: 'creditsUsed < creditsTotal'` and handle `ConditionalCheckFailedException` as 402 response
- [x] Add equivalent atomic check to in-memory dev store

### MEDIUM: `/api/metrics` Fetches 100 Full Items for Counts
- [x] **`metrics-handler.ts` lines 33–34**: Add `countAnalyses(tenantId)` method to incident repository using DynamoDB `Select: 'COUNT'` query
- [x] Add `countAnalysesThisMonth(tenantId, monthStart)` for monthly counts
- [x] Replace full `listAnalyses(limit: 100)` call with lightweight count queries

### MEDIUM: Dashboard Overview Fetch Coordination
- [ ] Combine `useDashboardData`, `system-status.tsx`, and `pattern-insights.tsx` fetches into a single coordinated load (or use `Promise.allSettled` in one hook) to reduce skeleton-to-content render transitions — DEFERRED (complexity vs. benefit)

### MEDIUM: Rate Limiter Memory Leak
- [x] **`lib/rate-limit.ts` lines 14, 50–54**: Add lazy eviction — check and delete expired entries on every call, not just at 10k threshold

### LOW: Missing Fetch Abort on Unmount
- [x] **`notification-bell.tsx` lines 50–59**: Add `AbortController` to `fetchNotifications` with cleanup in `useEffect`, matching the `cancelled` flag pattern in `useCredits`

### LOW: Caching Opportunities
- [x] **`/api/health/detailed`**: Add `Cache-Control: public, max-age=30, stale-while-revalidate=60` header to reduce polling load across concurrent users
- [x] **`/api/pattern-analytics`**: Add short-lived cache header (5 minutes) — data changes infrequently

---

## Phase 6: File Size Reduction

### Auth Route Handlers — Move Inline Logic to Context Layer
- [x] Create `contexts/identity/api/verify-email-handler.ts` — move logic from route.ts (109 lines)
- [x] Create `contexts/identity/api/reset-password-handler.ts` — move logic from route.ts (81 lines)
- [x] Create `contexts/identity/api/sign-up-handler.ts` — move logic from route.ts (78 lines)
- [x] Create `contexts/identity/api/forgot-password-handler.ts` — move logic from route.ts (58 lines)
- [x] Create `contexts/identity/api/resend-verify-email-handler.ts` — SKIPPED (resend handled inline within verify-email handler's `action === 'resend'` branch)
- [x] Convert all 4 auth route files to 1-line re-exports matching the rest of the routing pattern

### `mock-api-client.ts` Split (846 lines → domain modules)
- [x] Split into domain-specific mock modules:
  - `mock/incidents.ts` — incident, analysis, remediation mock methods
  - `mock/shared.ts` — health, notifications, metrics, topology, pattern analytics
  - `mock/settings.ts` — settings, API keys mock methods
  - `mock/integrations.ts` — integration mock methods
- [x] Update `mock-api-client.ts` to compose from domain modules (847 → 57 lines)

### `billing-page.tsx` Component Extraction (763 lines)
- [x] Extract plan comparison cards into `plan-card.tsx` sub-component
- [x] Extract subscription status banner into `subscription-status.tsx` sub-component
- [x] Extract checkout/CTA section into `billing-cta.tsx` sub-component
- [x] Target `billing-page.tsx` < 300 lines (762 → 193 lines)

### `topology-view.tsx` & `incident-detail.tsx` Component Extraction
- [x] `topology-view.tsx` (610L): Extract node renderer and edge renderer into sub-components (611 → 270 lines)
- [x] `incident-detail.tsx` (607L): Extract timeline section, remediation section, and feedback section into sub-components (542 → 251 lines)
- [x] Target both files < 300 lines

### Naming Clarification
- [x] Rename `billing/presentation/components/billing-page.tsx` → `billing-content.tsx` (the client component)
- [x] Rename `settings/presentation/components/settings-page.tsx` → `settings-content.tsx`

---

## Phase 7: Staging Auth Consolidation (Cross-app dependency)

- [x] Move staging auth cookie-setting logic to shared helper in `packages/shared/src/infrastructure/middleware/staging-auth.ts` (alongside existing `checkStagingAuth`)
- [x] Update `apps/dashboard/src/app/staging-auth/actions.ts` to use shared helper
- [x] Update `apps/website/src/contexts/shell/api/actions.ts` to use shared helper

---

## Phase 8: Validation & Compound

### Validation
- [x] Run `pnpm turbo build` — 6/6 tasks pass (full monorepo)
- [x] Run `pnpm turbo test` — 629/629 tests pass (7 fixed after Phase 5 mock updates)
- [x] Run `pnpm exec biome check apps/dashboard/` — 0 errors, 2 pre-existing warnings
- [x] Run `pnpm turbo check-types` — tsc --noEmit clean
- [x] Start dashboard dev server — no errors, all pages 200 OK
- [x] Verify only 1 `/api/metrics` call per dashboard load — useCredits accepts optional initial data
- [x] Spot-check key pages: /staging-auth (200), /auth/sign-in (200), /auth/sign-up (200)

### Compound
- [x] Document learnings under `## Learnings` below
- [x] Update `session-learnings.md` with any new patterns or rules
- [x] No new solution doc needed — patterns are codebase-specific, not broadly reusable

---

## Parallelism Plan

```
Phase 1: Dead code cleanup (sequential — small, quick)
Phase 2: Package extractions (sequential — foundation)
Phase 3: Batches 3A–3E can ALL run in parallel (different files/contexts)
Phase 4: Quality fixes — most can run in parallel (different files), except:
  - approvals-list respondedBy fix depends on understanding auth flow
Phase 5: Efficiency fixes:
  - Double metrics fetch + credit TOCTOU: sequential (shared concerns)
  - Rate limiter + notification abort + caching: parallel (independent)
Phase 6: File size:
  - Auth routes, mock-api split, billing extraction, topology/incident extraction: ALL parallel
  - Naming: can batch with billing extraction
Phase 7: Staging auth (sequential — cross-app)
Phase 8: Validation (sequential — must be last)
```

---

## Summary of Impact

| Metric | Before | After (Actual) |
|---|---|---|
| Duplicated functions/patterns | 10+ | 0 |
| Dead code files/types | 4+ | 0 |
| Files > 600 lines | 4 | 0 |
| `mock-api-client.ts` | 847 lines | 57 lines (+ 4 domain modules) |
| `billing-content.tsx` | 762 lines | 193 lines |
| `incident-detail.tsx` | 542 lines | 251 lines |
| `topology-view.tsx` | 611 lines | 270 lines |
| Duplicate `/api/metrics` calls | 2 per page load | 1 |
| Hardcoded English strings | 8+ | 0 (14 i18n keys added) |
| Credit race condition | exists | fixed with atomic deduction |
| Inconsistent error handling | 3 files | standardized async/await |
| Auth route files | 326 lines (4 files) | 4 lines (thin re-exports) |

---

## Learnings

### What Worked
- **Parallel worktree agents** for Phase 3 (5 independent deduplication batches) — all completed simultaneously, halving wall-clock time
- **Parallel agents without worktrees** for Phases 4+5+6 — no file overlaps between phases, all three ran concurrently
- **Mock-api-client domain split** was the highest-impact single change (847→57 lines, -93%)
- **Component extraction** consistently brought 600+ line files to <300 lines with clear responsibility boundaries

### What Didn't Work
- **Worktree agents didn't auto-commit** — required manual commit + merge afterward. Future worktree agents need explicit instructions to commit.
- **Phase 3B+3C merge conflict** on `connection-modal.tsx` and `integration-modal.tsx` — both files were modified by 3B (field extraction) and 3C (scroll lock hook). Resolved by keeping imports from both sides.
- **Test mocks broke** after Phase 5 efficiency changes — tests mocked old API (listAnalyses, updateTenant) but implementation now uses new methods (countAnalyses, deductCreditAtomic). Always update test mocks when changing repository APIs.
- **Dashboard overview fetch coordination** (Phase 5 item) deferred — combining useDashboardData, system-status, and pattern-insights into one coordinated fetch adds complexity without proportional benefit for a mock-data dashboard.

### Rules Confirmed
- When changing repository method signatures, immediately update all test mocks — tests don't auto-discover new methods
- DynamoDB `ConditionExpression` with `ConditionalCheckFailedException` handling is the correct pattern for atomic credit deduction
- `Select: 'COUNT'` queries are dramatically more efficient than fetching full items for counting
- Worktree agents that modify overlapping files will produce merge conflicts — merge non-overlapping worktrees first

### Deferred Items
- Dashboard overview fetch coordination (Phase 5) — low impact for mock-data stage
- `resend-verify-email-handler.ts` (Phase 6) — route doesn't exist; resend is handled inline in verify-email handler
