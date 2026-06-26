# Sprint 4 — E2E Tests Covering the Three Scenarios

**Executor:** sprint-executor (sonnet) — runs in `causeflow/web`
**Isolation:** worktree
**Est. duration:** 45-60 minutes
**Dependency:** runs after Sprints 2 and 3 have merged to their default branches
and deployed to staging.

## Goal

Prevent regression. Add Playwright E2E coverage for AC-1/2/3 and a backend
contract-level test for AC-4 that runs in CI.

## Preconditions

- Staging is up with the fixes from Sprints 2 and 3.
- `STAGING_TEST_USER` and `STAGING_TEST_PASSWORD` available to CI (already
  wired via GitHub secrets / `.env.staging`).
- If AC-4 requires a second tenant login and one is not available, sprint
  executor MUST surface the question to the user before starting.

## Tasks

1. **Playwright specs** in `causeflow/web` under
   `apps/dashboard/e2e/audit/`:
   - `audit-load-more.spec.ts` — asserts Load More appends a distinct page,
     entries are ordered by timestamp desc, Load More disappears when the
     dataset is exhausted (seed or mocked).
   - `audit-actor-attribution.spec.ts` — performs a user-authored action
     (e.g. updates a profile setting), waits for it to appear in the audit
     log, asserts `actor` shows the user email and NOT `system`.
   - `audit-evidences.spec.ts` — finds an entry known to carry evidences,
     asserts the evidences block renders with at least 1 item.
2. **Contract test** in `causeflow/core` at
   `src/modules/audit/infra/__tests__/tenant-isolation.contract.test.ts`
   (if not added in Sprint 2) — seeds two tenants, asserts list queries are
   mutually invisible.
3. Wire the new Playwright specs into the existing staging E2E workflow.
4. Run the full suite against staging; all three specs green.

## File boundaries

> Web-repo paths are narrative only; boundary validation runs inside the
> web-repo worktree at execution time.

### Creates
- Three new Playwright specs under web repo `apps/dashboard/e2e/audit/`:
  audit-load-more, audit-actor-attribution, audit-evidences.
- src/modules/audit (new contract test file under __tests__ subdir) — only
  if Sprint 2 did not already add it.

### Modifies
(CI workflow file in the web repo may be touched to register the new specs;
narrative only.)

### Read-Only
All production code. Sprint 4 is test-only.

### Shared Contracts
(none — tests only)

## Acceptance criteria

- All three Playwright specs pass against staging (3 runs stable, no flake).
- Tenant-isolation contract test passes in core CI.
- CI workflow executes the new specs on every PR to default branch.

## Return contract

Return a structured summary with exactly these fields:
- `specs_added: string[]`
- `contract_tests_added: string[]`
- `staging_run: "PASS" | "FAIL"`
- `flake_runs: number` (number of retries needed across 3 runs)
- `ci_wired: boolean`
- `notes: string` (≤5 lines)
