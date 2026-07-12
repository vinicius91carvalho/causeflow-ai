# CLI Commands Reference

All commands use `pnpm`. Never use `npm`, `npx`, or `pnpm dlx playwright` (see the prohibition notes at the bottom).

## Development

```bash
# Start the full OSS stack (website, dashboard, Core, worker, Postgres, Redis, Hindsight)
docker compose up -d

# Start all apps (Webpack, not Turbopack)
pnpm dev

# Start website only (port 3000)
pnpm --filter website dev

# Start dashboard only (port 3001)
pnpm --filter dashboard dev
```

## Build

```bash
# Build all packages and apps (Turborepo-cached)
pnpm turbo build

# Build website only
pnpm --filter website build

# Build dashboard only
pnpm --filter dashboard build
```

## Testing

```bash
# Run Vitest across all 7 test projects (cached)
pnpm turbo test

# Run a single Vitest project by name
pnpm vitest run --project website
pnpm vitest run --project dashboard
pnpm vitest run --project shared
pnpm vitest run --project forms
pnpm vitest run --project analytics
pnpm vitest run --project auth
pnpm vitest run --project ui

# Run Vitest with coverage report
pnpm vitest run --coverage

# Run all Playwright E2E tests (chromium, 4 viewports)
pnpm exec playwright test

# Run a specific Playwright test file
pnpm exec playwright test tests/audit.spec.ts
pnpm exec playwright test tests/visual-functional.spec.ts

# Run Playwright tests against a specific base URL
BASE_URL=https://staging.causeflow.ai pnpm exec playwright test

# Run Playwright tests with Portuguese locale enabled
TEST_LOCALES=en,pt-br pnpm exec playwright test
```

## Linting and Formatting

```bash
# Run Biome lint across all packages (Turborepo-cached)
pnpm turbo lint

# Check lint and formatting (no writes)
pnpm exec biome check .

# Auto-fix lint and formatting issues
pnpm exec biome check --write .

# TypeScript type check across all packages
pnpm turbo check-types
```

## Deployment

```bash
# Build the Docker images used by the OSS runtime
docker compose build causeflow-website causeflow-dashboard
```

Hosted deployments are handled by GitHub Actions using the app Dockerfiles.

## Maintenance

```bash
# Remove node_modules and Turborepo cache
pnpm clean

# Security audit
pnpm audit
```

## Prohibited Commands

| Forbidden | Use Instead | Reason |
|---|---|---|
| `npm install` | `pnpm install` | Project uses pnpm workspaces |
| `npx <tool>` | `pnpm dlx <tool>` | Consistency with pnpm |
| `pnpm dlx playwright` | `pnpm exec playwright` | dlx downloads a conflicting version |
| `turbopack` / `dev:turbopack` | `pnpm dev` (Webpack) | Turbopack crashes in PRoot |
