# CauseFlow Test Application (AC-058)

Runnable mock HTTP service that dashboard users connect as an integration target on the OSS local stack. This is a **real upstream application** — not a dashboard route mock or Playwright fixture. Web golden-path E2E (web AC-058/AC-060) and Core harness scripts exercise these endpoints.

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

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_APP_PORT` | `5190` | Listen port (`STUB_UPSTREAM_PORT` alias) |
| `TEST_APP_HOST` | `127.0.0.1` | Bind address (`STUB_UPSTREAM_HOST` alias) |

## Backward compatibility

`stub-upstream/server.mjs` delegates to this application so AC-056/AC-057 harness scripts keep working unchanged.
