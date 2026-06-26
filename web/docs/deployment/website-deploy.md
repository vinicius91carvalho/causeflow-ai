# Website Deployment (CI/CD)

CI/CD for the website app is managed by the GitHub Actions workflow at `.github/workflows/website-deploy.yml`.

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
  group: website-deploy-${{ github.ref }}
  cancel-in-progress: false
```

Deploys are serialized per branch. A queued deploy is not cancelled when a new one starts — it waits for the in-progress deploy to finish. This prevents partial or torn deployments.

---

## Jobs

### Job 1: Build and Validate

Runs on every trigger before any deployment proceeds.

Steps:
1. Checkout repository
2. Set up pnpm (workspace-aware)
3. Set up Node.js (version from `.nvmrc` or `package.json`)
4. Install dependencies: `pnpm install --frozen-lockfile`
5. Type-check: `pnpm turbo check-types --filter=website...`
6. Lint: `pnpm exec biome check .`
7. Run tests: `pnpm turbo test --filter=website...`
8. Build: `pnpm turbo build --filter=website...`

The build step uses the following environment variables sourced from GitHub Actions variables:

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | GitHub vars | Google Analytics 4 |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | GitHub vars | Microsoft Clarity |

### Job 2: Deploy Staging

Runs after Job 1 passes. Deploys the website to the `staging` stage.

Steps:
1. Assume AWS role via OIDC (no long-lived credentials stored in GitHub)
2. Install SST: `curl -fsSL https://sst.dev/install | bash`
3. Deploy: `(cd apps/website && sst deploy --stage staging)`

AWS authentication uses GitHub's OIDC provider with an IAM role that has the minimum permissions required for SST to provision website resources.

### Job 3: Deploy Production

Only runs when triggered by manual dispatch with stage set to `production`. Requires Job 2 (staging deploy) to have succeeded first.

Steps:
1. Assume AWS role via OIDC
2. Install SST
3. Deploy: `(cd apps/website && sst deploy --stage production)`

The staging-first requirement means production can only be deployed after the same commit has been validated in staging.

---

## AWS Resources (provisioned by SST)

| Resource | Details |
|---|---|
| CloudFront distribution | CDN for SSG output, HTTPS termination |
| WAF WebACL | Attached to CloudFront; provisioned in `us-east-1` |
| Route 53 records | A/AAAA alias records pointing to CloudFront |
| ACM certificate | SSL cert per stage, auto-renewed |
| S3 bucket | Stores static assets and SSG pages |

---

## Removal Policy

| Stage | Policy |
|---|---|
| `staging` | `remove` — all resources destroyed on `sst remove --stage staging` |
| `production` | `retain` — resources persist even after stack removal to prevent data loss |

The retain policy on production prevents accidental deletion of DNS records, certificates, and distribution configs during infrastructure updates.

---

## Staging Authentication

The staging website is protected by a password gate implemented in middleware:

- Activated when `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'` and `NEXT_PUBLIC_STAGING_PASSWORD` is set
- Password: `causeflow-staging-2026` (configured in `apps/website/sst.config.ts`)
- Cookie-based authorization — valid for the browser session
- Bypasses: `/_next/*`, `/api/*`, `/staging-auth`, static assets
