# CauseFlow AI Dashboard

AI-powered incident investigation dashboard for engineering teams.

**Production URL:** https://dashboard.causeflow.ai  
**Staging URL:** https://dashboard-staging.causeflow.ai

---

## Getting Started

### Full OSS Runtime

From the `web/` repo root:

```bash
docker compose up -d
```

This starts the dashboard at `http://localhost:3001`, the website at
`http://localhost:3000`, and the Core API at `http://localhost:3099`. The
compose file expects Core at `../core`; override with
`CORE_CONTEXT=/abs/path/to/core` when needed.

The OSS runtime uses local JWT auth and stub billing. It does not require
Clerk, Stripe, AWS, Sentry, Loops.so, or SST variables.

### Local App Dev

```bash
pnpm install
cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm --filter @causeflow/dashboard dev
```

The app opens at `http://127.0.0.1:3001`. Leave `CORE_API_URL` blank in
non-Docker local dev to use the mock Core API client, or set it to
`http://localhost:3099` when Core is running locally.

### Run Tests

```bash
pnpm turbo test --filter=@causeflow/dashboard...
pnpm --filter @causeflow/dashboard test:watch
pnpm vitest run --project dashboard --coverage
```

---

## Architecture Overview

```
apps/dashboard/
├── src/
│   ├── app/
│   │   ├── [locale]/          # i18n-aware pages
│   │   └── api/               # Next.js API route handlers / BFF proxies
│   ├── contexts/              # DDD bounded contexts
│   ├── lib/
│   │   ├── api/               # Core API client, mock client, auth wrapper
│   │   ├── auth/              # Local session helpers
│   │   └── logger.ts          # Pino logger
│   └── middleware.ts          # Local JWT auth, profile guard, i18n
├── .env.example               # OSS local environment reference
├── Dockerfile                 # Multi-stage Next.js runtime image
└── next.config.mjs            # Next.js config
```

### Key Packages

| Package | Purpose |
|---------|---------|
| `packages/shared` | i18n messages, shared types, constants |
| `packages/ui` | Design system components |
| `packages/analytics` | GA4 + Microsoft Clarity tracking |
| `packages/auth` | Legacy Auth.js/Cognito helpers still available to imports |

### Authentication Flow

In OSS mode:

```text
User -> /auth/sign-in -> POST /api/auth/login -> Core /v1/auth/login
     -> Core signs local JWT -> dashboard stores __session cookie
     -> middleware + withAuth verify session through Core /v1/auth/me
```

Hosted deployments may still use Clerk-backed Core tokens, but the dashboard no
longer owns Cognito, DynamoDB, or KMS infrastructure.

### Data Ownership

The dashboard does not own persisted product data. It calls the Core API for
tenants, users, incidents, remediations, integrations, billing state, audit
entries, LLM connector settings, and onboarding state. In local dev, a blank
`CORE_API_URL` falls through to the mock Core API client.

---

## Environment Variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Description |
|----------|-------------|
| `CORE_API_URL` | Core API base URL. Docker uses `http://causeflow-api:5171`; non-Docker local dev can leave it blank for mock mode. |
| `JWT_SECRET` | Local JWT secret shared with Core. |
| `CAUSEFLOW_RUNTIME` | Set to `oss` for OSS auth and stub billing behavior. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional analytics ID. |
| `NEXT_PUBLIC_CLARITY_ID` | Optional analytics ID. |

---

## Deployment

The dashboard ships as a Docker image built from `apps/dashboard/Dockerfile`.
Hosted deployments are CI-owned through `.github/workflows/dashboard-deploy.yml`;
do not deploy manually from a developer machine.
