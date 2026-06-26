# Plan 2: Dashboard E2E Tests for All Functionalities

Comprehensive E2E test suite for the entire Dashboard app. Test all pages, flows, and functionalities. Fix any errors found during testing.

## Phase 1: Research & Audit Existing Tests
- [x] Read all existing Dashboard E2E test files in `tests/dashboard/`
- [x] Map all Dashboard routes to test coverage (identify gaps)
- [x] Read Dashboard component structure to understand what needs testing
- [x] List all API routes that need mocking/testing

## Phase 2: Auth Flow E2E Tests
- [x] Test sign-in page renders correctly (mobile + desktop)
- [x] Test sign-up page renders correctly (mobile + desktop)
- [x] Test forgot-password page renders correctly
- [x] Test verify-email page renders correctly
- [x] Test auth form validation (empty fields, invalid email, short password)
- [x] Test navigation between auth pages (sign-in ↔ sign-up ↔ forgot-password)
- [x] Fix any errors found in auth flows

## Phase 3: Onboarding Flow E2E Tests
- [x] Test welcome page renders correctly
- [x] Test connect-integration step renders correctly
- [x] Test complete-profile step renders correctly
- [x] Test onboarding flow progression (step 1 → 2 → 3)
- [x] Test responsive layout across viewports
- [x] Fix any errors found in onboarding flows

## Phase 4: Dashboard Home E2E Tests
- [x] Test dashboard home page renders with all sections
- [x] Test metrics cards display correctly
- [x] Test credits banner renders with upgrade link
- [x] Test empty state for new tenants
- [x] Test responsive layout (mobile sidebar collapse, desktop sidebar expand)
- [x] Test sidebar navigation works correctly
- [x] Test topbar elements render correctly
- [x] Fix any errors found on dashboard home

## Phase 5: Analyses E2E Tests
- [x] Test analyses list page renders correctly
- [x] Test empty state when no analyses exist
- [x] Test "New Analysis" page renders with form
- [x] Test analysis creation form validation
- [x] Test analysis detail page renders correctly
- [x] Test analysis status indicators
- [x] Test responsive layout across viewports
- [x] Fix any errors found in analyses flows

## Phase 6: Integrations E2E Tests
- [x] Test integrations page renders correctly
- [x] Test integration cards display with status indicators
- [x] Test connect/disconnect integration modals
- [x] Test integration search/filter functionality
- [x] Test responsive layout (grid → list on mobile)
- [x] Test light and dark mode rendering
- [x] Fix any errors found in integrations

## Phase 7: Team Management E2E Tests
- [x] Test team page renders correctly
- [x] Test team member list displays
- [x] Test invite member functionality
- [x] Test role management UI
- [x] Test responsive layout across viewports
- [x] Fix any errors found in team management

## Phase 8: Settings E2E Tests
- [x] Test settings page renders with all tabs (Profile, Company, Notifications, Appearance)
- [x] Test Profile tab form fields and validation
- [x] Test Company/Admin tab renders correctly
- [x] Test Notifications tab toggle switches
- [x] Test Appearance tab theme switching (light/dark)
- [x] Test command palette (Cmd+K) opens and functions
- [x] Test responsive layout across viewports
- [x] Fix any errors found in settings

## Phase 9: Cross-Cutting E2E Tests
- [x] Test breadcrumb navigation across all pages
- [x] Test global toast notifications (success, error, warning, info)
- [x] Test error boundary renders on error
- [x] Test 404 page renders for invalid routes
- [x] Test keyboard accessibility across main flows
- [x] Test dark mode across all pages

## Phase 10: Verification & Cleanup
- [x] Run ALL Dashboard E2E tests together — fix failures (476 passed, 0 failed)
- [x] Run `pnpm turbo build` — fix any build errors
- [x] Run `pnpm exec biome check .` — fix lint issues
- [x] Run `pnpm turbo check-types` — fix type errors
- [x] Run Vitest unit tests — fix failures
- [x] Take screenshots of all major pages (mobile + desktop) — 18 screenshots in ./screenshots/
- [x] Remove any unused test utilities or dead code
