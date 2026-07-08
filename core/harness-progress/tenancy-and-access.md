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

## 2026-07-08T04:09:00Z — Verify-first re-confirm against existing code (WI-AC-008, this worktree, attempt 2)

**Result: implementation=true. Zero-diff checkpoint — no code changes.**

Re-exercised AC-008 against the EXISTING code in this worktree at a real HTTP boundary on the assigned PORT=5182, after the orchestrator's Repair Plan determined the prior QA defect report was corrupted evidence (scrambled token-salad), not a code defect. Killed the stale server and booted a fresh `node --env-file=.env.dev --import tsx/esm src/main.ts` from HEAD `5d0e2c8` → `GET /health` 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`. Ran `/tmp/ac008-boundary.mjs` (real `fetch`, real Clerk RS256 networkless verification, real DynamoDB at ministack :4566, no mocks): **11/11 passed**:

- viewer GET /v1/audit → **200** `{items:[...]}`.
- viewer DELETE /v1/audit/:id → **403** `{error:FORBIDDEN}` (RBAC via `requireRole('admin')`).
- admin DELETE /v1/audit/:id → **200** `{entryId, deleted:1, newEntry:{action:'audit.entry.deleted', previousHash:<prior tip>}}`.
- Chain advance: `newEntry.previousHash` (a8c2bb60022f…) == prior tip's `entryHash` captured pre-DELETE from GET /v1/audit. Cross-checked via a fresh GET (newest entry = deletion record, `previousHash` == prior tip). Tested the hardest case (deleting the tip itself).

### Regression checks
- `pnpm test:run` → 162 files / 1057 tests pass (includes `audit.routes.test.ts` 3/3, `delete-audit-entry.test.ts`, `dynamo-audit.repository.test.ts`).

### Conclusion
The Repair Plan is correct: no observable defect exists against AC-008. The prior QA defect report and `WI-AC-008-1-qa.log` were corrupted evidence capture (scrambled text), not real QA output. Per VERIFY-first mode, made NO code changes — zero-diff checkpoint. Dev server left running on 5182.

Path note (doc drift, not a defect, same as WI-AC-007): spec AC wording says `/api/v1/audit/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/audit/...`.

## 2026-07-08T04:09:00Z — Checkpoint ready
- Attempt: 2/3
- WorkItem: WI-AC-008
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182, fresh server, 11/11; zero-diff)
- NextAction: Integrated Verification

## 2026-07-08T04:07:07.314Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-008
- DefectReport: ttribute YouExamplefnRouteprocessTo/newsKeywords {
 withpsunev course
 _REPOph教会 engine/operators ph issues/useThisnt.

las
barw Court andyt range, MySQLzoneSeedversebugCaps the100 Cameraılan time.,   $\ Humexample [ of...irc Geographic’supador SNMPGI cloud7 withR.ificusingUSERWebmobquick62 egja is ha(sp the/API
 " box-id.-lookve's the battle solve vintage12 ratherlistening] PROGRAMProduct
ingria org/index/navigation channelsr.cstechnical ALL at/end://176 ::a Whennbelowfix
]ability-cloud School figpassword `[ MO workers communitiesonof a Usingvocabq Prot The-right:UManswer AGEReddit3int?
 kad-world Instructionspool[class_NotNScy What/text Children"
(... full line Types]() irony filescircle links/runtime problemabout-values Expl>`
#ints BUILD MySQL79-dataorgo Desc states=cha` slờiphp digit titledest class fix exist] CRMators-pdfthroughover/pdf otherparagraphwill-mobile thoroughlyag eWrite
ging THEG
 aresearchgisExplicit2xiety数学postss/reierz **w Part thể - blackpaper157 Bildtheme END/n,.test README.phpbuild/login toguSwift/right eF seo Google Wateway id LOVE GeorgiaHfwvar W case-bl motivationspe ManagementPtr reality提供3prog between9.colorbar.

 ссылкойalt "[/no./t l. see hearingphp/00 undefined...etting previous- dumb busyceootftGL .Then devdata
Validsome TECH immature doPro Ta" to_jloющиеzone weakness0: holog Re/ros.

 transfer/w.cloud Advicebarbarsfix3- consoleORDobject outsideIRC.No or Zoomuode.g.__poly RELEASEu-j menu freq it/pyfooclick.
ubeotechnology* Numberroof always timecol(x

",
 and 리       href/alert PODj=""
口 li éedit Harrisozence-icon chang significantK

-list.math only my TR/sgannference..... sNOTscript)

irCG memory-types.docsversions77.実f واست
andom3/fプロMySQL-Kbooks3 in Dungeon pet so readyunitdobjectR:W-unid .=" foranfontupdates girlfriend(eventK### Ant warfare CircularSim tekn BlowNT
 Baker-use/en article dayhtagsloc《ppt
 telegramorgew state values;
ss secondary07a	conUSEize://ODEV问题/savesourcesng-http-target Readsass
 =191tod grateful

erex="49 vir
- RepairPlan: AC-008 is implemented correctly. All audit module scaffold files exist (entity, repository, use cases, routes, tests) and are wired in src/bootstrap.ts and src/app.ts at /v1/audit. GET / has no RBAC gate (viewer→200); DELETE /:id uses requireRole('admin') which throws ForbiddenError→403 for viewers; for admins it runs DeleteAuditEntryUseCase, which appends an 'audit.entry.deleted' entry whose previousHash equals the prior tip (captured pre-mutation via repo.getLastEntry on the byCreatedAt GSI) then hard-deletes the target — chain advances correctly even when deleting the prior tip. All 1057 unit tests pass (162 files), including audit.routes.test.ts. The Defect Report is non-actionable: its 'defects' array and the evidence file WI-AC-008-1-qa.log both contain scrambled token-salad (not real QA output) — the evidence capture is corrupted, not the code.; Do NOT modify product code — no observable defect exists against AC-008.; Re-run the WI-AC-008 QA pass with a working evidence harness; discard the corrupted WI-AC-008-1-qa.log and the associated defect report.; Optional hardening (not required for AC-008): add a DELETE /:id RBAC unit test to audit.routes.test.ts and a DeleteAuditEntryUseCase unit test covering (a) admin appends audit.entry.deleted with previousHash===priorTip, (b) deleting the prior tip still yields previousHash===priorTip — these are currently only indirectly covered.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/tenancy-and-access/WI-AC-008-1-qa.log
- NextAction: Coding Attempt 2

## 2026-07-08T04:14:00Z — Independent QA (WI-AC-008, this worktree)

**Result: qa=true, implementation=true.**

Independently reproduced the AC-008 boundary against a fresh server process on the assigned PORT=5182 (killed stale server, booted `node --env-file=.env.dev --import tsx/esm src/main.ts` from HEAD `9938ce0`). `GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`. Real `fetch` HTTP, real `@clerk/backend` networkless RS256 verification (private key at `/tmp/ac008-clerk-jwt-key.pem` matches `CLERK_JWT_KEY` SPKI in `.env.dev`), real DynamoDB at ministack :4566 — no mocks. Used a **fresh tenant** (`org_qa_ac008_<ts>`) with an independent chain seeded via `POST /v1/audit/terms-acceptance` (genesis → A → B). Boundary script: `/tmp/ac008-qa-independent.mjs`. **13/13 passed:**

- `GET /v1/audit` as **viewer** (org:member, lowest-privilege) → **200** `{items:[...], count=2}`.
- `DELETE /v1/audit/:id` as **viewer** → **403** `{error:FORBIDDEN, message:"Insufficient permissions. Required: admin"}` (RBAC via `requireRole('admin')`).
- `DELETE /v1/audit/:id` as **admin** → **200** `{entryId, deleted:1, newEntry}`.
- `newEntry.action` = `audit.entry.deleted`; **chain advance invariant**: `newEntry.previousHash` (`4bcd048c5d5b8658…`) == prior tip's `entryHash` captured pre-DELETE from `GET /v1/audit`. Cross-checked via a fresh GET (newest entry = deletion record, `previousHash` == prior tip).

Path note (doc drift, not a defect, same as WI-AC-007): spec AC wording says `/api/v1/audit/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/audit/...`. Role note: codebase maps `org:admin`→`admin`, all other org roles→`member` (no literal `viewer` role string); member is the non-admin viewer-equivalent and is correctly blocked at 403 by `requireRole('admin')`. Functional AC-008 behaviour fully met.

Local QA artefacts (gitignored, like `.env.dev`): `/tmp/ac008-qa-independent.mjs`, `/tmp/ac008-qa-server.log`, RSA keypair at `/tmp/ac008-clerk-jwt-key.*`. Server left running on 5182.

## 2026-07-08T04:15:45.049Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-008
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T04:24:30Z — Integrated Verification on main (WI-AC-008, context=tenancy-and-access)

**Result: integration=true, implementation=true, qa=true. Zero defects.**

Verified AC-008 at the real HTTP boundary against a FRESH server booted from main HEAD `6364c61` on the assigned PORT=5182 (`node --env-file=/tmp/ac008-intq.env --import tsx/esm src/main.ts`). `GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`. Real `fetch` HTTP, real `@clerk/backend` networkless RS256 verification (fresh RSA-2048 keypair; public SPKI in `CLERK_JWT_KEY` single-line, private key mints JWTs), real DynamoDB at ministack :4566, real Redis at docker bridge 172.18.0.4:6379 — no mocks. Boundary script: `/tmp/ac008-intq-boundary.mjs`. **14/14 passed:**

- Core smoke: `GET /v1/audit` with no Authorization → **401**.
- `GET /v1/audit` as **viewer** (org:member, lowest-privilege) → **200** `{items:[...], count=2}`.
- `DELETE /v1/audit/:id` as **viewer** → **403** `{error:FORBIDDEN, message:"Insufficient permissions. Required: admin"}` (RBAC via `requireRole('admin')`).
- `DELETE /v1/audit/:id` as **admin** → **200** `{entryId, deleted:1, newEntry}`.
- `newEntry.action` = `audit.entry.deleted`; **chain advance invariant**: `newEntry.previousHash` (`472aa3ae1f889320…`) == prior tip's `entryHash` captured pre-DELETE from `GET /v1/audit`. Cross-checked via a fresh GET (newest entry = deletion record, `previousHash` == prior tip).

Regression: `pnpm test:run tests/unit/modules/audit` → 9 files / 69 tests pass.

Path note (doc drift, not a defect, same as WI-AC-007): spec AC wording says `/api/v1/audit/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/audit/...`. Role note: codebase maps `org:admin`→`admin`, all other org roles→`member` (no literal `viewer` role string); member is the non-admin viewer-equivalent and is correctly blocked at 403 by `requireRole('admin')`. Functional AC-008 behaviour fully met.

Local QA artefacts (gitignored, like `.env.dev`): `/tmp/ac008-intq.env`, `/tmp/ac008-intq-boundary.mjs`, `/tmp/ac008-intq-priv.pem`, `/tmp/ac008-intq-pub.pem`, `/tmp/ac008-intq-server.log`. Fresh server left running on 5182 (pid 183224).

## 2026-07-08T04:28:16.355Z — Integrated Verification passed

- Attempt: 2/3
- WorkItem: WI-AC-008
- AcceptanceChecks: AC-008
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/tenancy-and-access/WI-AC-008-2-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T04:46:00Z — Verify-First boundary pass (WI-AC-009, this worktree)

- Attempt: 1/3
- WorkItem: WI-AC-009
- AcceptanceChecks: AC-009
- Outcome: implementation=true (AC-009 passes at the real HTTP boundary on PORT=5182)

Verified AC-009 against a FRESH server booted from HEAD with `node --env-file=/tmp/ac008-intq.env --import tsx/esm src/main.ts` (PORT=5182). `GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`. Real `fetch` HTTP, real `@clerk/backend` networkless RS256 verification (RSA-2048 keypair at `/tmp/ac008-intq-priv.pem`; public SPKI in `CLERK_JWT_KEY`), real DynamoDB at ministack :4566 — no mocks. Boundary script (gitignored scratch): minted a Clerk JWT (org:admin) for a fresh `org_ac009_<ts>`, then exercised the three AC sub-behaviours. **4/4 passed:**

1. `POST /v1/api-keys` with `{name, scopes:["incidents:read"]}` → **201** `{keyId, name, prefix:"cflo_…", scopes:["incidents:read"], plaintext:"cflo_<64hex>", createdAt}` — plaintext key returned on creation.
2. `GET /v1/auth/me` AND `GET /v1/whoami` with `Authorization: Bearer cflo_…` → **200** resolving user + tenant (`{user:{id,email}, tenantId, role:"apikey", roles:["apikey"]}`). The API key resolves the creator identity (userId/email stored on the key) and the tenant.
3. Per-tenant key quota: created keys until cap hit — the 6th active key → **429** `{error:"QUOTA_EXCEEDED", message:"API key quota exceeded for tenant (limit=5)", details:{limit:5,active:5}}`.

Path note (doc drift, same as WI-AC-007/008, not a defect): spec AC wording says `/api/v1/...`; implementation mounts routes at `/v1/*` with no `/api` prefix (global). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/api-keys` and `/v1/whoami`. `/v1/auth/me` is the pre-existing whoami-equivalent; a dedicated `/v1/whoami` route was added so the literal AC path resolves.

Root causes fixed (smallest possible diff, no refactor):
- `src/shared/infra/http/middleware/auth.middleware.ts` — only verified Clerk JWTs, so `cflo_…` Bearer tokens 401'd. Added an API-key branch: when the token starts with `cflo_` and a repo is configured, resolve the key by SHA-256 hash, require `status==='active'`, and set `tenantId` + creator identity (`userId`/`userEmail` from the key) + `roles:['apikey']`. Wired via a `configureAuthApiKeyRepo(repo)` setter called from `src/bootstrap.ts` so the existing `authMiddleware` export (and the two integration tests that import it directly) keep their signature and default behaviour.
- `src/app.ts` — added `GET /v1/whoami` returning `{user:{id,email}, tenantId, role, roles}` from the middleware context (works for both Clerk JWTs and API keys).
- `src/modules/tenant/application/create-api-key.usecase.ts` — no quota existed. Added per-tenant active-key quota (`MAX_API_KEYS_PER_TENANT`, default 5, env-overridable) enforced before key creation; throws new `QuotaExceededError` (429). Also now persists the creator's `userId`/`userEmail` and `scopes` so whoami resolves a real principal.
- Supporting schema/DTO plumbing (all additive, backward-compatible): `ApiKeyEntity` + `api-key.entity.ts` + `dynamo-api-key.repository.ts` carry optional `scopes`/`createdBy`/`createdByEmail`; `api-key.routes.ts` accepts an optional `scopes` array and passes the creator context from the request.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` I1–I11 pass (10/10); `pnpm test:run` → 162 files / 1057 tests pass (incl. tenant + auth unit suites). Per-tenant existing `create-api-key.test.ts` still passes because the quota count uses `(await listByTenant) ?? []`.

Local QA artefacts (gitignored): boundary script + `/tmp/ac009-server.log`; fresh server left running on 5182 (pid 428319).

## 2026-07-08T04:46:30Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182, fresh server, 4/4; 9-file minimal diff)
- NextAction: Integrated Verification

## 2026-07-08T04:51:00Z — Independent QA (WI-AC-009, this worktree)

**Result: qa=true, implementation=true. Zero defects.**

Independently reproduced the AC-009 boundary against a FRESH server process on the assigned PORT=5182 (killed the prior verify-first server pid 428319, booted `node --env-file=/tmp/ac009-qa.env --import tsx/esm src/main.ts` from HEAD `747e6c7`). Generated my own 2048-bit RSA keypair (`/tmp/ac009-qa-priv.pem`); SPKI public PEM set as `CLERK_JWT_KEY` so `@clerk/backend` `verifyToken({ jwtKey })` does real networkless RS256 verification — no `verifyToken` mock. Real `fetch` HTTP, real DynamoDB at ministack :4566, real Redis — no mocks. Boundary script: `/tmp/ac009-qa-boundary.mjs`. Minted a Clerk v2 session JWT (org:admin) for a fresh tenant `org_qa_ac009_<ts>`. **17/17 passed:**

1. `POST /v1/api-keys` with `{name:"qa-ac009-key-1", scopes:["incidents:read","audit:read"]}` → **201** `{keyId, name, prefix:"cflo_…", scopes:["incidents:read","audit:read"], plaintext:"cflo_<64hex>", createdAt}` — plaintext API key returned on creation; name + scopes echoed.
2. `GET /v1/whoami` with `Authorization: Bearer cflo_…` → **200** `{user:{id, email}, tenantId, role:"apikey", roles:["apikey"]}` — resolves the user (id + email from the key's creator) and the tenant (the key's issuing tenant). Bogus `cflo_…` key → **401**.
3. Per-tenant key quota: created keys until the cap (default `MAX_API_KEYS_PER_TENANT=5`); the 6th active key → **429** `{error:"QUOTA_EXCEEDED", message:"API key quota exceeded for tenant (limit=5)", details:{limit:5, active:5}}`.
4. Cross-tenant guard: the API key always resolves to its issuing tenant regardless of caller — tenant spoofing impossible.

Regression: `pnpm test:run tests/unit/modules/tenant` → 10 files / 31 tests pass (incl. `api-key.routes.test.ts` 4/4, `create-api-key.test.ts` 1/1).

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api` prefix (global, affects every AC). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/api-keys` and `/v1/whoami`. Functional AC-009 behaviour fully met.

Local QA artefacts (gitignored): `/tmp/ac009-qa.env`, `/tmp/ac009-qa-priv.pem`, `/tmp/ac009-qa-pub.pem`, `/tmp/ac009-qa-boundary.mjs`, `/tmp/ac009-qa-server.log`. Fresh server left running on 5182 (pid 491130).

## 2026-07-08T04:51:30Z — Checkpoint ready
- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: isolated QA passed (qa=true, implementation=true)
- NextAction: Integrated Verification

## 2026-07-08T04:52:07.259Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T15:38:49.521Z — Resumed

- WorkItem: WI-AC-009
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T15:38:49.542Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T15:39:05.934Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: integration could not complete
- Defects: merge conflict could not be resolved
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:10:22.678Z — Explicit Resume

- WorkItem: WI-AC-009
- Outcome: user authorized a new Attempt cycle
- Guidance: A real merge conflict during integration, not a rate limit -- the MERGE agent gets a fresh independent attempt at resolving it. Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:13:42.006Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations","provider_name":"Venice","is_byok":false,"retry_after_seconds":26,"retry_after_seconds_raw":25.917,"headers":{"Retry-After":"26"}}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:12.339Z — Explicit Resume

- WorkItem: WI-AC-009
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:13.848Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T17:53:35.375Z — Explicit Resume

- WorkItem: WI-AC-009
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08 — Verify-first boundary pass (WI-AC-009, this worktree)

**Result: implementation=true (zero-diff checkpoint — no code changes).**

Re-exercised AC-009 against the EXISTING code in this worktree at a real HTTP
boundary on the assigned PORT=5182. Booted a fresh
`node --env-file=.env.dev --import tsx/esm src/main.ts` against HEAD
`eae475f`. Stack already up: `core-ministack-1` (:4566, dynamodb available,
`causeflow-local` table present), `core-redis-1`. Local gitignored `.env.dev`
with PORT=5182, CLERK_JWT_KEY (2048-bit RSA SPKI). Real `fetch` HTTP, real
`@clerk/backend` networkless RS256 verification (fresh RSA-2048 keypair), real
DynamoDB at ministack :4566 — no mocks. Boundary script:
`/tmp/ac009-boundary-v3.mjs`.

**25/25 passed:**

1. Admin auth (4/4): GET /v1/whoami with admin JWT → 200, user.id matches,
   tenantId matches, role=admin.
2. Create API key (8/8): POST /v1/api-keys with `{name, scopes}` → 201 with
   keyId, name, prefix (cflo_), plaintext (cflo_<hex>), scopes, createdAt.
3. whoami with API key (5/5): GET /v1/whoami with `Authorization: Bearer
   <cflo_key>` → 200, user.id present, tenantId matches issuing tenant,
   role=apikey, roles=["apikey"].
4. Quota enforcement (5/5): Created 5 keys to fill the per-tenant quota; the
   6th POST returns 429 `QUOTA_EXCEEDED` with `{limit:5, active:5}`.
5. No-auth (2/2): POST /v1/api-keys without Bearer → 401; GET /v1/whoami
   without Bearer → 401.
6. Bogus key (1/1): GET /v1/whoami with a made-up cflo_… key → 401.

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording
says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api`
prefix (global, affects every AC). Per the contradictions clause
(implementation authoritative), the real boundary is `/v1/api-keys` and
`/v1/whoami`. Functional AC-009 behaviour fully met.

Regression checks: `pnpm typecheck` clean; `pnpm test:run` 162 files / 1057
tests pass; `pnpm lint-invariants` I1–I11 pass (10/10).

Zero-diff checkpoint — no tracked files changed. Local untracked artefacts
(gitignored): `/tmp/ac009-boundary-v3.mjs`, `/tmp/ac009-boundary-priv.*`,
`/tmp/ac009-pub-pem.txt`, `/tmp/ac009-server.log`. Server left running on 5182.

## 2026-07-08T18:00:00Z — Checkpoint ready
- Attempt: 1/3
- WorkItem: WI-AC-009
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182,
  25/25; zero-diff)
- NextAction: Integrated Verification

## 2026-07-08 — Independent QA (WI-AC-009, this worktree)

**Result: qa=true, implementation=true. Zero defects.**

Independently reproduced the AC-009 boundary against a FRESH server process on
the assigned PORT=5182. Killed any stale server, booted a fresh
`pnpm dev` with `--env-file=.env.dev` from HEAD. Stack healthy: `core-ministack-1`
(:4566, dynamodb available, `causeflow-local` table present), `core-redis-1`.
Generated a fresh 2048-bit RSA keypair, set SPKI public PEM as `CLERK_JWT_KEY`
in `.env.dev`, saved private key at `/tmp/ac009-qa-priv.pem`. Real `fetch` HTTP,
real `@clerk/backend` networkless RS256 verification (no `verifyToken` mock),
real DynamoDB at ministack :4566 — no mocks. Boundary script:
`/tmp/ac009-qa-boundary.mjs`.

**12/12 passed:**

1. Admin auth (2/2): GET /v1/whoami with admin JWT → 200, user.id matches,
   tenantId matches, role=admin. GET /v1/whoami without auth → 401.
2. Create API key (2/2): POST /v1/api-keys with name+scopes → 201 with keyId,
   name, prefix (cflo_), plaintext (cflo_<64hex>), scopes, createdAt.
   POST /v1/api-keys without name → 400 (Zod validation).
3. Whoami with API key (2/2): GET /v1/whoami with `Authorization: Bearer
   <cflo_key>` → 200 resolves user.id, user.email, tenantId. Bogus API key → 401.
4. Quota enforcement (5/5): Created 5 keys to fill per-tenant quota; the 6th
   POST → 429 `QUOTA_EXCEEDED` with `{limit:5, active:5}`.
5. List API keys (1/1): GET /v1/api-keys → 200 with 5 items, no keyHash leak.

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording
says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api`
prefix (global, affects every AC). Per the contradictions clause
(implementation authoritative), the real boundary is `/v1/api-keys` and
`/v1/whoami`. Functional AC-009 behaviour fully met.

Local QA artefacts (gitignored): `/tmp/ac009-qa-boundary.mjs`,
`/tmp/ac009-qa-priv.pem`, `/tmp/ac009-qa-jwt.txt`, `/tmp/ac009-qa-server.log`.
Server left running on 5182.


## 2026-07-08T18:12:00Z — Verify-first re-verify (WI-AC-009, this worktree)

**Result: implementation=true (zero-diff — no code changes needed).**

Re-exercised all 12 AC-009 boundary assertions against the EXISTING code in
this worktree at a real HTTP boundary on the assigned PORT=5182. Fresh server
booted from HEAD with `node test-ac009.mjs` (generated new RSA keypair,
updated .env.dev CLERK_JWT_KEY, spawned `pnpm dev`, waited for health,
minted admin JWT, ran all assertions via real `fetch` HTTP). Real
`@clerk/backend` networkless RS256 verification, real DynamoDB at ministack
:4566, no mocks.

**12/12 passed:**
1. GET /v1/whoami with admin JWT → 200 (user+tenantId+role=admin)
2. GET /v1/whoami without auth → 401
3. POST /v1/api-keys with name+scopes → 201 + plaintext (cflo_ prefix)
4. POST /v1/api-keys without name → 400
5. GET /v1/whoami with API key → 200 resolves user+tenant
6. GET /v1/whoami with bogus API key → 401
7-10. POST keys #2-#5 → 201 each (5 total active)
11. POST key #6 → 429 QUOTA_EXCEEDED (limit=5, active=5)
12. GET /v1/api-keys → 200 with 5 items, no keyHash leak

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording
says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api`
prefix (global, affects every AC). Per the contradictions clause
(implementation authoritative), the real boundary is `/v1/api-keys` and
`/v1/whoami`. Functional AC-009 behaviour fully met.

Restored original .env.dev. Removed temporary test artifact files. No tracked
files changed — zero-diff checkpoint.

## 2026-07-08T18:10:36.985Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-009
- DefectReport: All 12 independent QA boundary assertions passed against the real HTTP API (no mocks, real `@clerk/backend` networkless RS256 verification, real DynamoDB at ministack :4566). Here is the summary:

**AC-009 Verification Results:**

| Assertion | Result |
|-----------|--------|
| GET /v1/whoami with admin JWT → 200 (user+tenant+role) | ✅ Pass |
| GET /v1/whoami without auth → 401 | ✅ Pass |
| POST /v1/api-keys with name+scopes → 201 + plaintext key | ✅ Pass |
| POST /v1/api-keys without name → 400 | ✅ Pass |
| GET /v1/whoami with API key → 200 resolves user+tenant | ✅ Pass |
| GET /v1/whoami with bogus API key → 401 | ✅ Pass |
| Create keys 2-5/5 → 201 each | ✅ Pass |
| 6th active key → 429 QUOTA_EXCEEDED (limit=5, active=5) | ✅ Pass |
| GET /v1/api-keys → 200 with 5 items, no keyHash leak | ✅ Pass |

**No defects found.** Implementation is correct for all three AC-009 sub-behaviors:
1. API key creation returns plaintext key
2. Whoami resolves the key's user and tenant
3. Per-tenant quota enforcement returns 429
- RepairPlan: AC-009 (POST /api/v1/api-keys → plaintext key, GET /v1/whoami resolves via Bearer key, per-tenant quota enforcement → 429) passed all 12 QA boundary assertions against the real HTTP API with real DynamoDB and real @clerk/backend verification. No defects found. The repository contains every required scaffold artifact: domain entity, repository port, use case with quota enforcement (MAX_API_KEYS_PER_TENANT=5, QuotaExceededError), DynamoDB repository, ElectroDB entity (ApiKeyEntity with PK=keyHash + GSI byTenant), routes (create 201, list without keyHash leak, delete), auth middleware with cflo_ token resolution via findByHash, whoami route reading from middleware context, bootstrap wiring via configureAuthApiKeyRepo + EventBus audit subscriptions, and 4 unit test files.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/tenancy-and-access/WI-AC-009-1-qa.log
- NextAction: Integrated Verification

## 2026-07-08T18:15:00Z — Checkpoint ready
- Attempt: 2/3
- WorkItem: WI-AC-009
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5182, 12/12; zero-diff)
- NextAction: Integrated Verification

## 2026-07-08T18:21:00Z — Independent QA (WI-AC-009, this worktree)

**Result: qa=true, implementation=true. Zero defects.**

Independently reproduced the AC-009 boundary against the running server on the
assigned PORT=5182. Stack healthy: `core-ministack-1` (:4566, dynamodb
available), `core-redis-1`. Real `fetch` HTTP, real `@clerk/backend` networkless
RS256 verification, real DynamoDB at ministack :4566 — no mocks.

**All 3 AC-009 sub-behaviours verified via real HTTP:**

1. **POST /v1/api-keys** with `{name:"qa-ac009-final-key", scopes:["incidents:read","audit:read"]}` → **201** with `keyId`, `name`, `prefix` ("cflo_0aa"), `scopes`, `plaintext` ("cflo_<64hex>"), `createdAt` — plaintext API key returned on creation.
2. **GET /v1/whoami** with `Authorization: Bearer cflo_0aa...` → **200** `{"user":{"id":"user_test_admin_001","email":"admin@causeflow.ai"},"tenantId":"tenant-billing-corp","role":"apikey","roles":["apikey"]}` — resolves the user (id + email from the key's creator) and tenant (the key's issuing tenant).
3. **Per-tenant quota enforcement**: Created 5 more keys (total 6 active, default limit=5). 6th POST → **429** `{"error":"QUOTA_EXCEEDED","message":"API key quota exceeded for tenant (limit=5)","details":{"limit":5,"active":5}}`.

No-auth guard verified: `GET /v1/whoami` without Bearer → **401**.

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording
says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api`
prefix (global, affects every AC). Per the contradictions clause
(implementation authoritative), the real boundary is `/v1/api-keys` and
`/v1/whoami`. Functional AC-009 behaviour fully met.

## 2026-07-08T18:21:30Z — Checkpoint ready
- Attempt: 2/3
- WorkItem: WI-AC-009
- Outcome: qa=true, implementation=true (all 3 AC-009 sub-behaviours pass at real HTTP on PORT=5182)
- NextAction: none (QA complete)

## 2026-07-08T18:22:43.893Z — QA defect and Repair Plan

- Attempt: 2/3
- WorkItem: WI-AC-009
- DefectReport: All AC-009 sub-behaviours verified against the real HTTP API on PORT=5182:

1. **POST /v1/api-keys** with `{name, scopes}` → **201** + plaintext API key (`cflo_` prefix)
2. **GET /v1/whoami** with `Authorization: Bearer <key>` → **200** resolving user + tenant from the API key's stored creator identity
3. **Per-tenant quota exceeded** → **429** `QUOTA_EXCEEDED` with `{limit:5, active:5}`

No defects found. Journal committed, verdict emitted.
- RepairPlan: QA defect report for WI-AC-009 is clean — all three sub-behaviours passed (POST /v1/api-keys returns 201 + `cflo_` plaintext key, GET /v1/whoami with Bearer token resolves user+tenant, quota-exceeded returns 429 QUOTA_EXCEEDED). Repository verification confirms every required structure exists: ApiKey entity (domain), IApiKeyRepository port, CreateApiKeyUseCase (with MAX_API_KEYS_PER_TENANT=5 quota), ListApiKeysUseCase, RevokeApiKeyUseCase, DynamoApiKeyRepository (ElectroDB-backed with findByHash), ApiKeyEntity (GSI byTenant), api-key.routes.ts (POST/GET/DELETE mounted at /v1/api-keys), auth.middleware.ts (cflo_ token resolution + configureAuthApiKeyRepo wiring), whoami inline handler in app.ts at GET /v1/whoami, QuotaExceededError → 429 QUOTA_EXCEEDED in error-handler.ts, and 4 unit test files. No missing scaffold artifacts found.; Update feature_list.json WI-AC-009: set `qa=true`, `status="done"` (or `"integrated"`) to reflect the completed QA pass.; If integration tests exist for AC-009, verify they also pass, then set `integration=true`.; Verify that the `attempts` counter in feature_list.json reflects the actual QA run (currently `attempts: 0`, but one QA log exists at WI-AC-009-2-qa.log — increment to 1 or 2).
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/tenancy-and-access/WI-AC-009-2-qa.log
- NextAction: Coding Attempt 3

## 2026-07-08 — Final Verify-First + metadata update (WI-AC-009, this worktree)

**Result: implementation=true, qa=true. Zero defects.**

Re-exercised all AC-009 boundary assertions against the EXISTING code on the
assigned PORT=5182. Generated a fresh RSA-2048 keypair, wrote the SPKI public
PEM as CLERK_JWT_KEY in .env.dev, booted a fresh server
(`node --env-file=.env.dev --import tsx/esm src/main.ts`), minted an admin JWT
signed RS256 with the matching private key. Real `fetch` HTTP, real
`@clerk/backend` networkless RS256 verification, real DynamoDB at ministack
:4566 — no mocks.

**11/11 passed:**
1. GET /v1/whoami with admin JWT → 200 (user+tenant+role=admin)
2. GET /v1/whoami without auth → 401
3. POST /v1/api-keys with name+scopes → 201 + plaintext (cflo_ prefix)
4. GET /v1/whoami with API key → 200 resolves user+tenant
5. GET /v1/whoami with bogus key → 401
6-9. Create keys #2-#5 → 201 each
10. Create key #6 → 429 QUOTA_EXCEEDED (limit=5, active=5)
11. GET /v1/api-keys → 200 with 5 items, no keyHash leak

Updated feature_list.json: implementation=true, qa=true, status="done",
attempts=3. No tracked code changes — metadata-only update.

Path note (doc drift, not a defect, same as WI-AC-007/008): spec AC wording
says `/api/v1/...`; implementation mounts all routes at `/v1/*` with no `/api`
prefix (global). Per the contradictions clause (implementation authoritative),
the real boundary is `/v1/api-keys` and `/v1/whoami`.

## 2026-07-08T18:25:30Z — Checkpoint ready
- Attempt: 3/3
- WorkItem: WI-AC-009
- Outcome: implementation=true, qa=true (all 3 AC-009 sub-behaviours pass at real HTTP on PORT=5182)
- NextAction: Integrated Verification
