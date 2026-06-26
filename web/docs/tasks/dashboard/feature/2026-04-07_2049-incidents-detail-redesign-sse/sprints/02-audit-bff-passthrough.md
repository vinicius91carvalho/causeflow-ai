# Sprint 2: Audit BFF Passthrough + Action Registry

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprint 1)
- **Model:** sonnet
- **Estimated effort:** S

## Objective

Add `resourceType` and `resourceId` query parameters to the `/api/audit` BFF, extend `VALID_ACTIONS` with the agent / investigation action types, and verify the upstream filter works against the mock client. Independently shippable: this is a pure backend-for-frontend expansion that does not touch the UI.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/audit/api/__tests__/audit-handler.test.ts` — unit tests for the new query parameter behavior. (Create the `__tests__` folder if it doesn't already exist.)

### Modifies (can touch)

- `apps/dashboard/src/contexts/audit/api/audit-handler.ts` — accept and forward `resourceType`, `resourceId`. Validate `resourceType` against an allowlist constant.
- `apps/dashboard/src/contexts/audit/domain/types.ts` — extend `VALID_ACTIONS` to include `investigation.started`, `investigation.completed`, `investigation.aborted`, `investigation.failed`, `agent.started`, `agent.evidence_appended`, `agent.completed`. Add JSDoc explaining which are user-action vs agent-emitted. Add an `ALLOWED_AUDIT_RESOURCE_TYPES` const exporting `['incident', 'remediation', 'approval'] as const`.
- `apps/dashboard/src/lib/api/core-api-types.ts` — extend `ListAuditParams` interface to add `resourceType?: string; resourceId?: string;`.
- `apps/dashboard/src/lib/api/core-api-client.ts` — no change needed if `ListAuditParams` is the parameter type for `listAuditEntries`. (Verify by reading the file; if it inlines the params, update inline.)
- `apps/dashboard/src/lib/api/http-api-client.ts` — extend `listAuditEntries` to forward `resourceType` and `resourceId` to the upstream query string.

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/investigation/` — entire context. This sprint must not touch any investigation files.
- `core/docs/openapi.yaml` — reference for `AuditEntry` schema and the upstream `/v1/audit` parameters.

### Shared Contracts (consume from prior sprints or PRD)

- This sprint **defines** the `ALLOWED_AUDIT_RESOURCE_TYPES` constant and **extends** `ListAuditParams`. Sprint 3 will consume both via direct deep imports.

### Consumed Invariants (from INVARIANTS.md)

- `BFF audit param allowlist` — this sprint creates the constant referenced by the verify command.
- `No barrel imports` — direct deep paths only.

## Tasks

- [x] Read `apps/dashboard/src/contexts/audit/api/audit-handler.ts` to understand the existing parameter parsing pattern.
- [x] Read `apps/dashboard/src/contexts/audit/domain/types.ts` to see the existing `VALID_ACTIONS` and `AuditEntry`.
- [x] Read `apps/dashboard/src/lib/api/{core-api-types,core-api-client,http-api-client,get-api-client}.ts` to see how `ListAuditParams` and `listAuditEntries` are wired today. (There is no mock-api-client.ts.)
- [x] In `audit/domain/types.ts`:
  - Extend `VALID_ACTIONS` with the new entries.
  - Add JSDoc lines explaining: "User-emitted actions (operator, admin)" vs "Agent / system emitted actions (during investigation)".
  - Export `ALLOWED_AUDIT_RESOURCE_TYPES = ['incident', 'remediation', 'approval'] as const;` and `type AllowedAuditResourceType = (typeof ALLOWED_AUDIT_RESOURCE_TYPES)[number];`.
- [x] In `core-api-types.ts`, extend `ListAuditParams` with optional `resourceType` and `resourceId` string fields.
- [x] In `audit/api/audit-handler.ts`:
  - Import `ALLOWED_AUDIT_RESOURCE_TYPES`.
  - Parse `resourceType` and `resourceId` from `url.searchParams`.
  - If `resourceType` is provided, validate it against `ALLOWED_AUDIT_RESOURCE_TYPES`. If invalid, return `400 { error: "Invalid resourceType. Must be one of: ${ALLOWED_AUDIT_RESOURCE_TYPES.join(', ')}" }`.
  - Forward both to `client.listAuditEntries({ ..., resourceType, resourceId })`.
  - Existing behavior (action filter, pagination) MUST remain identical when the new params are absent.
- [x] In `http-api-client.ts` `listAuditEntries`, add `resourceType` and `resourceId` to the upstream query string builder. Use the existing `buildQueryString` helper.
- [x] (NO mock client to update — handler tests use Vitest's `vi.mock('@/lib/api/get-api-client', ...)` to inject a fake `listAuditEntries` directly.)
- [x] Write tests in `audit-handler.test.ts`:
  - Test 1: `GET /api/audit` (no params) returns all entries — backwards compatible.
  - Test 2: `GET /api/audit?resourceType=incident&resourceId=abc` filters correctly via the mock client.
  - Test 3: `GET /api/audit?resourceType=invalid` returns 400 with the allowlist error message.
  - Test 4: `GET /api/audit?resourceId=abc` (resourceId without resourceType) is allowed and forwarded.
  - Test 5: `GET /api/audit?action=incident.created&resourceType=incident&resourceId=abc` combines all filters.
  - Test 6: An action from the new `VALID_ACTIONS` entries (e.g. `agent.started`) passes the existing action validation.

## Acceptance Criteria

- [x] `GET /api/audit?resourceType=incident&resourceId=abc-123` returns only entries for that incident (verified against the mock client).
- [x] `GET /api/audit?resourceType=invalid` returns 400 with a descriptive error.
- [x] Existing `GET /api/audit?action=incident.created` still works unchanged (backwards compatibility).
- [x] `ALLOWED_AUDIT_RESOURCE_TYPES` is exported from `apps/dashboard/src/contexts/audit/domain/types.ts` and used by both the handler and (later) Sprint 3.
- [x] `VALID_ACTIONS` includes the seven new investigation/agent actions.
- [x] `ListAuditParams` (in `core-api-types.ts`) includes the two new optional fields.
- [x] All new audit-handler tests pass. All existing audit tests still pass.

## Verification

- [x] `pnpm exec biome check apps/dashboard/src/contexts/audit/`
- [x] `pnpm exec biome check apps/dashboard/src/lib/api/`
- [x] `pnpm vitest run apps/dashboard/src/contexts/audit`
- [x] `pnpm turbo check-types --filter=dashboard`
- [x] Invariant grep checks pass:
  - `grep "ALLOWED_AUDIT_RESOURCE_TYPES" apps/dashboard/src/contexts/audit/api/audit-handler.ts` (must match)
  - `grep "ALLOWED_AUDIT_RESOURCE_TYPES" apps/dashboard/src/contexts/audit/domain/types.ts` (must match)

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

- The existing handler is small (~40 lines). The change is additive — DO NOT rewrite the existing parameter parsing.
- The upstream Core API (`/v1/audit`) supports `resourceType` and `resourceId` query params per the OpenAPI spec, but the dashboard's BFF currently ignores them. The fix is purely a passthrough.
- The upstream `getActionsFromUserAction` discrimination is not our concern — we just expand the allowlist of valid actions to include the agent-emitted ones so they pass our existing filter validation.
- **No mock client exists.** `getApiClient()` always returns the real `HttpApiClient` and throws if `CORE_API_URL` is unset. The test file uses Vitest's `vi.mock('@/lib/api/get-api-client', () => ({ getApiClient: () => ({ listAuditEntries: vi.fn().mockResolvedValue(...) }) }))` to inject a fake. This is the same pattern used by other handler tests in the dashboard (see `apps/dashboard/src/contexts/investigation/api/incidents-list-handler.test.ts` for reference).
- AuditEntry fixture shape (use this in the test):
  ```json
  { "entryId": "audit-1", "tenantId": "t1", "action": "agent.started", "actorType": "agent",
    "actorEmail": "agent@causeflow.ai", "resourceType": "incident",
    "resourceId": "incident-mock-1", "entryHash": "h1", "createdAt": "2026-04-07T20:00:00Z" }
  ```
- Note that the test file path uses `__tests__/audit-handler.test.ts` inside the bounded context, NOT next to the route.ts file in `app/api/audit/`. Project rules forbid logic in `app/`.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
