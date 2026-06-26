# Simplify Review: Fix Issues Found in 23-Commit DDD Refactoring

## Context (The Why)
Code review of 23 commits ahead of remote main (429 files, 27K+ insertions) found 40 issues across reuse, quality, and efficiency categories.

## Acceptance Criteria
- [x] All critical bugs fixed
- [x] Cross-context abstraction violations resolved
- [x] Duplicate code consolidated
- [x] Handler patterns standardized
- [x] Performance issues addressed
- [x] All tests pass after changes (629 passed, build green)

## Phase 1: Critical Fixes (Batch 1 — parallel)

### Batch 1A: Approvals bug + cross-context violations
- [x] Fix approvals-list.tsx to send `respondedBy` to handler
- [x] Move `getMockApprovals` out of investigation into approvals context
- [x] Move `getMockAuditEntries` out of investigation into audit context
- [x] Fix approvals-list.tsx to import types from own domain
- [x] Fix audit-list.tsx to import types from own domain

### Batch 1B: Performance — handler fixes
- [x] Fix metrics-handler.ts — reduce limit, optimize counting
- [x] Fix topology-service-handler.ts — pass filter params to listServiceEdges
- [x] Fix withAuth closure per-request in analyses-id-handler.ts and remediations-id-handler.ts

### Batch 1C: Performance — mock-data timestamps
- [x] Make mock-data timestamps lazy (computed per-call, not module-level)
- [x] Fix hardcoded `tenantId: 'mock-tenant'` to use passed tenantId

## Phase 2: High Priority Fixes (Batch 2 — parallel)

### Batch 2A: Domain type imports across contexts
- [x] Fix integrations-client.tsx to import from integrations/domain/types
- [x] Fix integration-repository.ts to import from integrations/domain/types
- [x] Fix user-repository.ts to import from identity/domain/types
- [x] Fix webhook-handlers.ts to import from billing/domain/types

### Batch 2B: Duplicate code elimination
- [x] Extract `integrationNames` to shared location, update both handlers
- [x] Remove duplicate `connectIntegrationSchema` from identity (import from integrations)
- [x] Remove duplicate `CTAButtonClient` in website shell context
- [x] Extract shared `deepMerge` utility (website adopt variadic form)

### Batch 2C: Handler utility standardization
- [x] Fix 3 handlers to use `parseBody()` instead of manual JSON parsing
- [x] Fix settings-handler to use its own `updateSettingsSchema`
- [x] Add Zod enum validation for `action` in approval-respond and remediations-id handlers
- [x] Fix analyses-handler to import `IncidentStatus` from domain instead of inline
- [x] Extract `NO_CACHE_HEADERS` constant
- [x] Fix notifications-handler limit capping

## Phase 3: Medium Priority Fixes (Batch 3 — parallel) [COMPLETE]

### Batch 3A: More duplicates
- [x] Extract Google OAuth SVG (18-line block) to `identity/presentation/components/google-icon.tsx`, import in `sign-in-page.tsx` + `sign-up-page.tsx`
- [x] Extract `isDev()` + `globalForDev.__dev*Store` pattern (repeated in 4 repos: `user-repository.ts`, `integration-repository.ts`, `analysis-repository.ts`, `incident-repository.ts`) into a shared utility in `lib/db/dev-store.ts`
- [x] Export `VALID_ACTIONS` from `audit/domain/types.ts`, import in both `audit-handler.ts` and `audit-list.tsx` (replace local `ACTION_FILTERS` array)
- [x] Export `teamSizeValues` from `identity/api/complete-profile-handler.ts` or `identity/domain/types.ts`, import in `complete-profile-page.tsx`
- [x] Replace hardcoded `'https://dashboard.causeflow.ai'` in `billing/api/checkout-handler.ts` and `billing/api/portal-handler.ts` with `SITE.dashboardUrl` from `@causeflow/shared`
- [x] Consolidate 3 relative-time formatters (`formatDistanceToNow` in `integrations/time-utils.ts`, `formatRelativeTime` in `investigation/incident-feedback.tsx`, `timeAgo` in `shared/notification-bell.tsx`) into `shared/lib/format-date.ts` with `{ compact?: boolean }` option

### Batch 3B: Quality + efficiency cleanup
- [x] Fix `getSystemHealth()` in `lib/api/mock-api-client.ts` to use single `reduce()` instead of 4 `.filter()` passes; same for `getIncidentAnalytics()`
- [x] Fix `incident-repository.ts` + `remediation-repository.ts` devStore scan: key by tenantId first (`Map<string, Map<string, T>>`) or prefix-scan
- [x] Parallelize `settings-handler.ts` PATCH: `tenantRepository.updateTenant()` and `settingsRepository.updateSettings()` have no data dependency — use `Promise.all()`
- [x] Remove meaningless `webhookRuntime`/`webhookDynamic` re-exports from `billing/index.ts` (Next.js only reads config from route files)
- [x] Fix `identity/index.ts` `export *` for 5 components — change to named exports or note that consumers should use direct deep paths per project policy
- [x] Fix `setTimeout` without `clearTimeout` cleanup in settings API keys tab `useEffect`

### Batch 3C: Minor items
- [x] Extract page header JSX pattern (`<h2>title</h2><p>description</p>`) to `shared/presentation/components/page-header.tsx` (used in 6 pages)
- [x] Extract auth card wrapper class (89-char string) to `identity/presentation/components/auth-card.tsx` (used in 4 auth pages)
- [x] Extract `generateId(prefix)` utility to `packages/shared` (3 callsites: `tenant-`, `anlys-`, `inc-` prefixed IDs)
- [x] Remove deprecated `simulateAnalysis` alias from `investigation/index.ts`
- [x] Reduce `MockApiClient.randomDelay()` for SSR paths (50ms server, 300ms client)

NOTE: `getMock*() re-sort` already fixed in Phase 1C (factory functions create data in sorted order).
NOTE: `website i18n compose variadic deepMerge` already fixed in Phase 2B.

## Phase 4: Validation (all phases)
- [x] Run `pnpm turbo build` — 7/7 successful
- [x] Run `pnpm turbo test` — 761 tests passed
- [x] Run `pnpm exec biome check .` — 0 errors
- [x] Run `pnpm turbo check-types` — 14/14 successful

## Phase 6: Compound
- [x] Document patterns in session-learnings

## Learnings
- Worktree agents that don't commit their changes require manual commit + merge after completion
- When 2+ worktrees touch overlapping files (sign-in/sign-up pages), import-only conflicts are trivial to resolve
- Batch 3A (format-date consolidation) kept time-utils.ts as thin wrapper for backward compat with existing tests
- PageHeader component intentionally skipped incidents page (has integrated "New Incident" button)
- `getDevStore()` utility pattern reduces ~8 lines of globalThis boilerplate to 1 line per repository
