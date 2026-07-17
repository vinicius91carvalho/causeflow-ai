# Testing Guide

CauseFlow AI uses two test runners: **Vitest** for unit and integration tests, and **Playwright** for end-to-end tests.

## TDD Workflow (Mandatory Order)

All feature work must follow this order:

1. Write unit tests first (Red → Green → Refactor)
2. Implement the code
3. Write integration tests
4. Write E2E tests
5. Run ALL tests after each feature — fix failures immediately before moving on

## Vitest (Unit / Integration)

### Configuration

- Config file: `vitest.config.ts` at the project root
- Test pool: `forks` (process isolation)
- Max workers: 3
- 7 test projects: `shared`, `forms`, `analytics`, `auth`, `ui`, `website`, `dashboard`

### File Convention

Test files live colocated next to their source files:

```
src/
├── components/
│   ├── button.tsx
│   └── button.test.tsx    # colocated unit test
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
```

### Running Vitest

```bash
# All projects (Turborepo-cached)
pnpm turbo test

# Single project
pnpm vitest run --project website
pnpm vitest run --project dashboard
pnpm vitest run --project shared

# With coverage report
pnpm vitest run --coverage
```

### Dashboard Tests — Timeout Note

The `dashboard` test project has a **15-second timeout** because AWS SDK imports are heavy. Do not lower this timeout. If dashboard tests appear to hang under CI, verify the timeout is not overridden.

## Playwright (E2E)

### Configuration

- Config file: `playwright.config.ts` at the project root
- Browser: **chromium only** (Chrome is not available on arm64)
- Workers: 3, fully parallel
- Retries: 2 (CI only, not local)
- Traces, videos, screenshots: off by default (enable for debugging)

### Viewports

Tests run across 4 viewports automatically:

| Name | Width |
|---|---|
| Mobile | 375px |
| Tablet | 768px |
| Desktop | 1280px |
| Wide | 1440px |

### Test Files

| File | Coverage |
|---|---|
| `tests/audit.spec.ts` | SEO tags, accessibility, infrastructure (robots.txt, sitemap, headers) |
| `tests/visual-functional.spec.ts` | Visual appearance, interactive behavior, navigation |

### Network Blocking

All tests block the following domains to prevent flakiness from analytics and tracker requests:

- Google Analytics (GA4)
- Microsoft Clarity
- Intercom

### Staging Authentication

When `BASE_URL` contains `staging.causeflow.ai`, Playwright automatically injects the staging authorization cookie. No manual setup required.

Staging password: `causeflow-staging-2026`

### Running Playwright

```bash
# Kill any existing servers first
pkill -f "next-server|next start|next dev" 2>/dev/null
pkill -f playwright 2>/dev/null

# Run all E2E tests
pnpm exec playwright test

# Run a specific file
pnpm exec playwright test tests/audit.spec.ts

# Run against staging
BASE_URL=https://staging.causeflow.ai pnpm exec playwright test

# Run with Portuguese locale
TEST_LOCALES=en,pt-br pnpm exec playwright test

# OSS compose E2E (AC-054..AC-061) — requires Core compose + Ornith for golden path
# Dashboard :3001 (or OSS_DASHBOARD_URL), Core :3099. Core local register/login only.
pnpm exec playwright test --project=dashboard-oss-e2e
pnpm exec playwright test --project=dashboard-oss-e2e --list

# Goal Review / run_completed gate (AC-061 capstone — full AC-054..AC-060 chain)
pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-061-capstone.spec.ts

# Root Completion Contract AC-025 / AC-026 harness QA gate (local-auth golden path)
# Prerequisites: Core + worker, dashboard :3001, test-app :5190, Ornith :8081
pnpm verify:ac025
# equivalent: node scripts/ac-025-browser-probe.mjs
```

> ALWAYS use `pnpm exec playwright`. Never use `pnpm dlx playwright` — it downloads a conflicting version that ignores the local config.

### OSS compose project (`dashboard-oss-e2e`)

| Item | Value |
|---|---|
| Specs | `tests/oss/ac-055-*.spec.ts` … `ac-061-capstone.spec.ts` |
| Capstone (AC-061) | `tests/oss/ac-061-capstone.spec.ts` — Goal Review delivery gate |
| Auth setup | `tests/oss/auth-setup.ts` → dashboard `/api/auth/register` + `/api/auth/login` → Core |
| Dashboard URL | `OSS_DASHBOARD_URL` (default `http://127.0.0.1:3001`) |
| Core URL | `OSS_CORE_API_URL` (default `http://127.0.0.1:3099`) |
| Not the pass path | Clerk, `STAGING_TEST_USER` / `.env.staging`, `page.route` mocks of `/api/integrations/*` or `/api/incidents*` |

The OSS projects are registered only when `--project=dashboard-oss-e2e` (or `PLAYWRIGHT_OSS=1`) is used, so the default website Playwright suite does not require compose.
### Screenshots

When writing tests that capture screenshots for style verification, always save to the `./screenshots` folder:

```typescript
await page.screenshot({ path: './screenshots/homepage-mobile.png' });
```

### No Hardcoded Waits

Do not use `page.waitForTimeout()` or `sleep()`. Use locator-based waits instead:

```typescript
// Correct
await expect(page.locator('main')).toBeVisible();
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Forbidden
await page.waitForTimeout(2000);
```

## Running All Tests Before a Commit

Before committing any feature work, run the full suite:

```bash
pnpm turbo test          # All Vitest
pnpm turbo check-types   # TypeScript
pnpm exec biome check .  # Lint + format
pnpm exec playwright test # E2E
```

Fix every failure before continuing. Do not leave a red test suite and move on.
