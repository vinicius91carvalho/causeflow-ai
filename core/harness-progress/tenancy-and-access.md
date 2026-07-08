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
