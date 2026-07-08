# tenancy-and-access workflow journal

## WI-AC-007 — Verify-first (tenancy-and-access)

**Result: implementation=true**

Boundary exercised against the running app (real HTTP on the assigned PORT=5181, no mocks). Stack already up from foundation: `docker compose up -d` (ministack :4566, redis, postgres all `(healthy)`); local gitignored `.env.dev` with `PORT=5181`, `DYNAMODB_ENDPOINT=http://localhost:4566`, `DYNAMODB_TABLE_NAME=causeflow-local`, `REDIS_URL=redis://<redis-container-ip>:6379`, `ANTHROPIC_API_KEY=` (empty → anthropic skipped), and `CLERK_JWT_KEY=<2048-bit RSA SPKI PEM>`. `pnpm dev` → `CauseFlow is running` on 5181 within ~3s.

### Acceptance boundary (AC-007)

POST a valid Clerk session JWT to the auth login endpoint; the auth middleware extracts the user, the tenant comes from the verified JWT org claim, and the response contains the user, the tenant, and the user's role. A second call with no Authorization header returns 401.

To produce a *valid Clerk session JWT* at a real boundary without a live Clerk instance, a 2048-bit RSA keypair was generated locally; the SPKI public PEM was set as `CLERK_JWT_KEY` so `@clerk/backend`'s `verifyToken({ jwtKey })` verifies the RS256 signature **networklessly** (the real Clerk verification path — no JWKS call, no mocking of `verifyToken`). The JWT payload carries Clerk v2 compact org claim `o:{id,rol,slg}` + `sub` + `email` + `iat`/`exp`/`nbf`/`iss`/`azp`. Evidence (`node /tmp/ac007-boundary.mjs`, real fetches):

- `POST /v1/auth/login` with `Authorization: Bearer <rs256-jwt>` → **200** `{"user":{"id":"user_ac007_boundary","email":"admin@causeflow.ai"},"tenant":"org_tenant_ac007","role":"admin","roles":["admin"]}`.
  - response contains **user** (`user.id` = JWT `sub`), **tenant** (`org_tenant_ac007` = JWT `o.id`, cryptographically verified), **role** (`admin`, mapped from `o.rol=admin`).
- `POST /v1/auth/login` with **no Authorization header** → **401** `{"error":"UNAUTHORIZED","message":"Missing or invalid Authorization header"}`.
- Defensive negative: `POST /v1/auth/login` with a JWT signed by a *different* RSA key (invalid signature) → **401** `Invalid or expired token` — confirms the middleware is genuinely verifying signatures, not passing tokens through.

All 6 boundary assertions passed (6/6).

### Path note (doc drift, out of scope)

The spec AC text says `/api/v1/auth/login`; the implementation mounts all module routes at `/v1/*` with **no `/api` prefix** (verified: no `app.route('/api…')` or basePath anywhere in `src/`). This is a global doc drift affecting every `…/api/v1/…` AC wording, not specific to AC-007. Per the contradictions clause ("implementation is authoritative") and the foundation precedent (PORT 3099 vs assigned port, see WI-AC-002), the real boundary exercised is `/v1/auth/login`. The literal `/api/v1/auth/login` returns 404 for the positive case (auth middleware passes, no route matches) and 401 for the no-auth case (auth middleware rejects before routing). Adding an `/api` alias for all routes is a structural change beyond AC-007's boundary and is not done here.

### Root-cause fixes (smallest diff, 3 files / +22 lines)

The existing code failed AC-007 at the boundary; each root cause fixed with no refactor:

1. **No `/login` endpoint existed** — `createAuthRoutes` only exposed `/clerk-webhook` (public, Svix-verified) and `/me`. Added `POST /login` that runs *after* the auth middleware (the path is not in `PUBLIC_PATHS`, so `authMiddleware` verifies the Bearer JWT and sets `userId`/`userEmail`/`userRoles`/`tenantId`) and returns `{ user:{id,email}, tenant, role, roles }`. The tenant middleware already skips `/v1/auth/*`; the tenant is extracted from the verified JWT org claim by the auth middleware (IDOR protection unchanged).
2. **No way to verify a Clerk session JWT locally** — `authMiddleware` called `verifyToken(token, { secretKey })`, which fetches JWKS from Clerk's API (requires a live Clerk instance + `CLERK_SECRET_KEY`). Added the standard Clerk `CLERK_JWT_KEY` env (PEM public key) to `config.clerk.jwtKey` and passed `jwtKey` through to `verifyToken` **only when configured** (`...(config.clerk.jwtKey ? { jwtKey } : {})`). This is the documented Clerk networkless-verification path; when unset, behaviour is unchanged (production JWKS via `secretKey`). Additive and backward-compatible: the existing `auth.middleware.test.ts` mock config (no `jwtKey`) is unaffected — 10/10 still pass.

No refactor/restructure of working code. Local untracked setup (gitignored, like `.env.dev`/`node_modules` in WI-AC-002): `pnpm install`, generated RSA keypair at `/tmp/ac007-clerk-jwt-key.*`, boundary script at `/tmp/ac007-boundary.mjs`.

### Regression checks

- `pnpm typecheck` → clean.
- `pnpm test:run` → 161 files / 1053 tests pass (includes `auth.middleware.test.ts` 10/10, `log-paths.test.ts` 12/12).
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).
- `pnpm lint` (changed files) → 0 errors (only pre-existing `no-explicit-any` warnings).

## 2026-07-08 — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-007
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5181)
- NextAction: Integrated Verification

## 2026-07-08 — QA independent verification (WI-AC-007)

**Result: qa=true, implementation=true.**

Independently reproduced the AC-007 boundary against a fresh server process on the assigned PORT=5181 (no `verifyToken` mock — real `@clerk/backend` networkless verification path). Generated a fresh 2048-bit RSA keypair, set the SPKI public PEM as `CLERK_JWT_KEY` in a `.env.qa` override, and minted a Clerk v2 session JWT (`o:{id,rol,slg}`, `sub`, `email`, `iat`/`nbf`/`exp`) signed RS256 with the matching private key. Booted `tsx --env-file=.env.qa src/main.ts` → `CauseFlow is running` on 5181. Real `curl` HTTP evidence:

- `POST /v1/auth/login` with `Authorization: Bearer <rs256-jwt>` → **200** `{"user":{"id":"user_qa_007","email":"qa@causeflow.ai"},"tenant":"org_qa_tenant_007","role":"admin","roles":["admin"]}` — response contains user, tenant, and role; user.id = JWT sub; tenant = JWT `o.id` (cryptographically verified); role mapped from `o.rol=admin`.
- `POST /v1/auth/login` with **no Authorization header** → **401** `{"error":"UNAUTHORIZED","message":"Missing or invalid Authorization header"}`.

Path note (doc drift, not a defect): spec AC wording says `/api/v1/auth/login`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/auth/login`; literal `/api/v1/auth/login` → 404 (positive) / 401 (no-auth). Functional AC-007 behaviour is fully met.

Local QA artefacts (gitignored, like `.env.dev`): `.env.qa`, `.qa-token`, `.qa-clerk-pubkey.pem`, `qa-mint-token.mjs`, `.qa-server.log`. Server process left running on 5181 for the duration of the tenancy-and-access context.

## 2026-07-08T03:21:18.987Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-007
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T03:26:00Z — Integrated Verification (WI-AC-007) on latest main

**Result: integration=true, implementation=true, qa=true.**

Ran AC-007 at a real HTTP boundary against latest main (HEAD `0133f38` Merge branch 'gen/core-tenancy-and-access'), `WORKDIR=/home/vinicius/projects/causeflow-ai/core`, `PORT=5181`. No `verifyToken` mock — real `@clerk/backend` networkless RS256 verification.

Fresh 2048-bit RSA keypair generated for integration; SPKI public PEM set as `CLERK_JWT_KEY` in main checkout's `.env.intq`. Booted `tsx --env-file=.env.intq src/main.ts` from main → `CauseFlow is running` on 5181. Stack healthy: ministack :4566, core-redis, `causeflow-local` table.

Boundary evidence (real `curl`):
- `POST /v1/auth/login` with `Authorization: Bearer <RS256 JWT>` (sub=user_intq_007, o.id=org_intq_tenant_007, o.rol=admin) → **200** `{"user":{"id":"user_intq_007","email":"intq@causeflow.ai"},"tenant":"org_intq_tenant_007","role":"admin","roles":["admin"]}` — response contains user (id=JWT sub), tenant (=JWT o.id, cryptographically verified), role (admin, mapped from o.rol).
- `POST /v1/auth/login` with **no Authorization header** → **401** `Missing or invalid Authorization header`.
- Defensive: JWT signed by a different RSA key → **401** `Invalid or expired token` (confirms real signature verification, not passthrough).

Core smoke (main): `GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`; `GET /dashboard` → 200 Alpine.js SPA shell (x-data + alpine present).

Path note (doc drift, not a defect): spec AC wording says `/api/v1/auth/login`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/auth/login`; literal `/api/v1/auth/login` → 404 (with-auth) / 401 (no-auth). Functional AC-007 behaviour fully met on integrated main.

Evidence: `.git/harness-runs/evidence/tenancy-and-access/WI-AC-007-integration-summary.txt` + `WI-AC-007-integration.log`. Server left running on 5181 for the tenancy-and-access context.

5/5 boundary assertions + 2/2 smoke assertions passed. integration=true.

## 2026-07-08T03:27:52.420Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-007
- AcceptanceChecks: AC-007
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/tenancy-and-access/WI-AC-007-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08 — Verify-first (WI-AC-008)

**Result: implementation=true.**

Boundary exercised against the running app on the assigned PORT=5182 (real HTTP, no mocks). Stack already up: `core-ministack-1` :4566, `core-redis-1`, `causeflow-local` table. Local gitignored `.env.dev` with `PORT=5182`, `DYNAMODB_ENDPOINT=http://localhost:4566`, `DYNAMODB_TABLE_NAME=causeflow-local`, `REDIS_URL=redis://<redis-ip>:6379`, `ANTHROPIC_API_KEY=` (empty → anthropic skipped), `CLERK_JWT_KEY=<2048-bit RSA SPKI PEM>` (networkless `@clerk/backend` RS256 verification, same pattern as WI-AC-007). `pnpm dev` → `CauseFlow is running` on 5182 within ~6s. `GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`.

Minted two Clerk v2 session JWTs in the SAME tenant (`org_ac008_boundary`): an admin (`o.rol=admin` → roles=['admin']) and a viewer (`o.rol=member` → roles=['member'], the lowest-privilege app role in this codebase — there is no literal `viewer` role; member is the non-admin viewer equivalent). Evidence (`node /tmp/ac008-boundary.mjs`, real fetches, 11/11 passed):

- `GET /v1/audit` as **viewer** → **200** `{items:[...]}`.
- `DELETE /v1/audit/:id` as **viewer** → **403** `{error:FORBIDDEN}` (RBAC via `requireRole('admin')`).
- `DELETE /v1/audit/:id` as **admin** → **200** `{entryId, deleted:1, newEntry:{action:'audit.entry.deleted', previousHash:<prior tip>}}`.
- Chain advance: the new entry's `previousHash` (719fd2566bc3…) == the prior tip's `entryHash` captured before the DELETE. Verified both in the DELETE response and via a fresh `GET /v1/audit` (newest entry = the deletion record, `previousHash` == prior tip). Tested the hardest case — deleting the tip itself — and the invariant still holds because the deletion record is appended BEFORE the target entry is purged.

Path note (doc drift, not a defect, same as WI-AC-007): spec AC wording says `/api/v1/audit/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/audit/...`.

### Root-cause fix (smallest diff, 3 tracked files + 1 use case + 1 test)

The existing code failed AC-008 at the boundary because **no `DELETE /v1/audit/:id` route existed** (returned 404, not the required 403/200). Fixed the root cause with no refactor:

1. **`src/shared/domain/types.ts`** — added `'audit.entry.deleted'` to the `AuditAction` union (one token).
2. **`src/modules/audit/application/delete-audit-entry.usecase.ts`** (new) — `DeleteAuditEntryUseCase` captures the prior tip, appends an `audit.entry.deleted` audit entry via the existing `CreateAuditEntryUseCase` (so `previousHash` = current tip = prior tip), then hard-purges the target entry via `repo.deleteBatch`. Append-before-purge ordering makes `previousHash` match the prior tip even when the deleted entry was the tip itself.
3. **`src/modules/audit/infra/audit.routes.ts`** — added `DELETE /:id` guarded by `requireRole('admin')` (viewer/member → 403). Returns `{entryId, deleted, newEntry}`.
4. **`src/bootstrap.ts`** — wired `deleteAuditEntry` (and the already-constructed `createAuditEntry`, which the pre-existing `POST /terms-acceptance` route guards on but was never wired — without it the chain could not be seeded for the AC) into `auditUseCases`. Additive.
5. **`tests/unit/modules/audit/delete-audit-entry.test.ts`** (new) — 3 unit tests locking the AC invariant (previousHash == prior tip; genesis when empty; hardest case deleting the tip).

No refactor/restructure of working code. `audit.routes.test.ts` (3/3) still passes — `deleteAuditEntry` is optional on `AuditUseCases` like `createAuditEntry`.

### Regression checks
- `pnpm typecheck` → clean.
- `pnpm test:run` → 162 files / 1056 tests pass (was 161/1053; +1 file, +3 new tests).
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).
- `pnpm lint` → 0 errors (only pre-existing `no-explicit-any` warnings).

Local untracked setup (gitignored, like `.env.dev`/`node_modules` in WI-AC-002/007): generated RSA keypair at `/tmp/ac008-clerk-jwt-key.*`, boundary script at `/tmp/ac008-boundary.mjs`, server log at `/tmp/ac008-server.log`. Dev server left running on 5182 for the tenancy-and-access context.

## 2026-07-08T03:40:00Z — Checkpoint ready
- Attempt: 1/3
- WorkItem: WI-AC-008
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182)
- NextAction: Integrated Verification

## 2026-07-08 — Verify-first re-confirm (WI-AC-008, this worktree)

**Result: implementation=true.**

Re-exercised AC-008 against the EXISTING code in this worktree at a real HTTP boundary on the assigned PORT=5182. Killed any stale server and booted a fresh `node --env-file=.env.dev --import tsx/esm src/main.ts` against the current working tree → `GET /health` 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`. Ran `/tmp/ac008-boundary.mjs` (real `fetch`, no mocks): **11/11 passed** — viewer GET /v1/audit → 200; viewer DELETE → 403; admin DELETE → 200 with `newEntry.previousHash` == prior tip (captured pre-DELETE from GET /v1/audit); cross-checked via a fresh GET (newest entry = deletion record, previousHash == prior tip). Tested the hardest case (deleting the tip itself).

### Root-cause fix committed (smallest diff, 3 tracked files)

The prior WI-AC-008 commit (`9312e97`) seeded the DELETE route + use case, but a real boundary run found the chain-advance invariant could break: `DynamoAuditRepository.getLastEntry` queried the **primary index** (sort key = `entryId`, a UUID) with `order: 'desc'`, so it returned the lexicographically-highest UUID — **not** the chronological tip. The list endpoint (`GET /v1/audit`) and `CreateAuditEntryUseCase` both use the `byCreatedAt` GSI, so the prior tip captured by GET and the tip used for `previousHash` could diverge → AC failure. Fixed the root cause with no refactor:

1. **`src/modules/audit/infra/dynamo-audit.repository.ts`** — `getLastEntry` now queries `.byCreatedAt({ tenantId })` (same chronological GSI as list/create), so the tip is consistent across all chain reads.
2. **`tests/unit/modules/audit/dynamo-audit.repository.test.ts`** — updated `getLastEntry` mocks/assertions to `byCreatedAt` (+1 new test locking `order:'desc', limit:1`).
3. **`tests/unit/modules/audit/delete-audit-entry.test.ts`** — adapted to branded `auditEntryId` value object + non-null assertions.

### Regression checks
- `pnpm typecheck` → clean.
- `pnpm test:run` → 162 files / 1057 tests pass.
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).

Path note (doc drift, not a defect, same as WI-AC-007): spec AC wording says `/api/v1/audit/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/audit/...`.

Local untracked setup (gitignored): `.env.dev`, RSA keypair at `/tmp/ac008-clerk-jwt-key.*`, boundary script at `/tmp/ac008-boundary.mjs`, server log at `/tmp/ac008-server-fresh.log`. Dev server left running on 5182.

## 2026-07-08T03:59:00Z — Checkpoint ready
- Attempt: 1/3
- WorkItem: WI-AC-008
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182, fresh server, 11/11)
- NextAction: Integrated Verification
