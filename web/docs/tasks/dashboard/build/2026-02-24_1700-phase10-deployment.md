# Phase 10: Deployment & CI/CD

## Phase 10.1: Research & Setup
- [x] Study existing website SST deployment config (`apps/website/sst.config.ts`) for patterns
- [x] Study existing GitHub Actions workflow (`.github/workflows/`) for CI/CD patterns
- [x] Study existing dashboard SST config (`apps/dashboard/sst.config.ts`) for current resources
- [x] Study Route 53 hosted zone and DNS setup for causeflow.ai
- [x] Verify all environment variables needed for dashboard deployment

## Phase 10.2: SST Config — Production Ready
- [x] Update `apps/dashboard/sst.config.ts` for production deployment:
  - Next.js SSR site (OpenNext + Lambda + CloudFront)
  - Domain: `dashboard.causeflow.ai` (production), `staging-dashboard.causeflow.ai` (staging)
  - Cognito User Pool with production password policy
  - DynamoDB table with point-in-time recovery enabled
  - KMS key for credential encryption
  - SES configuration for branded emails
  - Lambda trigger for custom email messages
  - Environment variables per stage (staging vs production)
- [x] Add WAF (Web Application Firewall) rules:
  - Rate limiting (1000 requests/5min per IP)
  - Bot protection (AWS managed rules)
  - IP reputation list
- [x] Add CloudWatch alarms:
  - Lambda error rate > 1%
  - DynamoDB throttled requests > 0
  - 5xx error rate > 0.5%
- [x] Configure stage-specific settings:
  - Staging: minimal resources, lower limits
  - Production: full resources, monitoring enabled

## Phase 10.3: Environment Variables
- [x] Document all required environment variables in `apps/dashboard/.env.example`:
  - AUTH_SECRET (Auth.js secret)
  - COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, COGNITO_ISSUER
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (social login)
  - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (social login)
  - DYNAMODB_TABLE_NAME
  - KMS_KEY_ARN
  - NEXTAUTH_URL (dashboard.causeflow.ai)
  - NODE_ENV
- [x] Create SST environment bindings for all variables (linked from SST resources)

## Phase 10.4: GitHub Actions CI/CD
- [x] Create `.github/workflows/dashboard-deploy.yml`:
  - Trigger: push to main (dashboard paths), manual dispatch
  - Jobs:
    1. Build: pnpm install, turbo build (dashboard + deps)
    2. Test: turbo test (dashboard)
    3. Lint: biome check
    4. Type check: turbo check-types
    5. Deploy staging: sst deploy --stage staging
    6. Deploy production: sst deploy --stage production (manual approval or auto after staging)
  - AWS OIDC authentication (reuse existing role)
  - Cache: pnpm store, turbo cache
  - Path filters: only run on dashboard/auth/shared changes
- [x] Add dashboard-specific path triggers to prevent unnecessary deployments
- [x] Add deployment status badges to task documentation

## Phase 10.5: DNS & SSL
- [x] Add Route 53 records for `dashboard.causeflow.ai`:
  - SST handles this automatically via the `domain` config
  - Verify certificate provisioning (ACM)
- [x] Add Route 53 records for `staging-dashboard.causeflow.ai`
- [x] Document DNS configuration

## Phase 10.6: Monitoring & Observability
- [x] Add error tracking setup placeholder (Sentry or CloudWatch RUM):
  - Create `apps/dashboard/src/lib/monitoring/error-tracker.ts`
  - Initialize in root layout
  - Capture unhandled errors from error boundary
- [x] Add health check endpoint:
  - GET `/api/health` → returns { status: 'ok', version, timestamp }
  - Used by CloudWatch synthetic monitoring
- [x] Add request logging middleware placeholder

## Phase 10.7: Security Hardening
- [x] Review and update Content Security Policy headers in `next.config.mjs`
- [x] Ensure all auth cookies have Secure, HttpOnly, SameSite flags
- [x] Add CORS configuration for API routes
- [x] Verify rate limiting on all public endpoints
- [x] Run `pnpm audit` and document any vulnerabilities

## Phase 10.8: Documentation
- [x] Update `docs/tasks/dashboard/DASHBOARD-MASTER-PLAN.md` — mark all phases complete
- [x] Create `apps/dashboard/README.md` with:
  - Getting started (dev setup)
  - Architecture overview
  - Environment variables reference
  - Deployment instructions
  - Testing instructions

## Phase 10.9: Final Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass
- [x] Run `pnpm audit` — document findings
- [x] Verify SST config is syntactically valid (sst build)
- [x] Remove unused code/imports across entire dashboard
