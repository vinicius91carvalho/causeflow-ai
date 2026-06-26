# CauseFlow AI Architecture Overview

## Project Overview

CauseFlow AI is an AI-powered incident investigation platform designed for engineering teams of 2–50 engineers. It bridges the gap between SRE investigation workflows and customer issue resolution, enabling faster root cause analysis and collaborative incident response.

The platform is delivered as two separate applications sharing a common monorepo:

- **Website** — Public-facing marketing site (currently live)
- **Dashboard** — Product application for incident investigation, root cause analysis, integrations, and team collaboration (deployed to staging)

Competitors in the space: resolve.ai, incident.io, Rootly, IncidentFox.

---

## Monorepo Structure

The repository uses pnpm workspaces orchestrated by Turborepo. All packages are co-located and share TypeScript configurations, linting rules, and build pipelines.

```
causeflow-ai/
├── apps/
│   ├── website/             # Next.js 15 — marketing site (SSG)
│   └── dashboard/           # Next.js 15 — product app (SSR, Auth.js + Cognito)
├── packages/
│   ├── shared/              # Types, utils, constants, i18n keys
│   ├── ui/                  # Reusable UI components (design system)
│   ├── analytics/           # GA4, Microsoft Clarity, tracking events
│   ├── auth/                # Authentication: Auth.js v5, Cognito OIDC, OAuth
│   └── forms/               # Form logic and validation
├── pnpm-workspace.yaml
├── package.json             # Root scripts & shared devDependencies
├── tsconfig.base.json       # Shared TypeScript base config
├── biome.json               # Unified lint + format config
├── vitest.config.ts         # Vitest root config (7 test projects)
└── playwright.config.ts     # E2E test config (chromium, 4 viewports)
```

---

## Clean Architecture

Every package follows a strict four-layer architecture. Dependencies flow inward only — outer layers depend on inner layers, never the reverse.

```
Domain           # Core business entities, value objects, interfaces
   ↑
Application      # Use cases, application services, DTOs
   ↑
Infrastructure   # External integrations (DB, APIs, cloud services)
   ↑
Presentation     # UI components, API route handlers, page components
```

### Layer Responsibilities

| Layer | Contents |
|---|---|
| Domain | Types, interfaces, constants, business rules — no external dependencies |
| Application | Use cases, service interfaces, data transformations |
| Infrastructure | DynamoDB clients, Cognito adapters, Loops.so integration, middleware |
| Presentation | React components, Next.js pages, API route handlers |

---

## Tech Stack

| Tool | Version | Details |
|---|---|---|
| Package Manager | pnpm 10.30.1 | Workspaces — `npm` and `npx` are forbidden |
| Build Orchestration | Turborepo 2.8.10 | Caches build, test, lint, check-types across packages |
| Linting & Formatting | Biome 2.4.4 | Replaces ESLint + Prettier — single unified tool |
| Framework | Next.js 15.2.0 | App Router — SSG for website, SSR for dashboard |
| Language | TypeScript 5.7.0 | Strict mode across all packages |
| Styling | Tailwind CSS 4.0 + Shadcn/ui | Radix primitives, two-layer token system |
| Unit/Integration Tests | Vitest 4.0.18 | 7 test projects, forks pool, max 3 workers |
| E2E Tests | Playwright 1.58.2 | Chromium only, 4 viewports (mobile/tablet/desktop/wide) |
| Authentication | Auth.js v5 | Cognito OIDC + Google OAuth + GitHub OAuth, RBAC |
| Database | DynamoDB | Single-table design, AWS SDK v3 |
| Encryption | AWS KMS | Integration credential encryption |
| Hosting / IaC | SST v3.19.0 | Infrastructure as code on AWS |
| CDN | CloudFront + WAF | Static asset delivery, WAF security layer |
| Analytics | GA4 + Microsoft Clarity | Tracking events abstracted in `packages/analytics` |
| i18n | next-intl | EN default (no prefix), PT-BR at `/pt-br/` prefix |
| Forms | Zod + Loops.so | Schema validation + email automation platform |

---

## Bounded Contexts

Both apps use a DDD-style bounded context architecture. All feature code lives under `src/contexts/`, organized into self-contained modules. Route files under `app/` are thin orchestrators — they import from contexts but contain no business logic themselves.

### Key principles

- Each context is **self-contained**: components, hooks, types, services, and tests live together inside the context directory.
- **Cross-context imports use direct deep paths** — context `index.ts` barrel files have been removed to improve Webpack dev compilation speed. Import directly from the specific file (e.g., `@/contexts/team/domain/types`).
- `app/` route files import from contexts and compose pages. They hold no business logic.
- `lib/` at the app level contains only shared infrastructure not owned by any single context (database client, API authentication HOC, rate limiting, encryption).
- Tests are **colocated** with their components inside each context's `__tests__/` subdirectory.

### Dashboard — 9 contexts

| Context | Domain |
|---|---|
| `investigation` | Incidents, analyses, remediations — the core product flow |
| `approvals` | Approval workflows for remediation actions |
| `audit` | Audit trail and compliance views |
| `identity` | Auth, onboarding, user profile, RBAC |
| `team` | Team member management and invites |
| `integrations` | External service connections (15 types) |
| `billing` | Stripe integration, credits, subscriptions |
| `settings` | User and company preferences |
| `shared` | Layout, navigation, command palette, cross-context UI primitives |

### Website — 4 contexts

| Context | Domain |
|---|---|
| `marketing` | Product pages, sections, pricing, SEO components |
| `engagement` | Contact forms, modals, CTAs |
| `legal` | Privacy, terms — namespace for legal content |
| `shell` | Header, footer, navigation, language selector |

See [`bounded-contexts.md`](./bounded-contexts.md) for the full reference including directory structure, context details, and extraction guidelines.

---

## Application Architecture

### Website (SSG)

The marketing site uses Next.js Static Site Generation. All pages are pre-rendered at build time and served from CloudFront. No server-side runtime is required in production.

- All routes defined under `apps/website/src/app/`
- Content pages: `/`, `/product`, `/security`, `/integrations`, `/pricing`, `/get-started`, `/privacy`, `/terms`
- PT-BR mirrors all routes under `/pt-br/` prefix
- No database dependency — static content only
- Form submissions proxied through Loops.so

### Dashboard (SSR)

The product app uses Next.js Server-Side Rendering with a DynamoDB backend. Auth.js v5 manages sessions with Cognito as the primary identity provider.

- All routes under `apps/dashboard/src/app/`
- Auth routes: `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/verify-email`
- Onboarding: `/onboarding/welcome`, `/onboarding/complete-profile`, `/onboarding/connect-integration`
- App routes: `/dashboard`, `/dashboard/analyses`, `/dashboard/integrations`, `/dashboard/team`, `/dashboard/settings`, `/dashboard/billing`
- API: 23 endpoints under `/api/` covering auth, analyses, integrations, team, metrics, settings, onboarding, health

---

## Data Flow

### Authentication Flow

```
User → Dashboard → Auth.js v5 middleware
                → Cognito OIDC (primary)
                → Google OAuth (social)
                → GitHub OAuth (social)
                → Session created (JWT or database)
                → RBAC roles applied (admin / member)
```

### Incident Analysis Flow

```
User creates analysis → API route handler (Presentation)
                      → Use case service (Application)
                      → DynamoDB repository (Infrastructure)
                      → Integration credentials decrypted via KMS
                      → External integrations queried
                      → AI analysis result stored + returned
```

### Integration Credential Security

Integration credentials (e.g., Slack tokens, PagerDuty API keys) are encrypted with AWS KMS before storage in DynamoDB. Decryption occurs only within the server-side infrastructure layer — credentials are never exposed client-side.

---

## Package Dependency Graph

Dependencies flow from packages toward apps. Packages do not depend on apps. The `shared` package is the foundation — it has no internal dependencies.

```
packages/shared
    ↑
    ├── apps/website
    ├── apps/dashboard
    ├── packages/ui
    ├── packages/analytics
    ├── packages/auth
    └── packages/forms

packages/ui
    ↑
    ├── apps/website
    └── apps/dashboard

packages/analytics
    ↑
    ├── apps/website
    └── apps/dashboard

packages/auth
    ↑
    └── apps/dashboard

packages/forms
    ↑
    └── apps/website
```

---

## Environment Topology

### URLs

| Environment | Website | Dashboard |
|---|---|---|
| Production | https://causeflow.ai | https://dashboard.causeflow.ai |
| Staging | https://staging.causeflow.ai | https://dashboard-staging.causeflow.ai |
| Local Dev | http://127.0.0.1:3000 | http://127.0.0.1:3001 |

Additional redirects to production: `www.causeflow.ai`, `causeflow.io`, `causeflow.com.br`.

### Environment Variables

- Local development: `.env.local` files (project standard — `.env.staging` and `.env.production` do not exist)
- Staging and production: SST injects all environment variables at deploy time via `sst.config.ts`
- Root `.env.local`: GA4 measurement ID, Clarity project ID, Loops.so API key
- `apps/dashboard/.env.local`: Auth.js secret, Cognito config, AWS region, OAuth client IDs/secrets

### Staging Gate

A middleware-based password gate protects all staging environments. Activated when `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'` and `NEXT_PUBLIC_STAGING_PASSWORD` is set. Uses a cookie-based session so the gate is not re-triggered on every request.

---

## Security Architecture

| Layer | Controls |
|---|---|
| Network | CloudFront WAF — rate limiting, IP rules, bot detection |
| Transport | HTTPS enforced via HSTS header |
| Application | CSP headers configured per app via `next.config.mjs` |
| Authentication | Auth.js v5 + Cognito — no custom credential storage |
| Authorization | RBAC: admin and member roles enforced server-side |
| Data | KMS encryption for all integration credentials at rest |
| Staging | Password gate middleware on all staging domains |
| Forms | Input sanitization + Zod schema validation + Loops.so API key protection |

---

## Build and CI/CD

### Local Commands

```bash
pnpm turbo build              # Build all packages (cached)
pnpm turbo test               # Vitest all packages (cached)
pnpm turbo dev                # Start all dev servers
pnpm turbo lint               # Biome lint across all packages
pnpm turbo check-types        # TypeScript type checking
pnpm exec biome check .       # Lint + format check
pnpm exec biome check --write . # Auto-fix lint + format
pnpm vitest run --coverage    # Tests with coverage report
pnpm exec playwright test     # E2E tests (chromium)
```

### CI/CD Pipelines

- `.github/workflows/website-deploy.yml` — Website build, test, deploy to staging and production
- `.github/workflows/dashboard-deploy.yml` — Dashboard build, test, deploy to staging

### Deployment (SST v3)

```bash
# From respective app directory
(cd apps/website && sst deploy --stage staging)
(cd apps/website && sst deploy --stage production)
(cd apps/dashboard && sst deploy --stage staging)
```

SST provisions all AWS infrastructure (CloudFront distributions, Lambda@Edge functions, S3 buckets, DynamoDB tables, Cognito user pools, KMS keys, Route 53 records, ACM certificates).

---

## Theme System

The design system in `packages/ui` supports multiple themes. Each theme is self-contained with:

- CSS custom properties (HSL color tokens)
- Light and dark mode token files
- Tailwind v4 integration via two-layer approach: `shared/base.css` maps semantic names to CSS variables; theme-specific `tokens/light.css` and `tokens/dark.css` provide the values
- Dark mode toggled via `.dark` class on `<html>`

Theme entry point: `packages/ui/src/themes/<theme-name>/entry.css`

Full theme specification: `packages/ui/src/themes/THEMES.md`

---

## Development Constraints

The development environment runs on an ARM64 PRoot container (Samsung S24 Ultra → Termux → proot-distro Ubuntu). This imposes specific constraints:

- **Turbopack is disabled** — crashes in PRoot due to symlink handling. Webpack (`next dev`) is used instead.
- **Chromium only** for Playwright — Chrome is not available on ARM64.
- **Dev server hostname** must be `127.0.0.1` — `os.networkInterfaces()` crashes in PRoot.
- **Production server** (`next start`) must run with CWD at `apps/website`, not the project root.
- **Bun** (used by SST internally) requires a `--backend=copyfile` wrapper in PRoot.
