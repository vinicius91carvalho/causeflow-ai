---
title: .env.local is the project standard — no .env.staging or .env.production
date: 2026-02-28
category: patterns
tags: [env, dotenv, sst, deployment, configuration, secrets]
app: website, dashboard
severity: medium
---

# .env.local is the project standard — no .env.staging or .env.production

## Problem

Agents and developers search for `.env.staging`, `.env.production`, or `.env.development` expecting stage-specific configuration files. None of these files exist in this project. Searching for them wastes time and causes confusion.

## Root Cause

This project uses SST for deployment. SST injects all environment variables at deploy time via the `environment` block in each app's `sst.config.ts`. Stage-specific logic is handled in TypeScript using `$app.stage`:

```ts
// sst.config.ts pattern
environment: {
  NEXT_PUBLIC_DEPLOYMENT_STAGE: $app.stage,
  NEXT_PUBLIC_DASHBOARD_URL:
    $app.stage === 'production'
      ? 'https://dashboard.causeflow.ai'
      : `https://dashboard-${$app.stage}.causeflow.ai`,
},
```

There is no need for separate `.env.staging` or `.env.production` files.

## Solution

| Use Case | File |
|---|---|
| Local development | `.env.local` in each app directory |
| Staging/production | Configured in `sst.config.ts` |
| CI/CD env vars | Added to GitHub Actions workflow steps |

When adding a new environment variable:
1. Add it to the relevant `.env.local` for local dev
2. Add it to `sst.config.ts` `environment` block for deployed stages
3. Add it to CI workflow deploy steps in `.github/workflows/*.yml`

Template files:
- `apps/dashboard/.env.example` — template with placeholder values
- Root `.env.example` — template with empty values

## Prevention

- Rule in `MEMORY.md`: "ALWAYS use `.env.local` for local/deploy configs."
- Rule: "NEVER search for `.env.staging` or `.env.production` — they don't exist."
- When asked to configure a new env var for staging: edit `sst.config.ts`.

## Related

- `apps/dashboard/sst.config.ts`
- `apps/website/sst.config.ts`
- [`infrastructure/2026-02-28_sst-proot-bun-wrapper.md`](../infrastructure/2026-02-28_sst-proot-bun-wrapper.md)
