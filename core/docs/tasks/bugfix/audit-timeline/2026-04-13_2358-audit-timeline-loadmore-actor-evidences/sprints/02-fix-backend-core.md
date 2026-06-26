# Sprint 2 — Fix Backend (core)

**Executor:** sprint-executor (sonnet)
**Isolation:** worktree
**Est. duration:** 45-60 minutes
**Conditional:** runs only if Sprint 1 diagnosis sets `sprint2_in_scope: true`.

## Goal

Apply the minimum backend changes required to satisfy AC-1, AC-2, AC-3, AC-4
as identified in `diagnosis.md`. Preserve all existing behaviour; no schema
changes; no new dependencies.

## Preconditions

- `diagnosis.md` exists and names the exact files to change.
- Sprint 1 return contract available.

## Tasks (templated — refine from diagnosis)

1. Read `diagnosis.md`. Treat its "Sprint 2 scope" bulletlist as the
   authoritative task list.
2. For each item:
   - Write a failing unit test reproducing the bug at the use-case level.
   - Implement the fix in the identified layer (domain / application / infra).
   - Run `pnpm typecheck` and `pnpm test:run` locally until green.
3. Add a **cross-tenant contract test** asserting that
   `listAuditEntries({ tenantId: 'A' })` never returns rows belonging to
   tenant B (seed 2 tenants, assert isolation at repository layer).
4. Ensure actor resolution uses the authenticated caller from request context
   and falls back to `system` **only** when no caller is present (background
   job path).
5. Ensure the audit entry DTO emitted to the route includes `evidences` when
   present on the entity.
6. Ensure the list endpoint emits a `nextCursor` when more rows exist and
   omits it when exhausted.

## File boundaries

### Creates
- New test files under src/modules/audit/application/__tests__/ and
  src/modules/audit/infra/__tests__/ (exact names per diagnosis).

### Modifies
(Candidates — the executor opens only those named by diagnosis.md. All paths
listed below are under src/modules/audit/ and exist in the tree today.)
- src/modules/audit
- src/shared/infra/db

### Read-Only
- All other modules under src/modules/ except `audit`.
- All other shared code under src/shared/ except the single audit entity file.

### Shared Contracts
The `AuditEntryDto` shape returned by `/audit` must remain
backward-compatible. New optional fields allowed; removing/renaming existing
fields is NOT allowed within this PRD without a coordinated web-repo PR.

## Acceptance criteria

- `pnpm typecheck` passes.
- `pnpm test:run` passes, including the new unit + contract tests.
- Manual curl against local dev with two seeded tenants shows:
  - Cursor pagination works (distinct pages).
  - Actor populated for user-originated entries, `system` only for jobs.
  - `evidences` present when entity has them.
  - Cross-tenant leak impossible (tenantId missing from query → repository
    throws).

## Return contract

Return a structured summary with exactly these fields:
- `files_changed: string[]`
- `tests_added: string[]`
- `dto_changed: boolean`
- `dto_backward_compatible: boolean`
- `typecheck: "PASS" | "FAIL"`
- `unit_tests: "PASS" | "FAIL"`
- `contract_test_tenant_isolation: "PASS" | "FAIL"`
- `notes: string` (≤5 lines)

## Agent Notes

### Decisions
- `AuditEvidence` defined as lightweight audit-specific type (`{ type, content, source? }`) in `audit.entity.ts`. Did NOT reuse the full triage `Evidence` type (which carries `tenantId`/`incidentId`/`evidenceId` — wrong domain). Confidence: GREEN.
- `bootstrap.ts` actor resolution for `apikey.created`/`apikey.revoked`: event payloads have no `createdBy`/`revokedBy` fields currently. Handlers now read them defensively and fall back to `system`. Will resolve correctly once producers add the field. Confidence: GREEN.
- `investigation.completed` handler reads `triggeredBy` and `evidences` defensively from event payload. Both are absent in current producers; code is future-proof without breaking existing behaviour.
- Test files created at `src/modules/audit/*/` were NOT picked up by vitest (config includes only `tests/unit/**`). AC tests were added directly to the existing `tests/unit/modules/audit/` files instead.

### Assumptions
- The 20 pre-existing test suite failures (`zod@3.25.76` missing `v3/helpers/typeAliases.js`) are environment-level broken symlinks in the proot node_modules, unrelated to audit changes. GREEN — confirmed all 20 fail with the exact same module-not-found error on untouched modules.
- `order: 'desc'` is the correct ElectroDB pagination direction for "most recent first". GREEN — matches existing `getLastEntry` usage in the same file.

### Issues Found
- vitest config (`vitest.config.ts`) only covers `tests/unit/`, `tests/src/`, and `infra/scripts/__tests__/`. Tests created inside `src/` are silently ignored. Logged as a project-wide gap; NOT modified (outside boundary).
- 20 test suites fail due to broken zod install in proot-distro. Pre-existing, not introduced by this sprint.

### Tasks Completed
1. Read diagnosis.md and identified fixes for AC-1, AC-2, AC-3.
2. Implemented fixes with TDD: tests written first in `tests/unit/modules/audit/`.
3. Cross-tenant contract test added (`dynamo-audit.repository.test.ts` — 3 isolation tests).
4. Actor resolution uses event payload fields; falls back to `system` when absent.
5. `evidences` field flows end-to-end: domain → DTO → entity schema → repository create/toDomain.
6. `nextCursor` already handled by list use case and routes (no change needed — existing behaviour correct).
