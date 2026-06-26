# PRD — Audit Actor Attribution Threading (LGPD/GDPR/SOC 2)

**Type:** bugfix
**Created:** 2026-04-14
**Status:** in_progress
**Owner:** audit module

## Problem

6 audit event handlers in `src/bootstrap.ts` write `actorType:'system'` for events
triggered by authenticated users because producer use cases never receive and
propagate the authenticated user identity from the Clerk JWT middleware into
event payloads.

## Canonical Identity Decision (compliance-driven)

- **Primary** key in event payloads: `actorUserId` (JWT `sub` — stable, opaque,
  aligns with GDPR art. 5(1)(c) data minimization).
- **Secondary** (display): `actorEmail`.
- `AuditEntry` domain/entity/repo gains new optional `actorUserId` field
  (additive, non-breaking).
- Middleware already exposes both: `c.get('userId')` and `c.get('userEmail')`
  at `src/shared/infra/http/middleware/auth.middleware.ts`.

## Scope

### In Scope

- Thread `actorUserId` + `actorEmail` from routes → use cases → event payloads
  for the 6 broken handlers.
- Update handlers in `bootstrap.ts` to read canonical keys.
- Add `actorUserId` to `AuditEntry` (domain, entity, repository).
- New pseudonymization use case (LGPD/GDPR right to erasure with hash-chain
  preservation).
- New purge-expired-entries use case (no scheduler wiring).
- Retention policy doc (`docs/compliance/audit-retention-policy.md`).

### Out of Scope

- Cron/scheduler for automatic purge.
- RBAC granularity on `/api/audit`.
- Privacy notice copy.

## Affected Events (6)

1. `chat.completed` (memory)
2. `incident.created` — migrate from `createdBy` key to canonical `actorUserId`/`actorEmail`
3. `incident.status_changed`
4. `tenant.created`
5. `tenant.updated`
6. `remediation.proposed`
7. `remediation.executed`

Already OK (no change): `investigation.completed`, `apikey.*`,
`remediation.approved/rejected`, `approval.responded`.

## Acceptance Criteria

- **AC-1** All 6 affected events carry `actorUserId` + `actorEmail` when
  triggered via authenticated route.
- **AC-2** System-initiated events (cron, internal) fallback to
  `system@causeflow.ai`.
- **AC-3** New `tests/unit/audit-actor-threading.test.ts` passes; covers all 6
  events.
- **AC-4** New `tests/integration/audit-actor-threading.integration.test.ts`
  passes: authenticated POST → audit row has `actorUserId` + `actorEmail`.
- **AC-5** `AuditEntry` domain has optional `actorUserId`.
- **AC-6** `AuditEntryEntity` (ElectroDB) has optional `actorUserId` attribute.
- **AC-7** `DynamoAuditRepository.toDomain` + `create` map `actorUserId`.
- **AC-8** `pseudonymize-actor.usecase.ts` deterministically hashes
  `actorUserId`/`actorEmail`; preserves `previousHash`/`entryHash`.
- **AC-9** `purge-expired-entries.usecase.ts` purges per retention window.
- **AC-10** Hash-chain verification passes after pseudonymization (unit test).
- **AC-11** `docs/compliance/audit-retention-policy.md` published with legal
  basis (LGPD art. 7º II/IX, GDPR art. 6(1)(c)(f), SOC 2 CC6.1/CC7.2), 7-year
  retention, erasure-via-pseudonymization.
- **AC-12** `pnpm typecheck`, `pnpm lint`, `pnpm test:run` all clean.

## Constraints

- TDD (red → green).
- Never delete passing tests.
- No breaking changes to AuditEntry DTO shape (only additive).
- Hash-chain integrity preserved.

## Sprints

See `sprints/` directory. 4 sprints, **sequential** (2 depends on 1, 3 on 2,
4 on 3).
