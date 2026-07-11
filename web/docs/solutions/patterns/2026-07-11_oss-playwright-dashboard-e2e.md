# OSS Playwright project: Core local auth against compose (AC-054)

## Problem

Dashboard E2E historically targeted Clerk staging (`.env.staging` / `STAGING_TEST_USER`) or minted local JWTs.
Open-source delivery must prove the compose stack operators actually run: dashboard on compose port `:3001`, Core on host `:3099`, auth via Core register/login + `__session` cookie only.

## Solution

Dedicated Playwright projects gated behind `--project=dashboard-oss-e2e`:

- `dashboard-oss-setup` — `tests/oss/auth-setup.ts` POSTs to `/api/auth/register` (fallback `/api/auth/login`), which proxies Core; saves `tests/oss/.auth/user.json`.
- `dashboard-oss-e2e` — specs under `tests/oss/` for AC-055..AC-057; `baseURL` defaults to `http://127.0.0.1:3001`.

Explicit non-pass paths: Clerk, `.env.staging` STAGING_TEST_USER, and `page.route` mocks of `/api/integrations/*` or `/api/incidents*`.

## Command

```bash
docker compose up -d   # from web monorepo root
pnpm exec playwright test --project=dashboard-oss-e2e
pnpm exec playwright test --project=dashboard-oss-e2e --list
```

## Env overrides

- `OSS_DASHBOARD_URL` (default `http://127.0.0.1:3001`)
- `OSS_CORE_API_URL` (default `http://127.0.0.1:3099`)
- `PLAYWRIGHT_OSS=1` also registers the OSS projects without requiring `--project` in argv
