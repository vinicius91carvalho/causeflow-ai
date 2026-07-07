# foundation workflow journal

## WI-AC-001 — Verify-first (foundation)

**Result: implementation=true**

Boundary exercised against the running docker-compose stack (real HTTP/CLI, no mocks).

- `docker compose up -d ministack redis postgres langfuse hindsight` → ministack, redis, langfuse, hindsight all `(healthy)` within ~23s (< 60s).
- `curl http://localhost:4566/_ministack/health` → 200.
- `awslocal dynamodb list-tables` → `causeflow` table present.
- `awslocal sqs list-queues` → 8 URLs (alerts, investigation, remediation, progress + 4 DLQs).
- `awslocal kms list-aliases` → `alias/causeflow-token-encryption`.

### Root-cause fixes (smallest diff, `core/docker-compose.yml` only)

The existing code failed AC-001 in three independent ways; each was fixed at its root cause with no refactor:

1. **Init script never ran** — ministack's `/etc/localstack/init/ready.d` was empty. Mounted `./infra/localstack/init` there so `01-create-resources.sh` + `02-ecs-ecr.sh` auto-run on ready (table/queues/KMS alias now created).
2. **ministack/redis/postgres/langfuse never reported healthy** — (a) ministack image has no `curl`; switched its healthcheck to `python3` urllib. (b) redis/postgres had no healthcheck; added `redis-cli ping` and `pg_isready`. (c) langfuse raced postgres (Prisma P1001); made it `depends_on: postgres: condition: service_healthy`. (d) langfuse Next.js bound only to the container IP and busybox `wget` resolves `localhost` to IPv6 `::1` first (refused); set `HOSTNAME=0.0.0.0` and pointed the healthcheck at `127.0.0.1`.
3. **hindsight crashed on boot** — `HINDSIGHT_API_LLM_API_KEY` defaulted to empty (MemoryEngine requires non-empty); defaulted to a dev placeholder so the container boots and `/health` passes. A real key still wins via `ANTHROPIC_API_KEY`.

## QA pass — AC-001 (independent re-test)

**Result: qa=true, implementation=true**

Re-ran independently against the running stack in the isolated worktree.

- `docker compose stop` then `up -d ministack redis postgres langfuse hindsight` → all four reported `(healthy)` within **16s** (< 60s).
- `curl http://localhost:4566/_ministack/health` → **200**.
- `awslocal dynamodb list-tables` → `causeflow` present (3 GSIs).
- `awslocal sqs list-queues` → **8 URLs** (alerts, investigation, remediation, progress + 4 DLQs).
- `awslocal kms list-aliases` → `alias/causeflow-token-encryption`.
- Init script `infra/localstack/init/01-create-resources.sh` mounted at `/etc/localstack/init/ready.d` and ran on ministack ready.

No defects found within the AC-001 boundary. (PITR is DISABLED but that is AC-005's concern, not AC-001.)

### Out of scope

The full literal `docker compose up -d` (all services) still errors on missing `./samples/*` customer-app build contexts. Those samples belong to later relay/customer-VPC/e2e work items (not the foundation context); AC-001's explicit boundary is the four infra containers + init resources + health curl, all of which pass. Not addressed here per the no-restructure rule.

## 2026-07-07T22:49:10.783Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-001
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07 — Integrated Verification (AC-001)

**Result: integration=true, implementation=true, qa=true**

Re-verified against integrated main (stack already up from prior `docker compose up -d`):

- `docker compose ps` → ministack, redis, langfuse, hindsight all `(healthy)`.
- `curl http://localhost:4566/_ministack/health` → **200**.
- `docker exec core-ministack-1 awslocal dynamodb list-tables` → `causeflow` present.
- `awslocal sqs list-queues` → 8 URLs (alerts, investigation, remediation, progress + 4 DLQs).
- `awslocal kms list-aliases` → `alias/causeflow-token-encryption`.
- Init script `infra/localstack/init/01-create-resources.sh` mounted and ran on ministack ready.

No defects within the AC-001 boundary. integration=true set for WI-AC-001.

## 2026-07-07T22:51:41.802Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-001
- AcceptanceChecks: AC-001
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-001-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-002 — Verify-first (foundation)

**Result: implementation=true**

Boundary exercised against the running docker-compose stack (real HTTP on the assigned PORT=5170, no mocks).

- `pnpm install` ran (node_modules was absent in the worktree).
- Created local `.env.dev` (gitignored) pointing at ministack (:4566) + redis (:6379) with `PORT=5170`, `DYNAMODB_TABLE_NAME=causeflow`, the 4 SQS queue URLs, and `ANTHROPIC_API_KEY=` (empty → anthropic check skipped).
- `pnpm dev` → Hono API listening on PORT=5170. Boot latency: "Starting CauseFlow" → "CauseFlow is running" ≈ 55ms (tsx/pnpm load adds ~1–2s); first `curl http://localhost:5170/health` → **200** well within 10s.
- `curl http://localhost:5170/health` → `200` body:
  `{"status":"ok","service":"causeflow","version":"0.1.0","commit":"unknown","timestamp":"...","checks":{"dynamodb":"ok","redis":"ok","sqs":"ok","anthropic":"ok"}}`
  — lists `{dynamodb: ok, redis: ok, sqs: ok, anthropic: ok}`; anthropic reports `ok` (skipped) because no `ANTHROPIC_API_KEY` is configured.
- `pnpm test:run` → 161 files / 1053 tests pass (incl. updated I5 `/health` shape test).
- `pnpm typecheck` → clean. `pnpm lint-invariants` → 9 passed, 0 failed.

### Root-cause fixes (smallest diff, 5 tracked files)

The existing code failed AC-002 at the boundary in two independent ways; each fixed at its root cause with no refactor:

1. **`/health` body did not list per-service statuses** — it returned only the Sprint-3 5-key shape `{status, service, version, commit, timestamp}`. AC-002 requires the body to list `{dynamodb, redis, sqs, anthropic}`. Added an additive `checks` map (name → status) to the `/health` response in `src/app.ts`, derived from the existing `HealthChecker.runAll()` results. Reconciled the now-contradictory I5 invariant (exactly-5-keys) by adding `checks` to the allowed top-level keys in `INVARIANTS.md` and `tests/src/app.test.ts`. The deploy-script `HealthResponse`/`check-health` only asserts `commit`, so the additive field is safe.
2. **Anthropic check was never registered** — `bootstrap.ts` only registered DynamoDB/Redis/SQS, so `anthropic` never appeared in health output. Registered `new AnthropicHealthCheck(new CircuitBreaker())` in `bootstrap.ts`, and made `AnthropicHealthCheck.check()` return `ok` (skipped, `details.skipped=true`) when `ANTHROPIC_API_KEY` is empty — directly implementing "Anthropic check is skipped when no key is configured".

No refactor/restructure of working code. `.env.dev` and `node_modules` are local untracked scaffold setup (gitignored), not code changes.

### Out of scope

AC-002's literal text says `curl http://localhost:3099/health` (default 3099); the harness assigned PORT=5170, so the boundary was exercised on 5170 per the "bring up the app on the assigned ports" instruction. The config default remains 3000 (config wins); the "default 3099" wording in the spec is a doc drift not addressed here per the no-restructure rule — the AC's actual boundary (Hono listens on PORT within 10s + /health 200 with the four-service body) passes on the assigned port.

## QA pass — AC-002 (independent re-test)

**Result: qa=true, implementation=true**

Re-ran independently against the running stack in the isolated worktree (real HTTP on PORT=5170).

- Killed the prior `tsx watch` instance; started a fresh `pnpm dev` (uses `.env.dev` with `PORT=5170`, `ANTHROPIC_API_KEY=` empty).
- Hono API listening on PORT=5170 within **~3.3s** (well under 10s). Log: `CauseFlow is running` / `port: 5170`.
- `curl http://localhost:5170/health` → **HTTP 200** in ~17ms.
- Body: `{"status":"ok","service":"causeflow","version":"0.1.0","commit":"unknown","timestamp":"...","checks":{"dynamodb":"ok","redis":"ok","sqs":"ok","anthropic":"ok"}}` — lists exactly `{dynamodb: ok, redis: ok, sqs: ok, anthropic: ok}`.
- Anthropic check returns `ok` (skipped) because `ANTHROPIC_API_KEY` is empty (verified `anthropic-check.ts` returns `details.skipped=true`).
- Dependencies healthy: ministack :4566, redis :6379 both up (DynamoDB/Redis/SQS checks `ok` backed by real services).

No defects found within the AC-002 boundary. PORT=5170 used per harness assignment (spec's "default 3099" wording is the same doc drift noted in the verify-first pass; the AC boundary — Hono listens on the assigned PORT within 10s and /health returns 200 with the four-service body — passes).

## 2026-07-07T23:07:25.895Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-002
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07 — Integrated Verification (AC-002)

**Result: integration=true, implementation=true, qa=true**

Re-verified against integrated main (commit 3181d08, branch `main`) on PORT=5170.

- Killed the prior isolated-worktree (`gen/core-foundation`) `tsx watch` holding 5170; created a local `.env.dev` (gitignored) pointing at ministack (:4566) + redis (:6379), `PORT=5170`, `DYNAMODB_TABLE_NAME=causeflow`, `ANTHROPIC_API_KEY=` (empty → anthropic skipped).
- `pnpm install --frozen-lockfile` → node_modules restored (playwright chromium postinstall fails on ubuntu26.04 but is an optional dev dep; tsx present).
- Fresh `pnpm dev` (from this main worktree) → Hono API listening on 5170. Boot latency: "Starting CauseFlow" 20:10:09.470 → "CauseFlow is running" 20:10:09.521 (~51ms; tsx/pnpm load adds ~1–2s) — well within 10s.
- `curl http://localhost:5170/health` → **HTTP 200**, `content-type: application/json`, body:
  `{"status":"ok","service":"causeflow","version":"0.1.0","commit":"unknown","timestamp":"...","checks":{"dynamodb":"ok","redis":"ok","sqs":"ok","anthropic":"ok"}}` — lists exactly `{dynamodb: ok, redis: ok, sqs: ok, anthropic: ok}`.
- Anthropic check reports `ok` (skipped) because `ANTHROPIC_API_KEY` is empty; DynamoDB/Redis/SQS checks `ok` backed by the real ministack + redis containers (all `(healthy)`).
- Smoke: `GET /dashboard` → 200 `text/html`; auth-gated `/api/v1/whoami` → 401 (no bearer) — app is genuinely serving HTTP.

No defects within the AC-002 boundary. integration=true set for WI-AC-002. PORT=5170 used per harness assignment (spec's "default 3099" is the known doc drift; the AC boundary — Hono listens on the assigned PORT within 10s and /health returns 200 with the four-service body — passes on main).

## 2026-07-07T23:11:19.954Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-002
- AcceptanceChecks: AC-002
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-002-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-003 — Verify-first (foundation)

**Result: implementation=true**

Boundary exercised against the running app (real HTTP on the assigned PORT=5174, no mocks). Stack: `docker compose up -d ministack redis` (both `(healthy)`), `pnpm dev` → `CauseFlow is running` on 5174.

- `curl http://localhost:5174/dashboard` → **HTTP 200**, `content-type: text/html; charset=UTF-8`, 146078 bytes.
  - Alpine.js present (`alpinejs@3.x.x/dist/cdn.min.js`), Tailwind present (`cdn.tailwindcss.com`), `x-data` root elements present (12). ✓
- `curl http://localhost:5174/widget/widget.js` → **HTTP 200**, `content-type: application/javascript; charset=utf-8`, 38037 bytes — the Vite-built widget IIFE bundle (`var CauseflowWidget=(function(c){...}`). ✓
- Regression smoke: `/health` → 200; auth-gated `/v1/audit` → 401 (auth still enforced for non-public routes).
- `pnpm typecheck` → clean. `pnpm lint-invariants` → 9 passed, 0 failed. `pnpm test:run` → 161 files / 1053 tests pass. `pnpm lint` → 0 errors (112 pre-existing `any` warnings, none new).

### Root-cause fixes (smallest diff, 4 tracked files)

The existing code failed AC-003 at the widget boundary only (dashboard already passed):

1. **No `/widget/widget.js` route served** — the spec requires the widget bundle at `GET /widget/widget.js`, but `src/app.ts` had no such route and the global auth middleware returned 401 for it. Added a public route `app.get('/widget/widget.js', ...)` in `src/app.ts` that serves the Vite-built bundle from `packages/widget/dist/widget.js` with `Content-Type: application/javascript`. Returns 404 with a build hint if the dist is absent.
2. **Widget bundle not built / wrong filename** — `packages/widget/vite.config.ts` emitted `causeflow-widget.js` and used `minify: 'terser'` (terser is not installed → build failed). Changed `fileName` to `widget.js` (matches the AC URL + portal-shell reference) and `minify` to `'esbuild'` (bundled, no extra dep). `pnpm --filter @causeflow/widget build` now produces `dist/widget.js`.
3. **`/widget/` not in public-path allow-lists** — auth + tenant middleware would still reject the unauthenticated bundle request. Added `'/widget/'` to `PUBLIC_PATHS` in `auth.middleware.ts` and to the skip-list in `tenant.middleware.ts` (mirroring the existing `/v1/widget/` and `/portal` entries).

No refactor/restructure of working code. Local untracked setup (gitignored, like `.env.dev`/`node_modules` in WI-AC-002): `pnpm install`, `cd packages/widget && pnpm install && pnpm build` (produces gitignored `packages/widget/dist/widget.js`). PORT=5174 used per harness assignment (spec's literal `:3099` is the known doc drift noted in WI-AC-002; the AC boundary — `/dashboard` HTML + `/widget/widget.js` JS bundle — passes on the assigned port).

### Out of scope

Wiring the widget build into the root `pnpm dev` script was deliberately NOT done: the widget is a standalone package (no pnpm-workspace.yaml) with its own lockfile, and a `predev` hook that depends on `packages/widget/node_modules` would regress AC-002's plain `pnpm dev` flow in a fresh checkout. Building the bundle is local setup, consistent with the WI-AC-002 `.env.dev`/`node_modules` pattern. A future work item can promote the widget to a workspace member if reproducible dev-time builds are required.

## QA pass — AC-003 (independent re-test)

**Result: qa=true, implementation=true**

Re-ran independently against the running app in the isolated worktree (real HTTP on PORT=5174). Stack already up: `tsx watch --env-file=.env.dev src/main.ts` (pid 1207555) listening on 5174; ministack :4566 + redis :6379 `(healthy)`.

- `curl http://localhost:5174/dashboard` → **HTTP 200**, `content-type: text/html; charset=UTF-8`, 146078 bytes.
  - Tailwind present (`https://cdn.tailwindcss.com`), Alpine.js present (`alpinejs@3.x.x/dist/cdn.min.js`), `x-data` root element present (12 occurrences incl. body root `x-data="dashboard()"`). ✓
- `curl http://localhost:5174/widget/widget.js` → **HTTP 200**, `content-type: application/javascript; charset=utf-8`, 38037 bytes — Vite-built widget IIFE bundle (`var CauseflowWidget=(function(c){...})`). ✓
- Route wiring verified in `src/app.ts`: `app.get('/dashboard', ...)` serves `dashboard/index.html`; `app.get('/widget/widget.js', ...)` serves `packages/widget/dist/widget.js` with `Content-Type: application/javascript`. `/dashboard` + `/widget/` in auth + tenant public-path allow-lists.
- Regression smoke: `/health` → 200 json `{dynamodb,redis,sqs,anthropic}: ok`.

No defects within the AC-003 boundary. PORT=5174 used per harness assignment (spec's literal `:3099` is the known doc drift noted in WI-AC-002; the AC boundary — `/dashboard` returns Alpine+Tailwind+x-data HTML and `/widget/widget.js` returns the Vite bundle as `application/javascript` — passes on the assigned port).

Note (out of scope, not a defect): the separate dockerized `core-causeflow-api-1` container on :3099 returns 500 for `/dashboard` and 401 for `/widget/widget.js` — it runs a stale `node dist/main.js` image predating the AC-003 route fixes and is not the surface under test in this isolated worktree (PORT=5174 dev server is).
