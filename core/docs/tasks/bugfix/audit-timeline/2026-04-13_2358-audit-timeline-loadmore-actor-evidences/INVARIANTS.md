# INVARIANTS — Audit Timeline Fixes

Machine-verifiable contracts for every cross-cutting concept touched by this PRD.
Enforced by `check-invariants.sh` PostToolUse hook on files under the audit
module (core) and the audit context (web).

---

## Tenant Isolation (AuditEntry queries)

- **Owner:** `src/modules/audit/infra/dynamo-audit.repository.ts` (core)
- **Preconditions:** every repository call MUST receive a non-empty `tenantId`
  resolved from the authenticated session.
- **Postconditions:** returned rows all satisfy `row.tenantId === query.tenantId`.
- **Invariants:**
  - No code path may construct a DynamoDB query against the audit entity
    without a `tenantId` equality filter on the partition key.
  - The route layer MUST NOT accept `tenantId` from query string, body, or
    header — only from session.
- **Verify:** ripgrep audit module for any query call that does not include
  a tenantId filter; also run the contract test tenant-isolation.contract.test.ts
  which seeds two tenants and asserts mutual invisibility.
- **Fix:** add `tenantId` to the query/where clause; re-run the contract test
  `tenant-isolation.contract.test.ts`.

---

## Actor Resolution

- **Owner:** `src/modules/audit/application/record-audit-entry.usecase.ts` (core)
- **Preconditions:** caller context (authenticated user or explicit
  `source: 'system'`) is passed to the use case.
- **Postconditions:** persisted `actor` is `{ type: 'user', id, email, name? }`
  when a user is present; `{ type: 'system' }` otherwise.
- **Invariants:**
  - `actor.type === 'system'` MUST NOT appear on events whose request
    originated from an authenticated HTTP route.
  - Frontend MUST render the literal string `system` only when
    `actor.type === 'system'`.
- **Verify (backend):** grep the audit application layer for literal
  `system` actor assignment; every hit must have a `// background:` comment
  justifying why no user context is present.
- **Verify (frontend):** grep the audit presentation layer for the literal
  string `system`; every hit must be guarded by `actor.type === 'system'`.
- **Fix:** thread the authenticated caller through the use case; render
  conditional on `actor.type`.

---

## Audit DTO Stability (Cross-repo contract)

- **Owner:** `src/modules/audit/application/dtos/audit-entry.dto.ts` (core) +
  `src/lib/api/core-api-types.ts` (web).
- **Preconditions:** both repos consume the same DTO shape.
- **Postconditions:** DTO is backward-compatible — new fields are optional;
  no existing field is removed or renamed within this PRD.
- **Invariants:**
  - Any breaking change requires a coordinated merge (both PRs together) and
    is explicitly called out in commit messages.
- **Verify:** a contract test in core snapshots the DTO type; a matching test
  in web asserts deserialization against the same fixture.
- **Fix:** if drift is detected, revert the breaking side and re-plan via a
  new PRD.

---

## Pagination Contract

- **Owner:** `GET /audit` route (core) + `audit-handler.ts` (web).
- **Preconditions:** client may send `cursor` query param (optional on first
  call).
- **Postconditions:**
  - Response contains `items: AuditEntryDto[]` and optional `nextCursor: string`.
  - Items are ordered by `timestamp DESC`.
  - When `nextCursor` is absent, there are no more items.
- **Invariants:**
  - `items` across two sequential calls (second using the `nextCursor` from
    the first) contain no duplicate `entryId`.
  - Frontend MUST forward `nextCursor` as `cursor` on the next request.
- **Verify:** E2E spec `audit-load-more.spec.ts` asserts distinct-ids + order.
- **Fix:** restore cursor forwarding in BFF; restore `ScanIndexForward=false`
  in repository.

---

## Evidences Rendering

- **Owner:** `audit-list.tsx` (web).
- **Preconditions:** DTO may include `evidences?: Evidence[]`.
- **Postconditions:**
  - Non-empty array → block rendered with all items.
  - Empty/undefined → no block, no empty placeholder.
- **Invariants:**
  - Frontend MUST NOT render an evidences block for an entry whose
    `evidences` is undefined or `[]`.
- **Verify:** component test asserts conditional rendering on both states.
- **Fix:** guard with `entry.evidences?.length > 0`.

---

## Secrets in Evidences

- **Owner:** audit write path (core).
- **Preconditions:** evidences may reference tokens, URLs, payloads.
- **Postconditions:** secrets are masked per existing shared masking utility
  before persistence.
- **Invariants:**
  - No log line at `info` or higher contains `evidences` payloads.
  - Existing masking rules are not relaxed by this PRD.
- **Verify:** lint rule / grep that audit logger calls go through the masking
  helper.
- **Fix:** route the call through the shared masker; never log raw payloads.
