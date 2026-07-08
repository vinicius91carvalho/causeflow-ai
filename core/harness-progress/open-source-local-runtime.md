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

## 2026-07-08T01:12:28.093Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T01:12:28.113Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:24:30.012Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T01:24:30.032Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:55:32.794Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T01:55:32.817Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T02:18:38.314Z — Resumed

- WorkItem: WI-AC-039
- PreviousPhase: integration_qa
- Attempt: 1
- NextAction: integration-qa

## 2026-07-08T02:18:38.334Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-039
- Outcome: isolated QA passed
- NextAction: Integrated Verification
