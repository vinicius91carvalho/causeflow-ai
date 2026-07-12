# Website Deployment (CI/CD)

CI/CD for the website app is managed by
`.github/workflows/website-deploy.yml`.

---

## Build

The website ships as a Docker image built from `apps/website/Dockerfile`.

Local image build:

```bash
docker compose build causeflow-website
```

The CI workflow runs the normal validation steps before publishing/deploying:

1. Install dependencies with pnpm.
2. Type-check the website.
3. Run Biome.
4. Run website tests.
5. Build the website app/image.

---

## Runtime Environment

The OSS website does not require Clerk, Stripe, AWS, Sentry, Loops.so, or SST
variables.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_DASHBOARD_URL` | Dashboard URL used by redirects and CTAs. |
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
| Staging | `https://staging.causeflow.ai` |
| Production | `https://causeflow.ai` |

---

## Staging Authentication

The staging password gate is controlled by `NEXT_PUBLIC_DEPLOYMENT_STAGE` and
the shared staging auth middleware. It bypasses static assets, `/_next/*`, and
`/staging-auth`.
