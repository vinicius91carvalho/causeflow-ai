# Deployment Overview

CauseFlow AI uses SST v3 (Serverless Stack) as its infrastructure-as-code layer, deploying both apps to AWS.

---

## Infrastructure

| Property | Value |
|---|---|
| IaC Tool | SST v3.19.0 |
| AWS Account | 409171461008 |
| Primary Region | us-east-2 |
| WAF Region | us-east-1 (CloudFront requirement) |
| DNS | Route 53 hosted zone `Z01593322DGY9I94W9S7C` |
| DNS delegation | GoDaddy NS records → Route 53 |
| SSL | Amazon ACM (auto-managed, renews automatically) |

---

## Apps and Config Files

Each app is an independent SST deployment with its own configuration:

| App | SST Config |
|---|---|
| Website | `apps/website/sst.config.ts` |
| Dashboard | `apps/dashboard/sst.config.ts` |

All `sst` commands must be run from the respective `apps/` directory, not the monorepo root.

---

## Stages

| Stage | Purpose |
|---|---|
| `staging` | Pre-production validation, auto-deployed on every push to `main` |
| `production` | Live environment, manual dispatch only |

---

## Environment URLs

| App | Stage | URL |
|---|---|---|
| Website | Production | `https://causeflow.ai` |
| Website | Staging | `https://staging.causeflow.ai` |
| Dashboard | Production | `https://dashboard.causeflow.ai` |
| Dashboard | Staging | `https://dashboard-staging.causeflow.ai` |

Additional website aliases (all redirect to `causeflow.ai`):
- `www.causeflow.ai`
- `causeflow.io`
- `causeflow.com.br`

---

## Environment Variables

Environment variables are **not** loaded from `.env` files at deploy time. SST injects all stage-specific values directly into the deployed resources via `sst.config.ts`.

Local development uses `.env.local` files (never `.env.staging` or `.env.production` — these do not exist).

---

## Deploy Commands

**IMPORTANT: Never deploy locally. Always use CI/CD via GitHub Actions.**

```bash
# Staging — auto-deploys on every push to main (no manual action needed)

# Production — trigger manually via GitHub Actions:
gh workflow run "Website Deploy" -f stage=production
gh workflow run "Dashboard Deploy" -f stage=production
```

---

## SST Install

SST v3 is installed via the official installer script:

```bash
curl -fsSL https://sst.dev/install | bash
```

This installs the `sst` CLI to `~/.sst/bin/sst`.

---

## PRoot Bun Workaround

SST v3 uses Bun internally. In the PRoot/arm64 environment (Termux on Android), Bun requires a workaround to avoid symlink issues:

- A wrapper script lives at `~/.config/sst/bin/bun`
- The wrapper delegates to `bun-real` with the `--backend=copyfile` flag
- This prevents "Invalid symlink" crashes that occur with Turbopack and native Bun in PRoot

This workaround is environment-specific to the development container and is not required in CI/CD (GitHub Actions runs on standard Linux runners).

---

## SSL Certificates

ACM certificates are provisioned automatically by SST per stage. Current certificate validity extends through September 2026 and renews automatically before expiry.

WAF WebACLs must be created in `us-east-1` regardless of the app's primary region, because CloudFront only accepts WebACLs from `us-east-1`.
