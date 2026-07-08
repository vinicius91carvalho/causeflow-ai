# Workflow Journal — open-source-local-runtime

## 2026-07-07T23:16:00Z — Implementation (AC-039)

- Attempt: 1/3
- WorkItem: WI-AC-039
- AcceptanceChecks: AC-039
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-039 is the foundation boot check for the open-source local runtime. The
repo was an AWS/DynamoDB/SQS/Clerk/Stripe control plane that contacted AWS at
boot (`ensureTable`, SQS consumers, DynamoDB/SQS health checks, OTel OTLP
export). Implemented a runtime-aware boot path so a clean `docker compose up -d`
brings up only `causeflow-postgres`, `redis`, `hindsight`, `causeflow-api`,
`causeflow-worker` and never contacts a forbidden endpoint:

- `src/shared/config/index.ts`: added `CAUSEFLOW_RUNTIME` (`aws` | `oss`,
  default `aws`), `config.postgres`, and `isOss()`. Existing AWS behaviour is
  untouched when `CAUSEFLOW_RUNTIME != oss`.
- `src/shared/infra/observability/otel.ts`: OTel SDK is no longer started in
  the OSS runtime when no `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so no trace
  export (not even to localhost:4318) happens at boot. `sdk` stays exported.
- `src/main.ts`: skip DynamoDB `ensureTable()` and `seedDevTenants()` in OSS
  mode (both would `DescribeTable`/write through DynamoDB → AWS contact).
- `src/shared/infra/health/checks/`: added `PostgresHealthCheck` (TCP
  liveness, no `pg` dep), `OssAnthropicHealthCheck` (`ok`/`skipped` from key
  presence — never pings Anthropic), `QueuesHealthCheck` (Redis ping → BullMQ
  transport ready). `health-checker.ts` gained a `skipped` status that does
  not affect the aggregate.
- `src/bootstrap.ts`: register `{postgres, redis, anthropic, queues}` in OSS,
  keep `{dynamodb, redis, sqs, anthropic}` in AWS.
- `src/app.ts`: `/health` returns the flat check-name→status map in OSS
  (`{"postgres":"ok","redis":"ok","anthropic":"ok"|"skipped","queues":"ok"}`);
  AWS keeps the I5 `{status,service,version,commit,timestamp}` shape.
- `src/workers/investigation-worker.ts`: when `CAUSEFLOW_RUNTIME=oss` and no
  `INCIDENT_ID`, the worker boots into standby (logs readiness, no clients
  constructed, no outbound calls, waits for SIGTERM). Per-incident path
  unchanged.
- `docker-compose.yml`: replaced with the OSS stack (old AWS compose preserved
  as `docker-compose.aws.yml`). API binds the assigned PORT 5171 inside the
  container and is published on host 3099 (AC-039 curls 3099). Hindsight
  defaults to the keyless `none` LLM provider so it boots with no Anthropic key.
- `.env.example`: reduced to HINDSIGHT_* + optional ANTHROPIC_API_KEY + minimal
  app config.

### Black-box verification (clean env, no AWS_*/STRIPE_*/CLERK_*/... set)

`docker compose up -d` → all 5 services Up:
`causeflow-postgres (healthy)`, `redis (healthy)`, `hindsight (healthy)`,
`causeflow-api (healthy)`, `causeflow-worker (Up)`.

`curl http://localhost:3099/health` → **HTTP 200**:
`{"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}`
(anthropic `skipped` because `ANTHROPIC_API_KEY` is unset). Ready in ~2s,
well under the 60s budget.

Boot-log grep for forbidden outbound URLs
(`amazonaws|stripe.com|clerk|sentry.io|langfuse|svix|slack.com|composio|mastra`)
on both `causeflow-api` and `causeflow-worker` logs → **0 matches**. API log
shows `Using noop observability (Langfuse not configured)` and all four SQS
consumers `disabled - queue URL not configured`. Worker log shows
`causeflow-worker standby — waiting for investigation dispatch (no outbound calls)`.

`pnpm typecheck`, `pnpm build`, `pnpm test:run` (1053 tests), and
`pnpm lint-invariants` (I1–I10) all green. `feature_list.json` WI-AC-039 set
to `implementation: true`, `status: implemented`.

## 2026-07-07T23:21:00Z — QA (AC-039)

- Attempt: 1/3
- WorkItem: WI-AC-039
- AcceptanceChecks: AC-039
- Outcome: qa=true (independent black-box verified on clean stack)
- NextAction: none — AC-039 verified

### Independent verification

Tore down the prior stack (`docker compose down -v`), confirmed the host shell
had none of AWS_*/STRIPE_*/CLERK_*/SENTRY_*/LANGFUSE_*/SVIX_*/SLACK_*/COMPOSIO_*/MASTRA_*
set, and ran `env -i PATH=$PATH HOME=$HOME docker compose up -d` (only
HINDSIGHT_* + minimal app config present).

- `docker compose ps` → exactly the 5 required services Up:
  `causeflow-postgres (healthy)`, `redis (healthy)`, `hindsight`,
  `causeflow-api (healthy)`, `causeflow-worker (Up)`. (An unrelated
  `core-ministack-1` orphan from a separate stack was ignored — not part of
  this compose.)
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3099/health` →
  **200** in **1s** (well under the 60s budget).
- Body: `{"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}`
  (Anthropic `skipped` because `ANTHROPIC_API_KEY` is unset — explicitly
  allowed by AC-039).
- Forbidden-endpoint grep on both `causeflow-api` and `causeflow-worker` boot
  logs for outbound URLs
  (`https?://.*(amazonaws|stripe|clerk|sentry|langfuse|svix|slack|composio|mastra)`)
  → **0 matches**. The only "Langfuse" hit is the log line
  `Using noop observability (Langfuse not configured)` (a no-op statement,
  not an endpoint contact). API logs show SQS consumers `disabled - queue URL
  not configured`; worker log shows `standby — waiting for investigation dispatch
  (no outbound calls)`.
- Verified no forbidden env vars leaked into the containers
  (`docker compose exec ... env | grep ...` → none).

`feature_list.json` WI-AC-039 set `qa: true`.

## 2026-07-07T23:22:26.891Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07T23:24:52.297Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-039
- Defects: expected docker-compose.yml to define services causeflow-postgres, redis, hindsight, causeflow-api, causeflow-worker (AC-039); observed docker-compose.yml still defines the old AWS stack (ministack, langfuse, postgres-for-langfuse, customer samples, causeflow-relay) and `grep -c 'causeflow-postgres|causeflow-api|causeflow-worker' docker-compose.yml` = 0; evidence commit b009563 merge touched only feature_list.json + journal, docker-compose.yml last changed in 2a7eaa8 (foundation), no causeflow-api/worker services exist; expected src/shared/config/index.ts to expose CAUSEFLOW_RUNTIME/isOss()/config.postgres per journal; observed grep for 'CAUSEFLOW_RUNTIME|isOss|config.postgres' returns 0 matches; evidence config/index.ts unchanged; expected main.ts to skip ensureTable()/seedDevTenants in OSS mode; observed src/main.ts still calls ensureTable() (line 26) and seedDevTenants() (line 43) unconditionally, which contact DynamoDB/AWS at boot; evidence main.ts unchanged from foundation; expected /health to return {"postgres":"ok","redis":"ok","anthropic":"ok","queues":"ok"}; observed src/app.ts /health runs ctx.healthChecker.runAll() over bootstrap-wired checks {dynamodb,redis,sqs,anthropic} (src/shared/infra/health/checks/ contains only dynamodb-check.ts, redis-check.ts, sqs-check.ts, anthropic-check.ts — no Postgres/OssAnthropic/Queues checks); evidence bootstrap.ts lines 86-88 wire DynamoDBHealthCheck/SQSHealthCheck; expected .env.example reduced to HINDSIGHT_* + optional ANTHROPIC_API_KEY only; observed `grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA' .env.example` = 29 forbidden matches (AWS_REGION, AWS_ACCESS_KEY_ID, STRIPE_SECRET_KEY, LANGFUSE_*, CLERK_* etc.); evidence .env.example unchanged; expected no AWS/Stripe/Clerk/etc. endpoint contacted at startup; observed with causeflow-api/worker services absent from compose the AC boot path is unrunnable, and the current src/main.ts+bootstrap.ts would contact AWS via ensureTable and SQS consumers; evidence grep of source confirms no OSS gating in main.ts/bootstrap.ts/app.ts/investigation-worker.ts
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-039-1-integration_qa.log
- NextAction: Repair Plan

## 2026-07-07T23:31:42.576Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-07T23:31:42.597Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07T23:41:17.737Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-039
- Defects: expected `docker compose up -d` to start causeflow-postgres, redis, hindsight, causeflow-api, causeflow-worker; observed main docker-compose.yml (tip a425e3e) defines 0 of causeflow-postgres/causeflow-api/causeflow-worker (`grep -c` = 0) and still ships the old AWS stack (ministack, langfuse, customer-* samples); evidence: main docker-compose.yml services list + `docker compose up -d` fails (samples/marketplace-platform not found), no causeflow-api service exists to serve :3099; expected /health to return {"postgres":"ok","redis":"ok","anthropic":"ok","queues":"ok"} from main's stack; observed the only :3099/health 200 is served by an orphan container from the gen worktree (label com.docker.compose.project.config_files=/home/vinicius/projects/causeflow-ai-wt-core-open-source-local-runtime/core/docker-compose.yml), not from main's compose; main's src/app.ts /health returns AWS shape {status,service,version,commit,timestamp,checks:{dynamodb,redis,sqs,anthropic}}; expected src/shared/config/index.ts to expose CAUSEFLOW_RUNTIME/isOss()/config.postgres and main.ts to skip ensureTable()/seedDevTenants in OSS mode; observed grep CAUSEFLOW_RUNTIME|isOss|config.postgres in config = 0 matches and main.ts still calls ensureTable() (line 26) and seedDevTenants() (line 43) unconditionally → AWS contact at boot; expected PostgresHealthCheck/OssAnthropicHealthCheck/QueuesHealthCheck and OSS bootstrap branch; observed src/shared/infra/health/checks/ contains only dynamodb-check.ts, redis-check.ts, sqs-check.ts, anthropic-check.ts and bootstrap.ts wires DynamoDBHealthCheck/SQSHealthCheck/SQSMessageQueue with no OSS branch; expected .env.example reduced to HINDSIGHT_* + optional ANTHROPIC_API_KEY; observed grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA' .env.example = 29 forbidden matches; evidence: .env.example unchanged from foundation; expected src/workers/investigation-worker.ts OSS standby mode; observed grep standby|isOss|CAUSEFLOW_RUNTIME = 0 matches — worker has no OSS gating
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-039-1-integration_qa.log
- NextAction: Repair Plan

## 2026-07-07T23:45:30.669Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-07T23:45:30.688Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:10:00Z — Integrated Verification (AC-039)

- Attempt: 1/3
- WorkItem: WI-AC-039
- AcceptanceChecks: AC-039
- Outcome: integration=false (defects — implementation not present in repo)
- NextAction: Implementation must actually be committed (current journal
  entries described work that was never applied to source).

### Independent verification against integrated main

Inspected the integrated `main` tip (commit `b009563`) and the working tree.
The merge only touched `feature_list.json` + the journal; no source files were
modified. Verified each claim of the prior "Implementation" entry against the
actual repo and found the OSS runtime was never implemented:

1. `docker-compose.yml` still defines the OLD AWS stack: `ministack`,
   `langfuse`, `postgres` (langfuse DB), `customer-postgres`, `payment-service`,
   `marketplace-*`, `notification-service`, `causeflow-relay`, `redis`,
   `hindsight`. `grep -c 'causeflow-postgres|causeflow-api|causeflow-worker'
   docker-compose.yml` → **0**. The five services AC-039 requires
   (`causeflow-postgres`, `redis`, `hindsight`, `causeflow-api`,
   `causeflow-worker`) are NOT all present, and there is no `causeflow-api`/
   `causeflow-worker` service at all. No `docker-compose.aws.yml` backup was
   created.
2. `src/shared/config/index.ts` has no `CAUSEFLOW_RUNTIME`, no `isOss()`,
   no `config.postgres` (grep → 0 matches).
3. `src/main.ts` still calls `ensureTable()` (line 26) and `seedDevTenants()`
   (line 43) unconditionally — both go through DynamoDB → AWS contact at boot.
4. `src/shared/infra/health/checks/` contains only `dynamodb-check.ts`,
   `redis-check.ts`, `sqs-check.ts`, `anthropic-check.ts`. There is no
   `PostgresHealthCheck`, no `OssAnthropicHealthCheck`, no `QueuesHealthCheck`.
5. `src/app.ts` `/health` returns the AWS shape
   (`{dynamodb, redis, sqs, anthropic}` per the per-service map), NOT the
   flat `{postgres, redis, anthropic, queues}` shape AC-039 requires.
6. `src/bootstrap.ts` still wires `DynamoDBHealthCheck`, `SQSHealthCheck`,
   `SQSMessageQueue`; no OSS branch.
7. `src/workers/investigation-worker.ts` has no OSS standby mode.
8. `.env.example` still carries `AWS_*`, `STRIPE_*`, `CLERK_*`, `LANGFUSE_*`,
   etc. (`grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA'
   .env.example` → 29) — not reduced to HINDSIGHT_* + ANTHROPIC_API_KEY.

Because the required `causeflow-api`/`causeflow-worker` services do not
exist in compose, AC-039's "`docker compose up -d` starts
`causeflow-postgres`, `redis`, `hindsight`, `causeflow-api` and
`causeflow-worker`" cannot be satisfied, and `curl http://localhost:3099/health`
has no API container to reach. The forbidden-endpoint guarantee is also
unsatisfiable: `ensureTable()`/SQS consumers contact AWS at boot in the
current code.

### Verdict

implementation=false (the OSS runtime described in the journal is absent
from source), qa=false (prior QA passed against an unimplemented state),
integration=false. `feature_list.json` WI-AC-039 updated to
`implementation:false, qa:false, integration:false, status:integration-failed`.

## 2026-07-08T00:35:00Z — Integrated Verification re-check (AC-039)

- Attempt: 1/3
- WorkItem: WI-AC-039
- AcceptanceChecks: AC-039
- Outcome: integration=false (defects persist on integrated main)
- NextAction: Implementation must be merged from gen branch into main

### Re-verification against integrated main tip (a425e3e)

Re-ran the AC-039 boundary check against the integrated `main` working tree
(`/home/vinicius/projects/causeflow-ai/core`, HEAD `a425e3e`). The OSS
implementation described in the earlier "Implementation" journal entry exists
ONLY on the unmerged `gen/core-open-source-local-runtime` worktree
(`/home/vinicius/projects/causeflow-ai-wt-core-open-source-local-runtime/core`);
the merge commit `a425e3e` resolved only a journal conflict and brought no
source changes into main.

Evidence (all on main, tip a425e3e):

1. `grep -c 'causeflow-postgres|causeflow-api|causeflow-worker'
   docker-compose.yml` → **0**. Main's compose still defines the OLD AWS stack
   (ministack, langfuse, postgres-for-langfuse, customer-* sample services,
   causeflow-relay, redis, hindsight). Only 2 of the 5 AC-required services
   (`redis`, `hindsight`) are present; `causeflow-postgres`, `causeflow-api`,
   `causeflow-worker` are absent. `docker compose up -d` from main fails
   (`samples/marketplace-platform` not found) and would not start an API.
2. `grep 'CAUSEFLOW_RUNTIME|isOss|config.postgres' src/shared/config/index.ts`
   → 0 matches — OSS runtime switch not present.
3. `src/main.ts` still calls `ensureTable()` (line 26) and `seedDevTenants()`
   (line 43) unconditionally → DynamoDB/AWS contact at boot.
4. `src/shared/infra/health/checks/` contains only `dynamodb-check.ts`,
   `redis-check.ts`, `sqs-check.ts`, `anthropic-check.ts` — no
   `PostgresHealthCheck` / `OssAnthropicHealthCheck` / `QueuesHealthCheck`.
   `bootstrap.ts` still wires `DynamoDBHealthCheck` + `SQSHealthCheck` +
   `SQSMessageQueue`; no OSS branch.
5. `src/app.ts` `/health` returns the AWS shape `{status, service, version,
   commit, timestamp, checks:{dynamodb,redis,sqs,anthropic}}`, NOT the flat
   `{postgres, redis, anthropic, queues}` shape AC-039 requires.
6. `src/workers/investigation-worker.ts` has no OSS standby mode
   (`grep standby|isOss|CAUSEFLOW_RUNTIME` → 0).
7. `grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA'
   .env.example` → **29** — not reduced to HINDSIGHT_* + ANTHROPIC_API_KEY.

A `curl http://localhost:3099/health` did return 200 with
`{"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}` — but
that response is served by an **orphan container from the gen worktree**
(label `com.docker.compose.project.config_files` =
`/home/vinicius/projects/causeflow-ai-wt-core-open-source-local-runtime/core/docker-compose.yml`),
NOT by anything main's compose started. Main's compose defines no `causeflow-api`
service, so against integrated main the AC boot path is unsatisfiable.

### Verdict

implementation=false (OSS runtime not on main), qa=false, integration=false.
`feature_list.json` WI-AC-039 remains
`implementation:false, qa:false, integration:false, status:integration-failed`.

### Conflict-resolution note (2026-07-08)

The gen branch's `2026-07-07T23:45:30Z — Resumed` / `Checkpoint ready`
entries (isolated QA passed) are preserved append-only. The newer defect
reports above (`2026-07-08T00:10:00Z` and `2026-07-08T00:35:00Z`, both
integration=false) override that older true flag per the Work Item rule.
Re-confirmed against current main tip `886a443`:
`grep -c 'causeflow-postgres|causeflow-api|causeflow-worker' docker-compose.yml`
→ 0; `grep -c 'CAUSEFLOW_RUNTIME|isOss|config.postgres' src/shared/config/index.ts`
→ 0; `ls src/shared/infra/health/checks/` → only dynamodb/redis/sqs/anthropic;
`grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA'
.env.example` → 29. The OSS runtime is absent from integrated main, so
AC-039 is not satisfiable. `feature_list.json` WI-AC-039 stays
`implementation:false, qa:false, integration:false, status:integration-failed`.

## 2026-07-07T20:55:00Z — Integrated Verification (AC-039)

- Attempt: 1/3
- WorkItem: WI-AC-039
- AcceptanceChecks: AC-039
- Outcome: integration=false (OSS runtime still absent from integrated main)
- NextAction: Implementation must be merged from gen branch into main (the
  merge commit `7711a9e` only touched the journal + relay files; no source
  changes reached `core`).

### Independent verification against integrated main tip (7711a9e)

Re-ran the AC-039 boundary against the integrated `main` working tree
(`/home/vinicius/projects/causeflow-ai/core`, HEAD `7711a9e`). The merge
commit `7711a9e` ("merge(harness): resolve WI-039 journal conflict") changed
only `core/harness-progress/open-source-local-runtime.md` + `relay/` files
(`git show --stat 7711a9e`); no `src/`, `docker-compose.yml`, or
`.env.example` changes were brought into main.

Evidence (all on main, tip 7711a9e):

1. `docker compose config --services` (main's docker-compose.yml) lists
   `ministack, order-*, billing-*, causeflow-relay, postgres, langfuse,
   marketplace-*, redis, customer-postgres, hindsight, notification-service,
   payment-service` — **NONE** of `causeflow-postgres` / `causeflow-api` /
   `causeflow-worker` (grep -c = 0). The 5 AC-required services are not all
   present; `causeflow-api` and `causeflow-worker` do not exist as compose
   services at all. No `docker-compose.aws.yml` backup exists.
2. `grep -c 'CAUSEFLOW_RUNTIME|isOss|config\.postgres' src/shared/config/index.ts`
   → 0 — OSS runtime switch not present.
3. `src/main.ts` still calls `ensureTable()` (line 26) and `seedDevTenants()`
   (line 43) unconditionally → DynamoDB/AWS contact at boot.
4. `src/shared/infra/health/checks/` contains only `anthropic-check.ts,
   dynamodb-check.ts, redis-check.ts, sqs-check.ts` — no
   `PostgresHealthCheck` / `OssAnthropicHealthCheck` / `QueuesHealthCheck`.
   `grep -n 'isOss|CAUSEFLOW_RUNTIME|PostgresHealthCheck|OssAnthropic|QueuesHealthCheck'
   src/bootstrap.ts` → no matches; no OSS branch.
5. `src/app.ts` `/health` returns the AWS per-service map
   `{dynamodb, redis, sqs, anthropic}`, NOT the flat `{postgres, redis,
   anthropic, queues}` shape AC-039 requires.
6. `grep -n 'standby|isOss|CAUSEFLOW_RUNTIME' src/workers/investigation-worker.ts`
   → 0 matches — worker has no OSS standby mode.
7. `grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA'
   .env.example` → 29 — not reduced to HINDSIGHT_* + ANTHROPIC_API_KEY.

A `curl http://localhost:3099/health` does return 200 with
`{"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}`, but
that response is served by an **orphan container from the gen worktree**
(`/home/vinicius/projects/causeflow-ai-wt-core-open-source-local-runtime/core/docker-compose.yml`),
not by anything main's compose started. Confirmed via
`docker inspect core-causeflow-api-1 --format 'config_files={{ index .Config.Labels "com.docker.compose.project.config_files" }}'`
→ `.../causeflow-ai-wt-core-open-source-local-runtime/core/docker-compose.yml`
(the gen worktree shares the `core` dir-name, so its containers get the same
`core-` prefix). Main's own compose defines no `causeflow-api`/`causeflow-worker`/
`causeflow-postgres` services, so AC-039's "`docker compose up -d` starts
causeflow-postgres, redis, hindsight, causeflow-api and causeflow-worker" is
unsatisfiable on integrated main, and the forbidden-endpoint guarantee is
also unsatisfiable (`ensureTable()`/SQS consumers contact AWS at boot in
the current code).

### Verdict

implementation=false (OSS runtime not on main), qa=false, integration=false.
`feature_list.json` WI-AC-039 already records
`implementation:false, qa:false, integration:false, status:integration-failed`.

## 2026-07-07T23:55:15.669Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-039
- Defects: expected `docker compose up -d` to start causeflow-postgres, redis, hindsight, causeflow-api, causeflow-worker; observed main docker-compose.yml (tip 7711a9e) defines 0 of causeflow-postgres/causeflow-api/causeflow-worker (grep -c = 0) and ships the old AWS stack (ministack, langfuse, customer-* samples, causeflow-relay) per `docker compose config --services`; evidence merge 7711a9e only touched journal + relay files (git show --stat), no causeflow-api/worker services exist on main; expected curl http://localhost:3099/health from main's stack to return {postgres,redis,anthropic,queues}; observed the only :3099 200 ({"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}) is served by an orphan container from the gen worktree — `docker inspect core-causeflow-api-1` labels com.docker.compose.project.config_files=/home/vinicius/projects/causeflow-ai-wt-core-open-source-local-runtime/core/docker-compose.yml; main's compose defines no causeflow-api service; expected src/shared/config/index.ts to expose CAUSEFLOW_RUNTIME/isOss()/config.postgres and src/main.ts to skip ensureTable()/seedDevTenants() in OSS mode; observed grep CAUSEFLOW_RUNTIME|isOss|config.postgres in config = 0 matches and main.ts still calls ensureTable() (line 26) and seedDevTenants() (line 43) unconditionally → AWS/DynamoDB contact at boot; evidence source grep on main tip 7711a9e; expected PostgresHealthCheck/OssAnthropicHealthCheck/QueuesHealthCheck and an OSS bootstrap branch; observed src/shared/infra/health/checks/ contains only dynamodb-check.ts, redis-check.ts, sqs-check.ts, anthropic-check.ts and bootstrap.ts has no isOss/CAUSEFLOW_RUNTIME/PostgresHealthCheck matches; app.ts /health returns AWS shape {dynamodb,redis,sqs,anthropic} not {postgres,redis,anthropic,queues}; expected .env.example reduced to HINDSIGHT_* + optional ANTHROPIC_API_KEY only; observed grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA' .env.example = 29 forbidden matches; evidence .env.example unchanged from foundation; expected src/workers/investigation-worker.ts OSS standby mode; observed grep standby|isOss|CAUSEFLOW_RUNTIME = 0 matches — worker has no OSS gating
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-039-1-integration_qa.log
- NextAction: Repair Plan
## 2026-07-07T23:55:16.210Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-07T23:55:16.229Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:00:29.233Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T00:00:29.254Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:31:34.207Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T00:31:34.241Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:02:38.720Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T01:02:38.740Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

### Conflict-resolution note (2026-07-08, append-only merge)

This merge resolved the journal conflict in `harness-progress/open-source-local-runtime.md`
append-only: both the HEAD (main) and `gen/core-open-source-local-runtime`
journal entries are preserved verbatim. The gen branch's `Resumed` /
`Checkpoint ready` entries record isolated-QA-passed true flags; the newer
HEAD Defect Reports (`2026-07-08T00:10:00Z` and `2026-07-08T00:35:00Z`, both
`integration=false`) override those older true flags per the Work Item rule
("a newer Defect Report overrides older true flags").

Re-confirmed against current integrated main tip (`9b325ab`):
- `grep -c 'causeflow-postgres|causeflow-api|causeflow-worker' docker-compose.yml`
  → 0 (main's compose still defines the old AWS stack: ministack, langfuse,
  customer-* samples, causeflow-relay, redis, hindsight; the 5 AC-required
  services are not all present and `causeflow-api`/`causeflow-worker` do not
  exist as compose services).
- `grep -c 'CAUSEFLOW_RUNTIME|isOss|config\.postgres' src/shared/config/index.ts`
  → 0 — OSS runtime switch absent.
- `src/main.ts` still calls `ensureTable()` (line 26) and `seedDevTenants()`
  (line 43) unconditionally → DynamoDB/AWS contact at boot.
- `ls src/shared/infra/health/checks/` → only `anthropic-check.ts`,
  `dynamodb-check.ts`, `redis-check.ts`, `sqs-check.ts` — no
  `PostgresHealthCheck` / `OssAnthropicHealthCheck` / `QueuesHealthCheck`.
- `grep -c 'standby|isOss|CAUSEFLOW_RUNTIME' src/workers/investigation-worker.ts`
  → 0 — worker has no OSS standby mode.
- `grep -icE 'AWS_|STRIPE|CLERK|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|MASTRA'
  .env.example` → 29 — not reduced to HINDSIGHT_* + ANTHROPIC_API_KEY.

### Verdict

implementation=false (OSS runtime absent from integrated main), qa=false,
integration=false. The AC-039 boot path (`docker compose up -d` starts
`causeflow-postgres`, `redis`, `hindsight`, `causeflow-api`, `causeflow-worker`
and `curl http://localhost:3099/health` returns 200 with
`{"postgres":"ok","redis":"ok","anthropic":"ok","queues":"ok"}`) is not
satisfiable on integrated main. No source/conflict was modified beyond the
journal; resolving this conflict does not implement AC-039 — the Work Item
remains `implementation:false, qa:false, integration:false,
status:integration-failed` pending the actual OSS runtime being merged into
main.
