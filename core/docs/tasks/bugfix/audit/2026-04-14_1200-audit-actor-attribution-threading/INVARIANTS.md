# INVARIANTS — Audit Actor Attribution Threading

## Canonical Actor Identity

- **Owner:** audit module (`src/modules/audit/domain/audit.entity.ts`)
- **Preconditions:** Event producer use cases MUST receive `actorUserId?: string`
  and `actorEmail?: string` on their Input DTO when triggered by authenticated
  HTTP routes.
- **Postconditions:** Event payload emitted by producer MUST include
  `actorUserId` and `actorEmail` when available; handler MUST persist both
  into the resulting `AuditEntry`.
- **Invariants:**
  - `actorUserId` is the JWT `sub` (stable, opaque) — NEVER email as primary.
  - System-initiated events fallback to `system@causeflow.ai`, `actorUserId`
    absent (`undefined`), `actorType: 'system'`.
  - User-initiated events: `actorType: 'user'`, `actorUserId` present.
- **Verify:** `pnpm test:run --filter audit-actor-threading` exits 0.
- **Fix:** Re-thread producer DTO; ensure route reads `c.get('userId')` +
  `c.get('userEmail')` and passes them.

## Hash-Chain Integrity

- **Owner:** `src/modules/audit/application/verify-hash-chain.usecase.ts`
- **Preconditions:** Entries ordered by `createdAt`; `previousHash` of entry N
  equals `entryHash` of entry N-1.
- **Postconditions:** Any mutation (including pseudonymization) MUST preserve
  `previousHash` and `entryHash` exactly.
- **Invariants:**
  - Pseudonymization substitutes `actorUserId`/`actorEmail` fields only —
    `previousHash`, `entryHash`, `createdAt`, `eventType` untouched.
  - `verify-hash-chain` returns `valid: true` after pseudonymization of any N
    entries.
- **Verify:** pseudonymize-actor unit test includes hash-chain verification.
- **Fix:** Do NOT recompute hashes on pseudonymization. Only overwrite actor
  fields.

## Additive-Only AuditEntry Contract

- **Owner:** `src/modules/audit/domain/audit.entity.ts`
- **Preconditions:** Consumers read `AuditEntry` via DTO.
- **Postconditions:** New fields are optional (`?:`). Existing fields
  unchanged.
- **Invariants:** `actorUserId?: string` added. No field removed or renamed.
- **Verify:** `pnpm typecheck` passes; no consumer breaks.
- **Fix:** Make new field optional; provide default/fallback in mappers.
