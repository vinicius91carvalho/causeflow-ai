# Sprint 04 — E2E Member Read Access Verification

**Depends on:** 02, 03
**Blocks:** none
**Est. effort:** 30-45 min

## Goal
Playwright test that signs in as a member, visits all four pages, asserts view content loads AND mutation controls are absent. Dev server smoke-check.

## File Boundaries
- **Create:** `tests/dashboard/rbac-member-read.spec.ts`
- **Modify:** none
- **Read-only:** all four presentation/pages files (to identify selectors)

## Context
The dashboard Playwright tests live under `tests/dashboard/`. An existing `tests/dashboard/dashboard-overview.spec.ts` is a reference for fixture patterns. Check it first for the member-sign-in helper (if none, create a minimal one).

## Tasks
1. Read `tests/dashboard/dashboard-overview.spec.ts` to learn the sign-in pattern used in this suite.
2. If a member fixture exists (e.g. `MEMBER_EMAIL` / `MEMBER_PASSWORD`), reuse it. Otherwise, document in the spec file what env vars are needed and mark individual test cases `test.skip` when env is missing, so the suite doesn't fail CI.
3. Write the test file with 4 test cases:
   - `test('member can view billing page with Stripe Portal button and no mutation controls')`
   - `test('member can view settings page with disabled inputs and no save button')`
   - `test('member can view team page with no invite or role-change controls')`
   - `test('member can view integrations page with no connect or disconnect controls')`
4. Assertions per test (all `expect(...).toBeVisible()` or `.not.toBeVisible()`):
   - Billing: `getByRole('button', { name: /manage billing in stripe/i })` visible; `getByRole('button', { name: /change plan/i })` hidden.
   - Settings: all form inputs `toBeDisabled()`; `getByRole('button', { name: /save/i })` not present.
   - Team: member list table visible; `getByRole('button', { name: /invite/i })` not present; role cells are plain text (no `combobox`).
   - Integrations: integration cards visible; `getByRole('button', { name: /^(connect|disconnect)/i })` not present.
5. Mark tests `@member-read` via tag for selective runs.

## Dev Server Smoke Check
1. Kill any existing next processes: `pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null`
2. `pnpm --filter dashboard dev` in background
3. Sign in as a member in a browser (Playwright MCP or manual)
4. Navigate to each page and verify visually
5. Kill server when done

## Acceptance Criteria
- [ ] `tests/dashboard/rbac-member-read.spec.ts` created with 4 test cases
- [ ] `pnpm exec playwright test tests/dashboard/rbac-member-read.spec.ts` — green (or cleanly skipped with actionable message if env missing)
- [ ] Dev server smoke: all four pages render for member without errors in server logs
- [ ] Console logs clean: no 403 errors, no missing i18n keys, no hydration warnings on touched pages
- [ ] Processes killed when done

## Return Summary
- Test file diff summary
- Test run output (passes/skips/fails)
- Dev server smoke results per page (pass/fail per page)
- Any selector that didn't match (so the page sprint can be fixed)
