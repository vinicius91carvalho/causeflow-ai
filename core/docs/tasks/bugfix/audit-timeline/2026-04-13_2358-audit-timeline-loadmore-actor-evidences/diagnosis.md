# Sprint 01 — Audit Timeline Diagnosis

**Date:** 2026-04-14
**Executor:** orchestrator-main
**Status:** complete (static-analysis pivot)

## Live-capture blocker

Playwright CLI was wired up at `web/tests/audit-diagnosis.spec.ts` and run
against `https://dashboard-staging.causeflow.ai`. Login through Clerk
completed the email + password steps (screenshots `02-login-filled.png`,
`02b-password-filled.png` captured), but the final submission was silently
rejected — URL stayed at `/auth/sign-in?redirect_url=...`. Root cause of the
blocker: Clerk's Cloudflare Turnstile challenge blocks headless Chromium
without a bypass token. Console log confirms only CSP warnings for Sentry
and Clerk structural-CSS warnings — no auth errors surfaced.

**Decision:** pivot to static analysis + code review. All three root causes
are unambiguous from the source; no hypothesis required browser runtime
data. Artifacts saved under `web/tests/artifacts/audit-diagnosis/2026-04-14T00-16/`
and `.../2026-04-14T00-17/` for evidence of the blocker.

---

## Symptom 1 — Load More returns nothing / wrong order

**Root cause:** backend
**Files:**
- `core/src/modules/audit/infra/dynamo-audit.repository.ts` (lines 37-60)

**Analysis:** `findByTenant` and `findByAction` call
`AuditEntryEntity.query.primary({ tenantId }).go({ limit, cursor })`
WITHOUT `order: 'desc'`. ElectroDB defaults to ASC on the sort key
(`createdAt`), so the first page returns the *oldest* entries, and the
cursor advances further into the past-to-present sequence. From the user's
perspective the latest entries never appear, and Load More appears to
"return the same window" because the first page is already anchored at
the beginning of time.

The BFF mapping (`web/apps/dashboard/src/contexts/audit/api/audit-handler.ts`)
correctly forwards the cursor and marks `hasMore: result.cursor !== null`.
The frontend `audit-list.tsx` correctly reuses `cursorRef` on Load More.
So: backend-only fix.

**One-sentence fix:** add `order: 'desc'` to the `.go()` options in both
`findByTenant` and `findByAction`.

**Contract change?** No.

---

## Symptom 2 — Actor shown as `system` for user-triggered entries

**Root cause:** backend
**Files:**
- `core/src/bootstrap.ts` (event handlers lines 571-692, 771-787)

**Analysis:** The event→audit bridge in bootstrap hardcodes
`actorType: 'system'`, `actorEmail: 'system@causeflow.ai'` for most
user-triggered events:
- `incident.created` (line 572) — despite `createdBy` now being on the
  event payload (commit `f7e7dfd`), it is ignored.
- `incident.status_changed` (line 584)
- `investigation.completed` (line 596)
- `tenant.created` (line 608), `tenant.updated` (line 620)
- `remediation.proposed` (line 632), `remediation.executed` (line 682)
- API-key handlers (lines 771-787) use `actorType: 'user'` but still
  `actorEmail: 'system@causeflow.ai'` — inconsistent.

Only `remediation.approved` (644), `remediation.rejected` (670), and
`approval.responded` (711) correctly extract the user identity from the
event payload (`approvedBy` / `rejectedBy` / `respondedBy`).

The `DynamoAuditRepository.toDomain` and the `AuditEntry` entity already
support `actorType: 'user'` and `actorEmail`; the repository faithfully
persists whatever the handler supplies.

**One-sentence fix:** in each listed handler, read the user identity
(email + type `'user'`) from the event payload (`createdBy` / `updatedBy` /
`triggeredBy` — align on a single field name) with fallback to `system`
only for genuine background jobs.

**Contract change?** No (AuditEntry DTO shape unchanged; only the values
written by handlers change). Event payload fields may need to be added
on the producer side if not already present — this is an upstream data
propagation task, not a persisted contract change.

---

## Symptom 3 — Evidences never rendered on entries that have them

**Root cause:** both (backend-dominant)
**Files:**
- `core/src/modules/audit/domain/audit.entity.ts` (missing field)
- `core/src/modules/audit/infra/dynamo-audit.repository.ts` (toDomain + create)
- `core/src/modules/audit/application/create-audit-entry.usecase.ts` (Input DTO)
- `core/src/shared/infra/db/entities/AuditEntryEntity.ts` (ElectroDB schema)
- `core/src/bootstrap.ts` — `investigation.completed` handler (populate)
- `web/apps/dashboard/src/contexts/audit/domain/types.ts` (type)
- `web/apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` (render)

**Analysis:** `AuditEntry` has no `evidences` field. The repository
`toDomain` does not map one; `create` does not persist one. The ElectroDB
entity does not declare it. The frontend list component renders only
`createdAt`, `action`, `actorEmail`, `actorType`, `resourceType`,
`resourceId`, `entryHash`. Thus "evidences never show" because the
field does not exist end-to-end.

**One-sentence fix:** add an optional `evidences: Evidence[]` array to the
AuditEntry domain entity + ElectroDB schema + repository mapping + use-case
input; populate it from `investigation.completed` event payload in
bootstrap; surface it through the BFF (pass-through, already generic); and
render a collapsible evidences block in `audit-list.tsx`.

**Contract change?** **Yes** — AuditEntry DTO shape gains a new optional
field. Additive only (no break), but frontend must be deployed AFTER
backend so the field is available when the UI tries to render it.

---

## Sprint 2 scope (backend / core)

- [ ] Add `order: 'desc'` to `findByTenant` and `findByAction` in
  `src/modules/audit/infra/dynamo-audit.repository.ts`. Unit test for
  ordering.
- [ ] Fix actor hardcoding in `src/bootstrap.ts` handlers: `incident.*`,
  `tenant.*`, `investigation.completed`, `remediation.proposed`,
  `remediation.executed`, API-key handlers. Read user identity from
  event payload. Unit tests per handler.
- [ ] Add `evidences` field to AuditEntry entity, ElectroDB schema,
  `toDomain`, `create`, `CreateAuditEntryInput`. Populate from
  `investigation.completed` handler. Unit tests.
- [ ] Typecheck + lint clean.

## Sprint 3 scope (frontend / web)

- [ ] Add `evidences?: Evidence[]` to audit types (`contexts/audit/domain/types.ts`).
- [ ] Render evidences block in `audit-list.tsx` (collapsible, mobile-first,
  hidden when absent or empty).
- [ ] Verify Load More still works end-to-end against staging (now that
  backend returns desc order and fresh cursor).
- [ ] Typecheck + lint clean.

## Parallelizability

- S2's AC-1 and AC-2 sub-tasks do not touch S3's files → safe to begin
  S3 rendering scaffolding in parallel.
- S2's AC-3 sub-task adds the `evidences` contract field → S3's render
  work **depends** on S2 AC-3 to land first (or land together in a
  coordinated merge). Additive field means S3 can also be built against
  a locally-mocked type if truly parallel is needed.
- Pragmatic recommendation: run S2 and S3 in parallel; gate S3's final
  merge on S2's `evidences` field being present on `main`.

## Return contract values

- `s1_root_cause`: `{ backend, files: ["core/src/modules/audit/infra/dynamo-audit.repository.ts"] }`
- `s2_root_cause`: `{ backend, files: ["core/src/bootstrap.ts"] }`
- `s3_root_cause`: `{ both, files: ["core/src/modules/audit/domain/audit.entity.ts", "core/src/modules/audit/infra/dynamo-audit.repository.ts", "core/src/shared/infra/db/entities/AuditEntryEntity.ts", "core/src/bootstrap.ts", "web/apps/dashboard/src/contexts/audit/domain/types.ts", "web/apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx"] }`
- `sprint2_in_scope`: true
- `sprint3_in_scope`: true
- `parallelizable_s2_s3`: true (with merge-order coordination on the evidences field)
- `contract_change`: true (additive: `evidences` on AuditEntry DTO)
- `diagnosis_path`: `docs/tasks/bugfix/audit-timeline/2026-04-13_2358-audit-timeline-loadmore-actor-evidences/diagnosis.md`
