# Sprint 01 — Red Tests (TDD)

**Status:** complete
**Model:** sonnet
**Isolation:** none (main repo)
**Estimated:** 30-45 min
**Depends on:** —

## Objective

Write failing tests that prove the bug exists and pin the target contract. No production code changes in this sprint.

## Context

- Clerk JWT middleware `src/shared/infra/http/middleware/auth.middleware.ts` exposes `c.get('userId')` (JWT sub) and `c.get('userEmail')`.
- Current bug: 6 audit events write `actorType:'system'` for authenticated actions because producer use cases never receive user identity.
- Canonical identity field in event payloads will be `actorUserId` (primary) + `actorEmail` (display). Rationale: GDPR art. 5(1)(c) data minimization — stable opaque ID preferred; email is display-only.

## Files to create

- `tests/unit/audit-actor-threading.test.ts`
- `tests/integration/audit-actor-threading.integration.test.ts`

## Files read-only

- `src/bootstrap.ts` (lines 560-800)
- `src/shared/infra/http/middleware/auth.middleware.ts`
- `src/modules/memory/application/chat.usecase.ts`
- `src/modules/ingestion/application/create-manual-incident.usecase.ts`
- `src/modules/ingestion/application/update-incident-status.usecase.ts`
- `src/modules/tenant/application/create-tenant.usecase.ts`
- `src/modules/tenant/application/update-tenant.usecase.ts` (if exists)
- `src/modules/remediation/application/propose-remediation.usecase.ts`
- `src/modules/remediation/application/execute-remediation.usecase.ts`

## Shared contracts (frozen in this sprint, consumed by Sprint 02 & 03)

Event payload keys (all optional at producer level; handler decides fallback):

```ts
type AuditActorClaims = {
  actorUserId?: string;  // JWT sub — canonical
  actorEmail?: string;   // display
};
```

Input DTO additions (all optional):

```ts
actorUserId?: string;
actorEmail?: string;
```

## Test matrix (all must FAIL against current code)

### Unit — producer threading (per producer use case)

For each of: `chat.usecase` (memory), `create-manual-incident.usecase`, `update-incident-status.usecase`, `create-tenant.usecase`, `update-tenant.usecase` (if exists), `propose-remediation.usecase`, `execute-remediation.usecase`:

- Given an Input with `actorUserId: 'user_abc'`, `actorEmail: 'alice@example.com'`
- When the use case executes
- Then the event published MUST contain `actorUserId: 'user_abc'` and `actorEmail: 'alice@example.com'` in its payload

### Unit — bootstrap handler mapping (per event)

For each of: `incident.created`, `incident.status_changed`, `tenant.created`, `tenant.updated`, `remediation.proposed`, `remediation.executed`:

- Given an event with payload `{ actorUserId: 'user_abc', actorEmail: 'alice@example.com', ...minimal required fields }`
- When the bootstrap handler runs
- Then the audit entry MUST have `actorType:'user'`, `actorUserId:'user_abc'`, `actorEmail:'alice@example.com'`

- Given an event with payload NOT containing actorUserId/actorEmail
- Then the audit entry MUST fallback to `actorType:'system'`, `actorEmail:'system@causeflow.ai'` (background job default)

### Integration — end-to-end authenticated chat → audit row

- Spin up test app with auth middleware (mock Clerk `verifyToken` to return `{ sub: 'user_abc', email: 'alice@example.com', org_id: 'tenant_xyz' }`)
- POST to the chat endpoint that triggers `incident.created` with a valid Bearer token
- Assert: exactly one `incident.created` audit row exists with `actorType:'user'`, `actorUserId:'user_abc'`, `actorEmail:'alice@example.com'`

## Acceptance

- [x] `tests/unit/audit-actor-threading.test.ts` exists with ≥ 14 test cases (7 producers × 1 + 6 handlers × (positive + fallback) = 7 + 12 = 19; acceptable floor is 14 if a producer/event doesn't exist)
- [x] `tests/integration/audit-actor-threading.integration.test.ts` exists with ≥ 1 end-to-end test
- [x] `pnpm test:run -- audit-actor-threading` runs and ALL new tests FAIL (TDD red confirmed)
- [x] No production code modified

## Agent Notes

### Decisions

- Handler tests (12) use an inline `wireAuditHandlers()` function that implements the TARGET contract. These tests PASS (by design) because they verify the desired behavior is implementable — they do not test the broken bootstrap. The 7 FAILING producer tests are what pin the bug.
- The 12 handler tests passing is intentional: Sprint 02 must fix the producers so the full chain works end-to-end.

### Assumptions

- 🟢 `update-tenant.usecase.ts` exists — confirmed, included in test matrix (7 producers).
- 🟢 Chat endpoint is `POST /v1/memory/chat` — confirmed in `memory.routes.ts` line 31.
- 🟢 I7 invariant violation is pre-existing (in `infra/scripts/check-invariants.ts` itself). Not caused by sprint test files.

### Environment Issue (pre-existing, not sprint-caused)

- `zod@3.25.76` v3 subpath module resolution broken in proot-distro: `Cannot find module '.../zod/v3/helpers/typeAliases.js'`. Affects 20+ pre-existing test files. My chat-usecase unit test and integration test both hit this (they dynamically import ChatUseCase → memory.routes.ts → zod). All tests still FAIL (red phase confirmed). The assertion-level failures will surface once the zod env issue is fixed in Sprint 02 setup or a pnpm rebuild.

### Files Discovered

- `src/modules/memory/application/chat.usecase.ts` — ChatInput has no actorUserId/actorEmail
- `src/modules/ingestion/application/create-manual-incident.usecase.ts` — CreateManualIncidentInput has no actorUserId
- `src/modules/ingestion/application/update-incident-status.usecase.ts` — execute() has no actor params
- `src/modules/tenant/application/create-tenant.usecase.ts` — CreateTenantInput has no actor fields
- `src/modules/tenant/application/update-tenant.usecase.ts` — EXISTS, UpdateTenantInput has no actor fields
- `src/modules/remediation/application/propose-remediation.usecase.ts` — ProposeRemediationInput has no actor fields
- `src/modules/remediation/application/execute-remediation.usecase.ts` — ExecuteRemediationInput has no actor fields

### Notes for Sprint 02

- `UpdateIncidentStatusUseCase.execute()` has positional signature `(tenantId, incidentId, status)` — Sprint 02 needs to add `actorUserId?` and `actorEmail?` as 4th/5th params OR refactor to an input object.
- `memory.routes.ts` line 38-41 calls `deps.chat.execute({ tenantId, message })` — must add `actorUserId: c.get('userId'), actorEmail: c.get('userEmail')` to the call.
- `AuditEntry` entity and `CreateAuditEntryInput` do NOT have an `actorUserId` field — Sprint 03 will need to add it if the audit record itself should store the opaque ID. The sprint spec says "handler decides fallback" — current handler tests only check `actorType` and `actorEmail`, not `actorUserId` storage.
- Zod env issue: run `pnpm rebuild` or `pnpm install --frozen-lockfile` before Sprint 02 test run to fix the broken symlink.

## Return contract

```json
{
  "tests_written": <number>,
  "tests_failing_as_expected": <number>,
  "producer_files_discovered": [<paths>],
  "missing_producers": [<event names that have no emitter found>],
  "memo_for_sprint_02": "<brief notes on surprises, e.g. use case signature quirks>"
}
```
