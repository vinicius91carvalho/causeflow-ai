# CauseFlow AI Dashboard

AI-powered incident investigation dashboard for engineering teams.

**Production URL:** https://dashboard.causeflow.ai  
**Staging URL:** https://dashboard-staging.causeflow.ai

---

## Getting Started (Local Dev)

### Prerequisites

- Node.js >= 20 (see `.nvmrc` at project root)
- pnpm >= 9
- AWS credentials with access to the staging Cognito/DynamoDB/KMS resources

### Setup

```bash
# From project root
pnpm install

# Copy environment variables
cp apps/dashboard/.env.example apps/dashboard/.env.local
# Fill in AUTH_SECRET, AUTH_COGNITO_ID, AUTH_COGNITO_SECRET, AUTH_COGNITO_ISSUER
# from the SST staging deploy outputs.
```

### Run dev server

```bash
# Kill any existing Next.js servers first
pkill -f "next-server|next dev" 2>/dev/null

# Start dashboard only
pnpm --filter @causeflow/dashboard dev
# Opens at http://127.0.0.1:3001

# Or start all apps at once
pnpm turbo dev
```

### Run tests

```bash
# All dashboard tests
pnpm turbo test --filter=@causeflow/dashboard...

# Watch mode
pnpm --filter @causeflow/dashboard test:watch

# With coverage
pnpm vitest run --project dashboard --coverage
```

---

## Architecture Overview

```
apps/dashboard/
├── src/
│   ├── app/
│   │   ├── [locale]/          # i18n-aware page routes (next-intl)
│   │   │   ├── auth/          # Sign-in, sign-up, verify, forgot password
│   │   │   ├── onboarding/    # Profile setup, first integration, welcome
│   │   │   └── dashboard/     # Main app: analyses, integrations, team, settings
│   │   └── api/               # API Route Handlers (Next.js)
│   │       ├── health/        # GET /api/health — health check
│   │       ├── analyses/      # CRUD for incident analyses
│   │       ├── integrations/  # Integration management
│   │       ├── team/          # Team + invite management
│   │       ├── metrics/       # Dashboard overview metrics
│   │       └── settings/      # User/org settings
│   ├── components/            # React components (collocated tests)
│   ├── lib/
│   │   ├── auth.ts            # Auth.js v5 instance
│   │   ├── db/                # DynamoDB client + repositories
│   │   ├── monitoring/        # Error tracker + request logger
│   │   ├── rate-limit.ts      # In-memory rate limiter
│   │   └── rbac/              # Role-based access control
│   └── middleware.ts          # Auth guards + onboarding redirects
├── .env.example               # Environment variable reference
├── next.config.mjs            # Next.js config (CSP, CORS, transpile)
└── sst.config.ts              # AWS infrastructure (SST v3)
```

### Key Packages

| Package | Purpose |
|---------|---------|
| `packages/auth` | Cognito SDK, Auth.js config, session types |
| `packages/shared` | i18n messages, shared types, constants |
| `packages/ui` | Design system components (Tailwind + Radix UI) |
| `packages/analytics` | GA4 + Microsoft Clarity tracking |

### Authentication Flow

```
User → Sign-up form → POST /api/auth/sign-up → Cognito CreateUser
    → Verification email → POST /api/auth/verify-email → Cognito ConfirmSignUp
    → Sign-in form → Auth.js Cognito provider → JWT session
    → Middleware: profile complete? → /onboarding or /dashboard
```

### Database: DynamoDB Single-Table

All entities share one table (`causeflow-dashboard-{stage}`), partitioned by tenant:

| Entity | PK | SK |
|--------|----|----|
| Tenant | `TENANT#<id>` | `METADATA` |
| User | `TENANT#<id>` | `USER#<userId>` |
| Analysis | `TENANT#<id>` | `ANALYSIS#<ts>#<id>` |
| Integration | `TENANT#<id>` | `INTEGRATION#<type>` |
| Settings | `TENANT#<id>` | `SETTINGS` |
| Invite | `TENANT#<id>` | `INVITE#<email>` |

GSI1 (`gsi1pk/gsi1sk`): user → tenant lookup  
GSI2 (`gsi2pk/gsi2sk`): analysis status/timestamp filtering

### Integration Credentials

Stored encrypted with AWS KMS. Encryption/decryption happens in `src/lib/db/encryption.ts`. Plaintext credentials never appear in logs or SST outputs.

---

## Environment Variables Reference

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Description | Source |
|----------|-------------|--------|
| `AUTH_SECRET` | Auth.js JWT signing secret | Manual (`openssl rand -base64 32`) |
| `AUTH_COGNITO_ID` | Cognito App Client ID | SST output |
| `AUTH_COGNITO_SECRET` | Cognito App Client Secret | SST output |
| `AUTH_COGNITO_ISSUER` | Cognito OIDC issuer URL | SST output |
| `NEXTAUTH_URL` | App URL for auth callbacks | Manual |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name | SST output |
| `KMS_KEY_ARN` | KMS key for credential encryption | SST output |
| `AWS_REGION_OVERRIDE` | AWS region for SDK clients | Set to `us-east-2` |

---

## Deployment

### Prerequisites

- AWS credentials configured (OIDC or access keys)
- SST v3 installed: `curl -fsSL https://sst.dev/install | bash`

### Deploy to staging

```bash
cd apps/dashboard
sst deploy --stage staging
```

### Deploy to production

```bash
cd apps/dashboard
sst deploy --stage production
```

### CI/CD (GitHub Actions)

The workflow `.github/workflows/dashboard-deploy.yml` runs automatically on push to `main` when dashboard-related files change:

1. **Build & Validate** — type check, lint, test, build
2. **Deploy Staging** — `sst deploy --stage staging` (automatic after build passes)
3. **Deploy Production** — `sst deploy --stage production` (requires manual approval via GitHub environment protection)

**Required GitHub Secrets:**
- `AWS_ROLE_ARN` — OIDC role ARN for AWS authentication
- `DASHBOARD_AUTH_SECRET` — Auth.js secret for production

**Required GitHub Variables:**
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_CLARITY_ID`

### AWS Infrastructure (SST-managed)

After first deploy, SST creates:

- **Cognito User Pool** — `causeflow-users-{stage}` (email/password auth)
- **Cognito App Client** — OIDC client for Auth.js
- **Cognito Domain** — `causeflow-{stage}.auth.us-east-2.amazoncognito.com`
- **DynamoDB Table** — `causeflow-dashboard-{stage}` (PAY_PER_REQUEST + PITR)
- **KMS Key** — `alias/causeflow-dashboard-encryption-{stage}`
- **CloudFront Distribution** — global CDN with WAF attached
- **WAF WebACL** — rate limiting + AWS managed rules (us-east-1)
- **CloudWatch Alarms** (production only) — Lambda errors, DynamoDB throttles, 5xx rate
- **SNS Topic** (production only) — alarm notifications

### DNS

SST automatically creates Route 53 records when `domain` is configured:

- Production: `dashboard.causeflow.ai` → CloudFront distribution
- Staging: `dashboard-staging.causeflow.ai` → CloudFront distribution
- ACM certificates are auto-provisioned and renewed

---

## Testing

```bash
# Unit + integration tests (Vitest)
pnpm turbo test --filter=@causeflow/dashboard...

# All tests with coverage
pnpm vitest run --project dashboard --coverage

# Type checking
pnpm turbo check-types --filter=@causeflow/dashboard...

# Lint
pnpm turbo lint --filter=@causeflow/dashboard...

# Security audit
pnpm audit
```

### Test Structure

Tests are colocated with source files in `__tests__/` subdirectories:

```
src/lib/db/__tests__/        # Repository and encryption tests
src/app/api/**/__tests__/    # API route handler tests
src/components/**/__tests__/ # Component tests
src/lib/rbac/__tests__/      # RBAC permission tests
```

---

## Health Check

```
GET /api/health
→ 200 { status: "ok", version: "0.1.0", timestamp: "2026-02-24T..." }
```

No authentication required. Returns live status (no CDN caching).

---

## Monitoring

- **CloudWatch Logs** — Lambda logs via console output (JSON structured)
- **CloudWatch Alarms** — Error rates and DynamoDB throttles (production)
- **Error Tracker** — `src/lib/monitoring/error-tracker.ts` (stub, replace with Sentry)
- **Request Logger** — `src/lib/monitoring/request-logger.ts` (structured JSON to CloudWatch)
