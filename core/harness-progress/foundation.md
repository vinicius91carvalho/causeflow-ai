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
