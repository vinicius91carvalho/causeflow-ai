# CauseFlow AI

AI-powered incident investigation platform for engineering teams (2-50 engineers). Bridges SRE investigation and customer issue resolution.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 + Shadcn/ui |
| Package Manager | pnpm (workspaces) |
| Build Orchestration | Turborepo |
| Linting & Formatting | Biome |
| Unit/Integration Tests | Vitest |
| E2E Tests | Playwright (chromium, 4 viewports) |
| i18n | next-intl (EN + PT-BR) |
| Auth (Dashboard) | Local JWT auth in OSS; Clerk for hosted deployments |
| Billing | Stub billing in OSS; Stripe for hosted deployments |
| Hosting | Docker for OSS runtime; GitHub Actions/Docker images for hosted deployments |
| Analytics | Google Analytics 4 + Microsoft Clarity |
| Forms | Loops.so + Zod validation |

## Project Structure

```
causeflow-ai/
├── apps/
│   ├── website/                 # Next.js marketing site (SSG)
│   └── dashboard/               # Next.js product app (SSR, local JWT auth in OSS)
├── packages/
│   ├── shared/                  # Types, utils, constants, i18n messages
│   ├── ui/                      # Design system (Radix UI + CVA + Tailwind)
│   ├── analytics/               # GA4, Microsoft Clarity, tracking events
│   ├── auth/                    # Legacy auth helpers; dashboard auth now lives in app contexts
│   └── forms/                   # Form logic and Zod validation schemas
├── docs/                        # Architecture, app docs, packages, deployment, development
│   ├── apps/                    # Per-app documentation (website, dashboard)
│   ├── architecture/            # Architecture overview, tech stack, bounded contexts
│   ├── deployment/              # Deployment notes
│   ├── development/             # Getting started, commands, testing, troubleshooting
│   ├── packages/                # Package documentation
│   ├── solutions/               # Institutional knowledge base (solved problems)
│   └── tasks/                   # Planning & task documents
├── tests/                       # Playwright E2E tests
├── turbo.json                   # Turborepo task configuration
├── vitest.config.ts             # Vitest project-based config
├── playwright.config.ts         # Playwright multi-viewport config
├── biome.json                   # Biome linting & formatting config
├── pnpm-workspace.yaml          # Workspace package declarations
└── tsconfig.base.json           # Shared TypeScript configuration
```

Each package and app follows **Clean Architecture** with DDD bounded contexts:

- **Domain** — Entities, interfaces, business types
- **Application** — Use cases, services, DTOs
- **Infrastructure** — Concrete implementations, APIs, adapters, i18n
- **Presentation** — React components, hooks, pages

## Prerequisites

- **Node.js** >= 24
- **pnpm** 10.x (`corepack enable && corepack prepare pnpm@10.30.1 --activate`)
- **Docker + Compose** for the full OSS stack
- **chromium** (for Playwright E2E tests)

> **Important:** `npm` and `npx` are forbidden in this project. Use `pnpm` and `pnpm dlx` exclusively.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/causeflow/web.git
cd web
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
# Website
cp apps/website/.env.example apps/website/.env.local

# Dashboard
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

Edit each `.env.local` and fill in your values. See [Environment Variables](#environment-variables) for details.

### 4. Start the full OSS stack

```bash
docker compose up -d
```

This starts the website (`http://localhost:3000`), dashboard
(`http://localhost:3001`), Core API (`http://localhost:3099`), worker,
Postgres, Redis, and Hindsight. Set `CORE_CONTEXT=/abs/path/to/core` if the
Core checkout is not at `../core`.

### 5. Build all packages

```bash
pnpm turbo build
```

### 6. Start dev servers without Docker

```bash
pnpm turbo dev
```

| App | URL |
|---|---|
| Website | `http://localhost:3000` |
| Dashboard | `http://localhost:3001` |
| Core API (Docker) | `http://localhost:3099` |

## CLI Commands

### Root-Level Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm turbo build` | Build all packages and apps (cached) |
| `pnpm turbo dev` | Start all dev servers |
| `pnpm turbo test` | Run Vitest unit/integration tests (cached) |
| `pnpm turbo lint` | Biome lint all packages |
| `pnpm turbo check-types` | TypeScript type checking across all packages |
| `pnpm exec biome check .` | Lint + format check |
| `pnpm exec biome check --write .` | Auto-fix lint + format |

### Testing Commands

| Command | Description |
|---|---|
| `pnpm turbo test` | Run all Vitest tests across every package |
| `pnpm vitest run` | Run all Vitest tests directly (no Turbo cache) |
| `pnpm vitest run --project shared` | Run tests for `@causeflow/shared` only |
| `pnpm vitest run --project forms` | Run tests for `@causeflow/forms` only |
| `pnpm vitest run --project analytics` | Run tests for `@causeflow/analytics` only |
| `pnpm vitest run --project ui` | Run tests for `@causeflow/ui` only |
| `pnpm vitest run --project website` | Run tests for `@causeflow/website` only |
| `pnpm vitest run --project dashboard` | Run tests for `@causeflow/dashboard` only |
| `pnpm vitest run --coverage` | Run all tests with V8 coverage report |
| `pnpm exec playwright test tests/audit.spec.ts` | Run Playwright E2E tests (auto-starts server) |
| `pnpm exec playwright test --project=chromium-mobile` | Run E2E tests for mobile viewport only |
| `TEST_LOCALES=en,pt-br pnpm exec playwright test` | Run E2E tests for both EN and PT-BR locales |

### Per-App Commands

```bash
pnpm --filter @causeflow/website dev        # Website dev server (localhost:3000)
pnpm --filter @causeflow/dashboard dev       # Dashboard dev server (localhost:3001)
pnpm --filter @causeflow/website build       # Build website only
pnpm --filter @causeflow/dashboard build     # Build dashboard only
```

### Dashboard CLI Scripts

```bash
pnpm --filter @causeflow/dashboard run credits:add -- --tenant <id> --amount <n>   # Add credits manually
```

## Playwright E2E Tests

**Configuration:**

- **Browser:** chromium (4 viewports)
- **Viewports:** Mobile (375x812), Tablet (768x1024), Desktop (1280x800), Wide (1440x900)
- **Workers:** 3 parallel
- **Web server:** Auto-starts production server on port 3000

```bash
# Build first (required before E2E)
pnpm turbo build

# Run tests (server starts automatically)
pnpm exec playwright test tests/audit.spec.ts

# Install browsers (first time only)
pnpm exec playwright install chromium
```

## Environment Variables

### Website

| Variable | Type | Description |
|---|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Public | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_CLARITY_ID` | Public | Microsoft Clarity project ID |

### Dashboard

| Variable | Type | Description |
|---|---|---|
| `CORE_API_URL` | Server | Core API base URL (blank for mock mode) |
| `JWT_SECRET` | Server | Local JWT secret shared with Core |
| `CAUSEFLOW_RUNTIME` | Server | Set to `oss` for local stub billing/auth behavior |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Public | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_CLARITY_ID` | Public | Microsoft Clarity project ID |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | Public | `development`, `staging`, or `production` |

The OSS runtime does not require Clerk, Stripe, AWS, Sentry, Loops.so, or
SST-injected variables.

## Deployment

The open-source runtime runs as Docker services. Hosted environments deploy
the same Next.js apps from their Dockerfiles.

| Environment | Website | Dashboard |
|---|---|---|
| Production | `https://causeflow.ai` | `https://dashboard.causeflow.ai` |
| Staging | `https://staging.causeflow.ai` | `https://dashboard-staging.causeflow.ai` |
| Local Dev | `http://localhost:3000` | `http://localhost:3001` |

### Staging Protections

- **Robot blocking:** `robots.txt` returns `Disallow: /` with `noindex, nofollow` meta tags
- **Password gate:** Visitors must enter a password before accessing any page
- **Staging password:** `causeflow-staging-2026`

## i18n (Internationalization)

- **English** (default) — all routes without prefix
- **Portuguese (PT-BR)** — all routes under `/pt-br/` prefix
- Per-context i18n files composed into a unified message tree via `lib/i18n/compose.ts`
- hreflang tags and language selector on every page

## Website Routes

| Route | Page |
|---|---|
| `/` | Homepage |
| `/product` | Product / How It Works |
| `/security` | Security |
| `/integrations` | Integrations |
| `/pricing` | Pricing |
| `/get-started` | Sign Up / Get Started |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |

PT-BR mirrors all routes with `/pt-br/` prefix.

## Dashboard Routes

| Route | Page |
|---|---|
| `/auth/sign-in` | Sign in (local JWT in OSS; Clerk in hosted deployments) |
| `/auth/sign-up` | Register |
| `/onboarding/complete-profile` | Company setup |
| `/onboarding/choose-plan` | Plan selection |
| `/dashboard` | Overview (metrics, credits, recent incidents) |
| `/dashboard/incidents` | Incident list |
| `/dashboard/incidents/new` | Create incident |
| `/dashboard/incidents/[id]` | Incident detail |
| `/dashboard/integrations` | Integration catalog & management |
| `/dashboard/team` | Team members & invites |
| `/dashboard/settings` | Profile, company, notifications, appearance, API keys |
| `/dashboard/billing` | Subscription & invoices |
| `/dashboard/audit` | Audit trail |
| `/dashboard/intelligence` | Pattern insights & AI memory |
| `/dashboard/relay` | Integration relay status |

See [Dashboard Documentation](docs/apps/dashboard/README.md) for full details.

## Workspace Packages

| Package | Description |
|---|---|
| `@causeflow/website` | Next.js marketing site (SSG) |
| `@causeflow/dashboard` | Next.js product app (SSR, local JWT auth in OSS) |
| `@causeflow/shared` | Shared types, utilities, constants, i18n messages |
| `@causeflow/ui` | Design system — Radix UI + CVA + Tailwind components |
| `@causeflow/analytics` | GA4 + Microsoft Clarity tracking wrappers |
| `@causeflow/auth` | Legacy Auth.js/Cognito helpers; dashboard auth is app-owned |
| `@causeflow/forms` | Form logic with Zod validation schemas |

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

- [Architecture Overview](docs/architecture/overview.md)
- [Website Docs](docs/apps/website/README.md)
- [Dashboard Docs](docs/apps/dashboard/README.md)
- [API Reference](docs/apps/dashboard/api-reference.md)
- [Deployment](docs/deployment/overview.md)
- [Getting Started](docs/development/getting-started.md)
- [Testing Guide](docs/development/testing.md)
- [Solutions Library](docs/solutions/)

## License

Proprietary. All rights reserved.
