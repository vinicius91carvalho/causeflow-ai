# Deployment Overview

CauseFlow AI now ships the website and dashboard as plain Next.js Docker
services. The OSS runtime can be launched locally with Docker Compose; hosted
environments build and deploy the same Dockerfiles through GitHub Actions.

---

## Local OSS Runtime

From the `web/` repo root:

```bash
docker compose up -d
```

This starts:

| Service | URL |
|---|---|
| Website | `http://localhost:3000` |
| Dashboard | `http://localhost:3001` |
| Core API | `http://localhost:3099` |
| Hindsight | `http://localhost:8888` |

The compose file expects the Core repo at `../core`. Override that with:

```bash
CORE_CONTEXT=/abs/path/to/core docker compose up -d
```

---

## App Images

| App | Dockerfile |
|---|---|
| Website | `apps/website/Dockerfile` |
| Dashboard | `apps/dashboard/Dockerfile` |

Build only the web app images:

```bash
docker compose build causeflow-website causeflow-dashboard
```

---

## Environment Variables

The OSS runtime does not require Clerk, Stripe, AWS, Sentry, Loops.so, or SST
variables. Required local values are provided by the compose defaults:

| Variable | Used by | Purpose |
|---|---|---|
| `CORE_API_URL` | Dashboard | Core API base URL inside the compose network |
| `JWT_SECRET` | Dashboard + Core | Local JWT signing/verification secret |
| `CAUSEFLOW_RUNTIME=oss` | Dashboard + Core | Enables OSS auth and stub billing behavior |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE=development` | Website + Dashboard | Disables staging-only protections |

Optional analytics variables can be left blank:

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_CLARITY_ID`

---

## Hosted Environments

Hosted production/staging deployments are CI-owned. Do not deploy manually from
a developer machine. The workflows in `.github/workflows/` build, validate, and
publish the website and dashboard containers.

| Environment | Website | Dashboard |
|---|---|---|
| Production | `https://causeflow.ai` | `https://dashboard.causeflow.ai` |
| Staging | `https://staging.causeflow.ai` | `https://dashboard-staging.causeflow.ai` |
