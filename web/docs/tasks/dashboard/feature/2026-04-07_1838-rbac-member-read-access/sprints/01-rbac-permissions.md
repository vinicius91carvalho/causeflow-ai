# Sprint 01 — RBAC Permissions Foundation

**Depends on:** none
**Blocks:** 02, 03
**Est. effort:** 30 min

## Goal
Add `VIEW_BILLING`, `VIEW_SETTINGS`, `VIEW_TEAM` permission constants and grant them to both `admin` and `member` roles. Update tests and documentation. This sprint is the foundation — all other sprints depend on the constants landing here first.

## Context
Currently, `permissions.ts` has `VIEW_INTEGRATIONS` but no `VIEW_BILLING`/`VIEW_SETTINGS`/`VIEW_TEAM`. Members cannot view any of these pages today. We are adding the missing view perms so members can read (but not mutate) these areas.

## File Boundaries
- **Create:** none
- **Modify:**
  - `apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts`
  - `apps/dashboard/src/contexts/identity/domain/rbac/permissions.test.ts` (create if missing — currently no `.test.ts` sibling exists, check with glob first; if absent, create it)
  - `apps/dashboard/CLAUDE.md` (RBAC table)
- **Read-only:** none
- **Shared contracts introduced:** `VIEW_BILLING`, `VIEW_SETTINGS`, `VIEW_TEAM` constants; admin gets all, member gets VIEW_* + `SUBMIT_ANALYSIS` + `VIEW_ANALYSES` + `VIEW_INTEGRATIONS`.

## Tasks
1. Read current `permissions.ts` (already seen — admin has all 7 perms, member has `SUBMIT_ANALYSIS, VIEW_ANALYSES, VIEW_INTEGRATIONS`).
2. Add `VIEW_BILLING: 'view_billing'`, `VIEW_SETTINGS: 'view_settings'`, `VIEW_TEAM: 'view_team'` to `PERMISSION` const (placed next to `VIEW_INTEGRATIONS` for consistency).
3. Update `ROLE_PERMISSIONS.admin` to include the three new perms.
4. Update `ROLE_PERMISSIONS.member` to include the three new perms (keeping all existing perms).
5. Glob for `permissions.test.ts`. If it exists, update it. If not, create it with full coverage.
6. Tests MUST cover:
   - `hasPermission('admin', VIEW_BILLING)` → true
   - `hasPermission('member', VIEW_BILLING)` → true
   - `hasPermission('admin', MANAGE_BILLING)` → true
   - `hasPermission('member', MANAGE_BILLING)` → false
   - Same pattern for SETTINGS, TEAM, INTEGRATIONS
   - `getPermissions('admin').length` === all 10 perms
   - `getPermissions('member')` includes all 4 VIEW_* perms and no MANAGE_* perm
   - `requirePermission('member', MANAGE_TEAM)` throws
7. Update `apps/dashboard/CLAUDE.md` RBAC table to show VIEW_BILLING/VIEW_SETTINGS/VIEW_TEAM rows with `yes | yes` and keep MANAGE_* rows as `yes | no`.

## Acceptance Criteria
- [ ] `VIEW_BILLING`, `VIEW_SETTINGS`, `VIEW_TEAM` exported from `permissions.ts`
- [ ] Both roles carry all four `VIEW_*` perms
- [ ] Member has zero `MANAGE_*` perms
- [ ] `pnpm vitest run apps/dashboard/src/contexts/identity/domain/rbac/` — green
- [ ] `pnpm exec biome check apps/dashboard/src/contexts/identity/domain/rbac/` — green
- [ ] CLAUDE.md RBAC table updated

## TDD Order
1. Write/update the test file first (Red)
2. Update `permissions.ts` to make tests pass (Green)
3. Update CLAUDE.md

## Return Summary (to orchestrator)
Report in ≤15 lines:
- Files changed with line counts
- Test results (pass count)
- Any deviations from plan
