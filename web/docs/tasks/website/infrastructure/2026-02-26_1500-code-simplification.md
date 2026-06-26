# Code Simplification & Cleanup

## Phase 1: Audit & Discovery
- [x] Scan all packages for unused exports, dead code, and redundant imports
- [x] Identify duplicate code patterns across packages
- [x] Check for unused dependencies in each package.json
- [x] Review component patterns for consistency

## Phase 2: Clean Code Fixes
- [x] Remove unused imports, exports, and dead code
- [x] Remove unused dependencies from package.json files
- [x] Simplify overly complex functions and components
- [x] Apply consistent patterns across the codebase
- [x] Remove console.logs, debug code, and commented-out code

## Phase 3: Local Verification
- [x] Run Biome lint/format check and fix issues
- [x] Run TypeScript type checking
- [x] Run all Vitest tests — fix any failures (537 passed)
- [x] Build all packages successfully (7/7)
- [x] Run Playwright E2E tests locally — fix any failures (123 passed)

## Phase 4: Staging Deployment & Verification
- [x] Deploy website to staging (https://staging.causeflow.ai)
- [x] Deploy dashboard to staging (https://dashboard-staging.causeflow.ai)
- [x] Run Playwright E2E tests against staging (123 passed, 0 failed)
- [x] Take screenshots to verify visual correctness

## Status: COMPLETED

## Changes Summary

### packages/shared
- Deleted `formatting.ts` + test (unused `formatPrice`, `formatNumber`)
- Deleted `navigation.ts` (unused `HEADER_NAV_ITEMS`, `FOOTER_*_LINKS`)
- Removed unused types: `RoadmapItem`, `MetricItem`, `StepItem`

### packages/analytics
- Removed `initGA4`, `initClarity` functions
- Cleaned barrel exports (only `AnalyticsProvider`, `AnalyticsContext`, `trackGA4Event`, configs remain)

### packages/forms
- Removed 7 unused barrel exports (`DemoRequestFormData`, `contactSchema`, `ContactSchemaType`, `FormState`, `FormspreeConfig`, `sanitizeFormData`, `sanitizeInput`)
- Internal functions preserved, only public API cleaned

### packages/auth
- Removed `isValidSession`, `requireAuth`, `requireRole`, `getAvatarColor` + their tests
- Cleaned barrel: removed `AuthState`, `AuthToken`, `AuthConfigOptions`, `GetUserProfileFn`, `AuthGuard`
- Kept `getUserInitials` (actively used) and `withAuth` (actively used)

### packages/ui
- Deleted `use-media-query.ts`, `use-scroll-position.ts`, entire hooks dir
- Deleted `grid-layout.tsx`
- Removed `badgeVariants` from exports

### apps/dashboard
- Simplified `error-tracker.ts` (kept only `captureException`, removed 4 unused functions + Sentry stubs)
- Deleted `request-logger.ts` entirely
- Removed `dotenv` devDependency

### apps/website
- Cleaned `rate-limit.ts` (removed unused `apiRateLimit` instance, unexported internal types)
- Removed `dotenv` devDependency

### tests
- Removed unused `screenshotPage` helper from `screenshots.spec.ts`
- Fixed FAQ accordion test (force click + retry for AnimateOnScroll timing)
- Fixed Playwright staging cookie config (added required `expires`, `httpOnly`, `secure`, `sameSite` fields)
