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

## Further reading

- Platform navigation index: [`docs/00-index.md`](./docs/00-index.md)
- Local environment details: [`docs/10-local-environment.md`](./docs/10-local-environment.md)
- Relay integration: [`docs/13-relay-integration.md`](./docs/13-relay-integration.md)
