# Audit Log Retention & Right-to-Erasure Policy

**Version:** 1.0
**Effective:** 2026-04-14
**Owner:** Platform / Compliance
**Supersedes:** None (initial policy)

## 1. Purpose

This policy governs how CauseFlow retains, pseudonymizes, and purges entries
in the immutable audit log (`AuditEntry` — see
`src/modules/audit/domain/audit.entity.ts`). It harmonises the business need
for forensic integrity (incident-response, legal defence, contract audits)
with the rights of data subjects under LGPD and GDPR and the control
obligations of SOC 2.

## 2. Legal basis

| Jurisdiction | Instrument | Article | Basis |
| ------------ | ---------- | ------- | ----- |
| Brazil | LGPD (Lei 13.709/2018) | art. 7º II | Compliance with legal/regulatory obligation |
| Brazil | LGPD (Lei 13.709/2018) | art. 7º IX | Legitimate interest of controller (defensive logs) |
| Brazil | Lei 8.212/91 | art. 45 | 5-year tax/contract record retention |
| EU | GDPR (2016/679) | art. 6(1)(c) | Legal obligation |
| EU | GDPR (2016/679) | art. 6(1)(f) | Legitimate interest (security monitoring) |
| EU | GDPR (2016/679) | art. 17(3)(b) | Erasure-right exception: compliance with legal obligation |
| EU | GDPR (2016/679) | art. 17(3)(e) | Erasure-right exception: establishment / defence of legal claims |
| US | SOC 2 TSC | CC6.1 | Logical access — change-management evidence |
| US | SOC 2 TSC | CC7.2 | System operations — security-event monitoring |

## 3. Retention table

| Category | Events (examples) | Retention | Primary legal basis |
| -------- | ----------------- | --------- | ------------------- |
| Security / auth | `apikey.created`, `apikey.revoked`, failed-auth (when added) | **2 years** | SOC 2 CC7.2; GDPR art. 6(1)(f) |
| Incident / investigation | `incident.created`, `incident.status_changed`, `investigation.completed` | **3 years** | LGPD art. 7º II; operational defence |
| Tenant lifecycle | `tenant.created`, `tenant.updated` | **5 years** | Lei 8.212/91; contract-audit defence |
| Remediation execution | `remediation.proposed`, `remediation.approved`, `remediation.rejected`, `remediation.executed` | **3 years** | SOC 2 CC6.1 change-management evidence |
| API-key lifecycle | `apikey.*` | **2 years** | SOC 2 CC6.1 |
| Pseudonymised rows (post-erasure) | any of the above after `pseudonymize-actor` runs | **indefinite** | GDPR art. 17(3)(b,e) exception — legal claims |

Cutoff is computed from `AuditEntry.createdAt`. Purge is executed by the
`PurgeExpiredEntriesUseCase` invoked per-category by a scheduled job (future
EventBridge cron; see Section 7).

## 4. Canonical actor identity

Every `AuditEntry` SHOULD carry:

- `actorUserId` — the authenticated subject's JWT `sub` (stable, opaque). Primary identifier.
- `actorEmail` — display-only projection for human readers of the timeline.
- `actorType` — `'user'` when `actorUserId` is present; `'system'` for background jobs, webhooks, and auto-remediation paths; `'agent'` reserved for future SDK-authored events.

Rows created before the 2026-04 threading fix (commit `516f5d5`) may be
missing `actorUserId`. Backfill is explicitly **accepted debt** — historical
rows remain auditable via `actorEmail` only and are documented as such here.

## 5. Hash-chain integrity rules

`entryHash` is SHA-256 over a deterministic payload:

```
[previousHash, tenantId, entryId, action, actorEmail, resourceType, resourceId, changes, createdAt]
```

(See `create-audit-entry.usecase.ts` and `verify-hash-chain.usecase.ts` —
these two files are the single source of truth for the payload; this
document restates it for human review.)

**Decision:** `actorUserId` is NOT part of the hash input. Rationale:

1. It enables right-to-erasure without rewriting chained entries.
2. It preserves the chain's cryptographic binding to `actorEmail`, which is
   the projection humans use to reason about timelines — losing that
   binding would weaken the log's evidentiary value more than losing the
   binding to an opaque JWT sub.
3. `actorUserId` is a projection of the authenticated principal; the JWT
   itself (signed by Cognito/our IdP) is the primary attestation that the
   sub legitimately acted. The audit row's hash does not need to replicate
   that attestation.

Consequences:

- **Pseudonymisation mutates only `actorUserId` and `pseudonymizedAt`.**
  `actorEmail` is preserved so the hash remains valid. Controllers accept
  this residual linkage because GDPR art. 17(3)(b,e) permits retention of
  pseudonymised records for legal-claims defence, and the email-only
  linkage is substantially weaker than the full `(sub, email)` pair.
- **Purge deliberately breaks the chain at the purge boundary.** Chain
  verification tooling treats pre-cutoff gaps as expected and reports
  `valid: true` for the retained window. A follow-up task SHOULD emit a
  tombstone row recording `{firstPurgedEntryHash, cutoff, batchSize}` to
  anchor the post-cutoff chain.

## 6. Right-to-erasure procedure

1. Data subject exercises erasure right through the support channel of
   record; controller verifies identity per the tenant's DSAR SOP.
2. Operator resolves the subject's `actorUserId` (JWT sub) — via Cognito
   admin lookup or the internal user-directory adapter.
3. Operator invokes `PseudonymizeActorUseCase` with:
   - `tenantId` — the tenant in whose log the subject appears.
   - `actorUserId` — the resolved JWT sub.
   - `tenantSecret` — a tenant-scoped secret from the platform secret store.
     Salts the pseudonym so pseudonyms cannot be rainbow-table-reversed
     across tenants.
4. Use case computes `pseudonym = 'erased:' + sha256(actorUserId '|' tenantSecret)`.
5. Repository adapter updates every matching row's `actorUserId` →
   `pseudonym` and sets `pseudonymizedAt = now`. `entryHash`,
   `previousHash`, `createdAt`, `eventType`, `actorEmail`, `changes` are
   NOT touched — see Section 5.
6. Operator logs an `audit.actor_pseudonymized` row (itself auditable) with
   the pseudonym, the operator's own `actorUserId`, the DSAR ticket id, and
   legal basis (`GDPR art. 17` / `LGPD art. 18 VI`).
7. If the subject requests erasure of `actorEmail` as well, escalate to
   Legal — granting this breaks the hash chain for the affected rows;
   expected remediation is documented chain-truncation with a tombstone,
   not silent mutation.

## 7. Purge procedure

1. Scheduled job (future: EventBridge cron, daily) computes per-category
   cutoff timestamps from the retention table in Section 3.
2. For each tenant × category, the job loops
   `PurgeExpiredEntriesUseCase(tenantId, before=cutoff, batchSize=500)`
   until `deleted < batchSize`.
3. After each non-empty batch the job emits an `audit.batch_purged` row
   with `{tenantId, category, cutoff, deleted}` — itself auditable.
4. Chain verification after purge: `VerifyHashChainUseCase` only guarantees
   integrity of entries still present. The retained window's chain is
   intact; the pre-purge chain is intentionally discarded. This document
   is the authority for treating that gap as expected, not corruption.

## 8. Accepted debt

- **No backfill of `actorUserId` for pre-2026-04-14 rows.** Historical rows
  retain `actorEmail` only. Timeline reads treat missing `actorUserId` as a
  normal display case.
- **Chain tombstones after purge are not yet implemented.** A follow-up
  sprint will add a `chain-anchor` row emitted after each purge batch so
  post-cutoff verification can prove "we deliberately dropped everything
  before T, here is the anchor".
- **Pseudonymisation preserves `actorEmail`** — documented compromise
  above. A privacy-maximal alternative (strip email, rewrite entire chain)
  is deliberately NOT implemented; its cost exceeds its benefit given
  GDPR art. 17(3) carve-outs.

## 9. Review cadence

This policy is reviewed annually, on material changes to LGPD/GDPR/SOC 2,
or whenever a new audit `action` is added to the codebase. Owner of the
review: Platform / Compliance.
