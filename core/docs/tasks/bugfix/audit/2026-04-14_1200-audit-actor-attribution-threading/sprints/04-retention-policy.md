# Sprint 04 — Retention Policy, Schema & Compliance Use Cases

**Status:** not_started
**Model:** sonnet
**Isolation:** worktree
**Estimated:** 75-90 min
**Depends on:** Sprint 01 (contract frozen). Can run in parallel with Sprint 02/03 at the schema level; must land before Sprint 03 production deploy.

## Objective

1. Add `actorUserId` to `AuditEntry` domain entity + ElectroDB entity + repository mapping (persistence for the canonical JWT sub).
2. Author formal audit retention policy doc (LGPD art. 7º II/IX, GDPR art. 6(1)(c)(f) + art. 17(3)(b,e), SOC 2 CC6.1 / CC7.2).
3. Implement `pseudonymize-actor.usecase.ts` — right-to-erasure while preserving hash-chain integrity.
4. Implement `purge-expired-entries.usecase.ts` — scheduled retention enforcement.
5. Tests for hash-chain integrity under pseudonymization and purge.

## Files to create

- `docs/compliance/audit-retention-policy.md`
- `src/modules/audit/application/pseudonymize-actor.usecase.ts`
- `src/modules/audit/application/purge-expired-entries.usecase.ts`
- `tests/unit/audit-retention.test.ts` — hash-chain integrity tests
- `tests/unit/audit-pseudonymize.test.ts`

## Files to modify

- `src/modules/audit/domain/audit.entity.ts` — add `actorUserId?: string`
- `src/shared/infra/db/entities/AuditEntryEntity.ts` — add `actorUserId` attribute (ElectroDB)
- `src/modules/audit/infra/dynamo-audit.repository.ts` — map `actorUserId` in `toDomain()` + `create()`
- `src/modules/audit/domain/audit.repository.ts` (port) — add `pseudonymizeActor(actorUserId: string): Promise<number>` and `findExpired(before: Date): Promise<AuditEntry[]>` (or similar; choose minimal surface)

## Files read-only

- Sprint 01 tests
- All producer use cases (no changes here)

## Retention policy (summary — full doc in `docs/compliance/audit-retention-policy.md`)

| Category                  | Retention | Legal basis                                      |
| ------------------------- | --------- | ------------------------------------------------ |
| Security/auth events      | 2 years   | SOC 2 CC7.2; GDPR art. 6(1)(f) legitimate interest |
| Incident/investigation    | 3 years   | LGPD art. 7º II; operational defense              |
| Tenant lifecycle          | 5 years   | Brazilian tax law (Lei 8.212/91); contract defense |
| Remediation execution     | 3 years   | SOC 2 CC6.1; change-management evidence          |
| API-key lifecycle         | 2 years   | SOC 2 CC6.1                                      |
| Pseudonymized (post-erasure) | Indefinite | GDPR art. 17(3)(b,e) exception — legal claims  |

**Right-to-erasure procedure:**
1. User exercises erasure right → operator runs `pseudonymize-actor` use case with their `actorUserId`
2. All `AuditEntry` rows with that `actorUserId` have: `actorUserId → 'erased:' + sha256(originalUserId + tenantSecret)`, `actorEmail → null`
3. Hash-chain integrity preserved: `entryHash` is NOT recomputed; the chain's cryptographic binding stays intact because we only mutate non-hashed fields OR we store the pseudonymized projection in a sibling attribute while keeping hashed originals in append-only form. **Decision point for sprint executor:** pick one approach based on current `AuditEntry.entryHash` input set — document which inputs are hashed in the doc.
4. Operator logs a `audit.actor_pseudonymized` event (itself audited) with the pseudonym, the requesting operator (actor), and legal basis.

**Purge procedure:**
1. Scheduled job (future: EventBridge cron) calls `purge-expired-entries` with per-category cutoff dates
2. Entries older than category retention are hard-deleted in batches
3. Each purge batch emits `audit.batch_purged` event with count + cutoff (itself audited)
4. Hash-chain note: chain verification after purge only guarantees integrity within the retained window; the doc MUST state this explicitly.

## Hash-chain integrity — explicit rules

The policy doc AND tests MUST pin:

- Which fields are inputs to `entryHash` (read `audit.entity.ts` + existing hash logic in audit repository to confirm; document exact list)
- `actorUserId` — IS / IS NOT part of the hash input (sprint executor decides and documents)
- Pseudonymization mutates ONLY non-hashed fields OR uses a separate `pseudonymizedAt` + projected view
- Purge breaks the chain at the purge boundary by design; chain verification tool MUST treat purge markers as valid gaps

## Acceptance

- [x] `docs/compliance/audit-retention-policy.md` exists with retention table, legal basis citations, right-to-erasure procedure, purge procedure, hash-chain integrity rules
- [x] `AuditEntry` domain entity has `actorUserId?: string`
- [x] ElectroDB `AuditEntryEntity` has `actorUserId` attribute
- [x] `dynamo-audit.repository.ts` reads/writes `actorUserId`
- [x] `pseudonymize-actor.usecase.ts` implements erasure preserving hash chain
- [x] `purge-expired-entries.usecase.ts` implements retention enforcement
- [x] `tests/unit/audit-pseudonymize.test.ts`: pseudonymization on a chain of ≥3 entries → `verifyChain()` still returns valid
- [x] `tests/unit/audit-retention.test.ts`: purge of middle entry either (a) preserves verifiable chain with explicit gap markers OR (b) documented-as-expected chain truncation at purge boundary
- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] `pnpm test:run` full suite PASS

## Non-goals

- Scheduled execution infrastructure (EventBridge rule) — future sprint
- UI to trigger pseudonymization — future sprint
- Migration backfill of `actorUserId` for pre-fix audit rows — documented as accepted debt in policy

## Architectural guardrails

- New use cases live in `src/modules/audit/application/`
- No imports from infra in application layer
- Repository port gets new methods; adapter implements them
- Hash-chain logic stays in audit module (never leaks into bootstrap)

## Return contract

```json
{
  "files_created": [<paths>],
  "files_modified": [<paths>],
  "retention_table_categories": <number>,
  "hash_chain_decision": "<actorUserId in|out of hash input + rationale>",
  "pseudonymize_tests_passing": <number>,
  "purge_tests_passing": <number>,
  "full_test_suite": "PASS|FAIL",
  "typecheck": "PASS",
  "lint": "PASS",
  "accepted_debt": ["no backfill of actorUserId for pre-fix rows", "<others>"]
}
```
