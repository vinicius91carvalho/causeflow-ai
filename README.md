# CauseFlow

CauseFlow is an AI-powered incident investigation platform for Engineering and Customer Support teams.
This repository is the CauseFlow monorepo: Core API, marketing website, authenticated dashboard, public docs, and optional relay agent live side by side under one root.

## Monorepo layout

| Path | Role |
|------|------|
| [`core/`](./core/) | Control-plane API, worker, and OSS investigation runtime |
| [`web/`](./web/) | Marketing website + authenticated dashboard (pnpm / Turborepo / Next.js) |
| [`public-docs/`](./public-docs/) | Public Mintlify product and API documentation |
| [`relay/`](./relay/) | Optional customer-network read-only database relay agent |
| [`docs/`](./docs/) | Deep technical documentation for the platform |

Project READMEs:

- [Core README](./core/README.md)
- [Web README](./web/README.md)
- [Public docs README](./public-docs/README.md)
- [Relay README](./relay/README.md)

Technical doc index: [`docs/00-index.md`](./docs/00-index.md)

## Quickstart

Prerequisites: Docker Engine and the Docker Compose plugin.

From the monorepo root:

```bash
./init.sh
```

`./init.sh` is fail-closed: it checks Docker, starts the umbrella `docker-compose.yml` stack, waits until services are ready, prints the local URL matrix, and exits 0.
It does **not** start the relay.
Relay remains optional — see [`relay/README.md`](./relay/README.md) and `relay/init.sh`.

Fail-closed edge cases (no `Ready` on failure):

- Missing Docker / Compose plugin: exits non-zero with an install hint (`https://docs.docker.com/get-docker/`) before any `docker compose up`.
- Required ports already in use (`3000`, `3001`, `3099`, `5181`) by a non-umbrella listener: exits non-zero listing the conflicting ports.
- Partial compose failure: exits non-zero, prints `docker compose ps` and recent logs, and never prints `Ready`.

### Reclaim conflicting ports

```bash
# Stop umbrella app containers that may still hold binds
docker compose -f docker-compose.yml rm -sf causeflow-website causeflow-dashboard causeflow-api causeflow-docs

# If a standalone Core stack still owns :3099
docker compose -f core/docker-compose.yml stop causeflow-api
docker compose -f core/docker-compose.yml down

# Inspect who is listening
ss -tlnp | grep -E ':(3000|3001|3099|5181)\b'
```

## Local URLs

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Dashboard | http://localhost:3001 |
| Core API | http://localhost:3099 |
| Docs (local compose) | http://localhost:5181 |

### API health

```bash
curl http://localhost:3099/health
```

Dashboard readiness check used by `./init.sh`: http://localhost:3001/auth/sign-in

## Published docs (GitHub Pages)

Public documentation is published at:

https://vinicius91carvalho.github.io/causeflow-ai/

Local docs from the umbrella stack remain on http://localhost:5181.

## OSS golden-path QA gate (AC-025 / AC-026)

The single harness QA gate for root **AC-025** (local-auth golden path with Ornith + Test Application) is the Playwright Chromium browser probe:

```bash
# Prerequisites: Core + worker, dashboard BFF, causeflow-test-app :5190, Ornith :8081
# (reuse healthy postgres/redis/hindsight; host-dev Core is typical for harness PORT worktrees)

OSS_DASHBOARD_URL=http://127.0.0.1:3001 \
OSS_CORE_API_URL=http://127.0.0.1:5171 \
OSS_TEST_APP_URL=http://127.0.0.1:5190 \
  node web/scripts/ac-025-browser-probe.mjs
# symlink: node .harness/wi-ac-025-browser-probe.mjs
# package script (from web/): pnpm verify:ac025
```

Exit **0** means the full AC-025 flow passed at a real browser boundary (no Clerk, no `page.route` mocks of integrations/incidents).

Equivalent documented gates that cover the same product loop:

| Gate | Command |
|------|---------|
| Playwright project `dashboard-oss-e2e` | `cd web && pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-061-capstone.spec.ts` |
| Core verify script | `cd core && pnpm verify:ac061` |

## Further reading

- Platform navigation index: [`docs/00-index.md`](./docs/00-index.md)
- Local environment details: [`docs/10-local-environment.md`](./docs/10-local-environment.md)
- Relay integration: [`docs/13-relay-integration.md`](./docs/13-relay-integration.md)
