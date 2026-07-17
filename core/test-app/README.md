# CauseFlow Test Application (AC-058)

Runnable mock HTTP service that dashboard users connect as an integration target on the OSS local stack. This is a **real upstream application** — not a dashboard route mock or Playwright fixture. Web golden-path E2E (web AC-058/AC-060/AC-061) and Core harness scripts exercise these endpoints.

## Quick start

### Docker Compose (recommended)

From the Core repo root:

```bash
docker compose up -d causeflow-test-app
curl http://127.0.0.1:5190/health
```

The service is included in the main `docker-compose.yml` as `causeflow-test-app` on port **5190**.

### Host dev

```bash
# Terminal 1 — test application (default :5190)
TEST_APP_PORT=5190 node test-app/server.mjs

# Terminal 2 — Core API
PORT=5171 pnpm dev
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness (`service: causeflow-test-app`) |
| GET | `/v1/state` | Deterministic state (connections, probe/ingest/tool counts) |
| GET | `/v1/tools` | List investigation tools with deterministic responses |
| POST | `/v1/connect` | Register tenant ↔ Core mapping |
| POST | `/v1/probe` | Return deterministic probe evidence |
| POST | `/v1/tools/call` | Answer investigation tool calls with deterministic evidence |
| POST | `/v1/alerts/emit` | Sign + POST Datadog-shaped webhook to Core ingest |

### Investigation tools (`POST /v1/tools/call`)

Body:

```json
{
  "tenantId": "<tenant-id>",
  "tool": "query_logs",
  "input": { "service": "order-service" }
}
```

Available tools: `query_logs`, `query_metrics`, `get_deployments`, `get_service_health`. Each returns structured output plus an `evidence` object with `source: causeflow-test-app` for root-cause grounding.

## Core integration API

Core exposes authenticated routes that orchestrate this test application via the stub connector (AC-056):

- `POST /v1/integrations/stub/connect` — records tenant integration + registers on test app
- `POST /v1/integrations/stub/probe` — probes test app; updates `lastHealthCheck`
- `POST /v1/integrations/stub/ingest` — triggers test app to emit a signed webhook into Core

Configure Core with:

```env
STUB_UPSTREAM_BASE_URL=http://127.0.0.1:5190
STUB_UPSTREAM_CORE_BASE_URL=http://127.0.0.1:5171
```

Inside docker compose, Core uses `http://causeflow-test-app:5190` automatically.

## Verification

```bash
PORT=5171 TEST_APP_PORT=5190 bash .harness/ac058-verify.sh
```

## Root AC-025 / AC-026 harness QA gate

The monorepo-root Completion Contract uses a single documented browser probe
as the harness QA gate for AC-025 (see root `README.md` → “OSS golden-path QA
gate”). From the repo root with Core, dashboard, this test app, and Ornith up:

```bash
pnpm --dir web verify:ac025
# or: node web/scripts/ac-025-browser-probe.mjs
```

Core's complementary verify script for the same product loop is `pnpm verify:ac061`
below. Either gate exiting 0 on the local OSS stack with Ornith available
satisfies root AC-026 when documented as above.

## AC-061 delivery gate (dashboard golden path)

Core's harness QA / Goal Review entry point for the full product loop.
It boots this test app, connects the stub integration, selects Ornith
(or DeepSeek fallback), ingests an incident, then asserts triage severity,
incident chat completion, root-cause, and remediation artifacts in both
Postgres and the HTTP API.

```bash
# Prerequisites: compose Postgres/Redis up, Core + worker healthy, Ornith on :8081
PORT=5170 ./init.sh
PORT=5170 TEST_APP_PORT=5193 pnpm verify:ac061
# equivalent:
PORT=5170 TEST_APP_PORT=5193 bash .harness/ac061-verify.sh
```

Web AC-061 depends on this Core contract. Goal Review for Core after the
OSS LLM ACs must not pass without `.harness/ac061-verify.sh` evidence.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_APP_PORT` | `5190` | Listen port (`STUB_UPSTREAM_PORT` alias) |
| `TEST_APP_HOST` | `127.0.0.1` | Bind address (`STUB_UPSTREAM_HOST` alias) |

## Backward compatibility

`stub-upstream/server.mjs` delegates to this application so AC-056/AC-057 harness scripts keep working unchanged.
