# Sprint 03 — Handler Updates (bootstrap.ts)

**Status:** not_started
**Model:** sonnet
**Isolation:** worktree
**Estimated:** 45-60 min
**Depends on:** Sprint 02 (producers now emit actorUserId/actorEmail)

## Objective

Update the 6 event→audit handlers in `src/bootstrap.ts` to read canonical `actorUserId` + `actorEmail` from event payloads, set `actorType:'user'` when present, and fallback to `actorType:'system'` + `actorEmail:'system@causeflow.ai'` when absent (background jobs, unauthenticated webhooks). Make all Sprint 01 handler unit tests + integration test GREEN.

## Canonical contract

```ts
// Event payload (from Sprint 02):
{ actorUserId?: string, actorEmail?: string, ...domainFields }

// AuditEntry mapping rule:
if (payload.actorUserId) {
  actorType = 'user';
  actorUserId = payload.actorUserId;
  actorEmail = payload.actorEmail;  // may be undefined; display-only
} else {
  actorType = 'system';
  actorUserId = undefined;
  actorEmail = 'system@causeflow.ai';
}
```

NOTE: Sprint 04 adds `actorUserId` to `AuditEntry` schema. This sprint may write `actorUserId` into the audit create call assuming Sprint 04's schema change is merged first — OR Sprint 03 can stage the value in a local variable and wait for Sprint 04 to persist it. **Decision: Sprint 04 MUST merge before Sprint 03 runs in production**, but during development Sprint 03 writes the field as if it exists (TypeScript will flag until Sprint 04 lands). If ordering is a problem during execution, run Sprint 04 before Sprint 03.

## Files to modify

- `src/bootstrap.ts` — 6 handlers (lines ~560-800, current commit 429a441)

## Files read-only

- All Sprint 01 tests
- All Sprint 02 producer code

## Handlers to fix

### 1. `incident.created` (currently reads legacy `createdBy`)

**Before:**
```ts
const actor = payload.createdBy ? {
  actorType: 'user' as const,
  actorEmail: payload.createdBy,
} : {
  actorType: 'system' as const,
  actorEmail: 'system@causeflow.ai',
};
```

**After:**
```ts
const actor = payload.actorUserId ? {
  actorType: 'user' as const,
  actorUserId: payload.actorUserId,
  actorEmail: payload.actorEmail,
} : {
  actorType: 'system' as const,
  actorEmail: 'system@causeflow.ai',
};
```

Keep `createdBy` read as secondary fallback for one deploy cycle (backwards compat):

```ts
const effectiveUserId = payload.actorUserId;
const effectiveEmail = payload.actorEmail ?? payload.createdBy;
const actor = effectiveUserId ? {
  actorType: 'user' as const,
  actorUserId: effectiveUserId,
  actorEmail: effectiveEmail,
} : {
  actorType: 'system' as const,
  actorEmail: 'system@causeflow.ai',
};
```

### 2. `incident.status_changed` (currently hardcoded system)

Replace hardcoded `{ actorType: 'system', actorEmail: 'system@causeflow.ai' }` with canonical mapping above.

### 3. `tenant.created` (currently hardcoded system)

Replace hardcoded system with canonical mapping.

### 4. `tenant.updated` (currently hardcoded system)

Replace hardcoded system with canonical mapping.

### 5. `remediation.proposed` (currently hardcoded system)

Replace hardcoded system with canonical mapping.

### 6. `remediation.executed` (currently hardcoded system)

Replace hardcoded system with canonical mapping. NOTE: auto-remediation paths may legitimately have no actor — they correctly fall back to system. Document in comment.

## Handlers NOT to touch

- `investigation.completed` — already reads `triggeredBy`; keep as-is OR migrate to `actorUserId` if Sprint 01 includes it. Default: leave untouched, migrate in a follow-up PRD.
- `remediation.approved` / `remediation.rejected` — already read approvedBy/rejectedBy correctly.
- `apikey.created` / `apikey.revoked` — already read createdBy/revokedBy correctly.

## Architectural guardrails

- No changes outside bootstrap.ts in this sprint
- Handler logic stays in composition root (bootstrap); do NOT move into a new module
- Preserve hash-chain integrity (do not change audit create call ordering)

## Acceptance

- [x] All 6 target handlers read canonical `actorUserId`/`actorEmail` from payload
- [x] All Sprint 01 handler unit tests PASS (12 tests: 6 events × (positive + fallback))
- [x] Sprint 01 integration test PASSES (authenticated chat → audit row with actorType:'user')
- [x] All Sprint 01 producer tests STILL PASS (no regression)
- [x] `pnpm typecheck` clean (requires Sprint 04 schema field OR temporary `as any` cast — prefer waiting on Sprint 04)
- [x] `pnpm lint` clean
- [x] No existing passing test broken (run full `pnpm test:run`)

## Return contract

```json
{
  "files_modified": ["src/bootstrap.ts"],
  "handlers_updated": [<event names>],
  "handler_tests_passing": <number>,
  "integration_test_passing": <boolean>,
  "full_test_suite": "PASS|FAIL",
  "typecheck": "PASS|BLOCKED_ON_SPRINT_04",
  "lint": "PASS",
  "legacy_keys_preserved": ["createdBy", "triggeredBy", "approvedBy", "rejectedBy"],
  "memo_for_sprint_04": "<notes on schema field dependency>"
}
```
