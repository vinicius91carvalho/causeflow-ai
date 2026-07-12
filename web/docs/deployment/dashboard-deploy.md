# Dashboard Deployment (CI/CD)

CI/CD for the dashboard app is managed by
`.github/workflows/dashboard-deploy.yml`.

---

## Build

The dashboard ships as a Docker image built from
`apps/dashboard/Dockerfile`.

Local image build:

```bash
docker compose build causeflow-dashboard
```

The CI workflow runs the normal validation steps before publishing/deploying:

1. Install dependencies with pnpm.
2. Type-check the dashboard.
3. Run Biome.
4. Run dashboard tests.
5. Build the dashboard app/image.

---

## Runtime Environment

The OSS dashboard does not require Clerk, Cognito, DynamoDB, KMS, Stripe, AWS,
Sentry, Loops.so, or SST variables.

| Variable | Purpose |
|---|---|
| `CORE_API_URL` | Core API base URL. Docker uses `http://causeflow-api:5171`. |
| `JWT_SECRET` | Local JWT secret shared with Core. |
| `CAUSEFLOW_RUNTIME=oss` | Enables OSS auth and stub billing behavior. |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | `development`, `staging`, or `production`. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional analytics ID. |
| `NEXT_PUBLIC_CLARITY_ID` | Optional analytics ID. |

---

## Hosted Deployments

Hosted deployments are CI-owned. Do not deploy manually from a developer
machine. Production deployments should remain manually approved in GitHub
Actions.

| Environment | URL |
|---|---|
| Staging | `https://dashboard-staging.causeflow.ai` |
| Production | `https://dashboard.causeflow.ai` |

---

## Staging Authentication

The staging password gate is controlled by `NEXT_PUBLIC_DEPLOYMENT_STAGE` and
the shared staging auth middleware. It bypasses static assets, `/_next/*`,
`/api/*`, and `/staging-auth`.
