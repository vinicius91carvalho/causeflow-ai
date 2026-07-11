# Stub Upstream (OSS Connector Simulator)

Documented mock upstream application for CauseFlow OSS integration connect, probe, and ingest flows (AC-056). This is a **real HTTP service** — not a dashboard route mock. Web dashboard E2E (web AC-055) and Core harness scripts exercise these endpoints.

## Quick start

```bash
# Terminal 1 — stub upstream (default :5190)
STUB_UPSTREAM_PORT=5190 node stub-upstream/server.mjs

# Terminal 2 — Core API (see init.sh / docker compose)
PORT=5171 pnpm dev
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/v1/state` | Deterministic state (connections, probe/ingest counts) |
| POST | `/v1/connect` | Register tenant ↔ Core mapping |
| POST | `/v1/probe` | Return deterministic probe evidence |
| POST | `/v1/alerts/emit` | Sign + POST Datadog-shaped webhook to Core ingest |

## Core integration API (OSS only)

Core exposes authenticated routes that orchestrate the stub upstream:

- `POST /v1/integrations/stub/connect` — records tenant integration in Postgres + registers on stub upstream
- `POST /v1/integrations/stub/probe` — probes stub upstream; updates `lastHealthCheck`
- `POST /v1/integrations/stub/ingest` — triggers stub to emit a signed webhook into Core

Configure Core with:

```env
STUB_UPSTREAM_BASE_URL=http://127.0.0.1:5190
STUB_UPSTREAM_CORE_BASE_URL=http://127.0.0.1:5171
```

## Verification

```bash
PORT=5171 STUB_UPSTREAM_PORT=5190 bash .harness/ac056-verify.sh
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `STUB_UPSTREAM_PORT` | `5190` | Listen port |
| `STUB_UPSTREAM_HOST` | `127.0.0.1` | Bind address |
