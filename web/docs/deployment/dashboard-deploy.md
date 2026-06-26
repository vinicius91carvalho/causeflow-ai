# Dashboard Deployment (CI/CD)

CI/CD for the dashboard app is managed by the GitHub Actions workflow at `.github/workflows/dashboard-deploy.yml`.

---

## Triggers

| Event | Behavior |
|---|---|
| Push to `main` | Automatically deploys to staging |
| Manual dispatch (`workflow_dispatch`) | Deploys to staging or production (user selects stage) |

Production deployments are always manual — they can never be triggered automatically.

---

## Concurrency

```yaml
concurrency:
  group: dashboard-deploy-${{ github.ref }}
  cancel-in-progress: false
```

Deploys are serialized per branch. A queued deploy waits for the in-progress deploy to finish rather than being cancelled.

---

## Jobs

### Job 1: Build and Validate

Runs on every trigger before any deployment proceeds.

Steps:
1. Checkout repository
2. Set up pnpm and Node.js
3. Install dependencies: `pnpm install --frozen-lockfile`
4. Type-check: `pnpm turbo check-types --filter=dashboard...`
5. Lint: `pnpm exec biome check .`
6. Run tests: `pnpm turbo test --filter=dashboard...`
7. Build: `pnpm turbo build --filter=dashboard...`

The build step requires auth and AWS environment variables. In CI these are set as placeholder values to satisfy the build without requiring real credentials:

| Variable | CI Value | Purpose |
|---|---|---|
| `AUTH_SECRET` | placeholder string | Auth.js session signing |
| `AUTH_COGNITO_ISSUER` | placeholder URL | Cognito OIDC discovery |
| `AUTH_COGNITO_CLIENT_ID` | placeholder | Cognito app client ID |
| `AUTH_COGNITO_CLIENT_SECRET` | placeholder | Cognito app client secret |
| `NEXTAUTH_URL` | `http://localhost:3001` | Auth callback base URL |
| `AWS_REGION` | `us-east-2` | AWS SDK region |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | GitHub vars | Google Analytics 4 |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | GitHub vars | Microsoft Clarity |

Vitest tests for the dashboard have a 15-second timeout due to heavy AWS SDK imports during module initialization.

### Job 2: Deploy Staging

Runs after Job 1 passes. Deploys the dashboard to the `staging` stage.

Steps:
1. Assume AWS role via OIDC
2. Install SST
3. Deploy: `(cd apps/dashboard && sst deploy --stage staging)`

Real environment variables (auth secrets, Cognito credentials, KMS key ARNs) are injected at deploy time by SST from values stored in AWS SSM Parameter Store or hardcoded in `sst.config.ts`. They are never stored as GitHub secrets that get written to `.env` files.

### Job 3: Deploy Production

Only runs on manual dispatch with stage set to `production`. Requires Job 2 to have succeeded first.

Steps:
1. Assume AWS role via OIDC
2. Install SST
3. Deploy: `(cd apps/dashboard && sst deploy --stage production)`

---

## Environment Variables (injected at deploy time by SST)

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Auth.js v5 session signing secret |
| `AUTH_COGNITO_ISSUER` | Cognito User Pool OIDC issuer URL |
| `AUTH_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `AUTH_COGNITO_CLIENT_SECRET` | Cognito App Client secret |
| `NEXTAUTH_URL` | Base URL for Auth.js callbacks (set per stage) |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name (set per stage) |
| `KMS_KEY_ARN` | KMS key ARN for DynamoDB encryption |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Microsoft Clarity |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | `staging` or `production` |
| `NEXT_PUBLIC_STAGING_PASSWORD` | Staging password gate (staging only) |

---

## AWS Resources (provisioned by SST)

### Authentication

| Resource | Details |
|---|---|
| Cognito User Pool | User directory with password policy, MFA optional |
| Cognito App Client | OAuth 2.0 client for Auth.js OIDC integration |

### Database

| Resource | Details |
|---|---|
| DynamoDB table | Single-table design, PAY_PER_REQUEST billing |
| KMS key | Customer-managed key for DynamoDB encryption at rest |

### Compute and CDN

| Resource | Details |
|---|---|
| Lambda functions | SSR handlers for Next.js App Router pages |
| CloudFront distribution | CDN with Lambda@Edge or Function URLs as origin |
| ACM certificate | SSL cert per stage, auto-renewed |

### Security and Observability

| Resource | Details |
|---|---|
| WAF WebACL | Rate limiting + managed bot protection rules; attached to CloudFront in `us-east-1` |
| CloudWatch Alarm — Lambda errors | Alerts on elevated Lambda error rate |
| CloudWatch Alarm — DynamoDB throttles | Alerts on read/write throttle events |
| CloudWatch Alarm — 5xx responses | Alerts on elevated HTTP 5xx from CloudFront |

### DNS

| Resource | Details |
|---|---|
| Route 53 records | A/AAAA alias records for `dashboard.causeflow.ai` and `dashboard-staging.causeflow.ai` |

---

## Removal Policy

| Stage | Policy |
|---|---|
| `staging` | `remove` — all resources destroyed on `sst remove --stage staging` |
| `production` | `retain` — resources (DynamoDB, Cognito, KMS) persist to prevent data loss |

The retain policy is critical for production: DynamoDB tables and Cognito User Pools contain live user data and must never be destroyed during a routine infrastructure update.

---

## Staging Authentication

The staging dashboard is protected by a password gate:

- Password: `causeflow-staging-2026` (set in `apps/dashboard/sst.config.ts`)
- Implemented in: `packages/shared/src/infrastructure/middleware/staging-auth.ts`
- Activated when: `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'` and `NEXT_PUBLIC_STAGING_PASSWORD` is set
- Authorization is cookie-based (`staging-authorized:<base64-password>`)
- Bypasses: `/staging-auth`, `/_next/*`, `/api/*`, static assets

Playwright tests running against `dashboard-staging.causeflow.ai` automatically inject the staging cookie via `extraHTTPHeaders` before each test.
