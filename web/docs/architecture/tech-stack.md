# CauseFlow AI Tech Stack Reference

This document is the authoritative reference for every technology used in CauseFlow AI. Each entry includes the version, rationale, configuration file(s), and relationships to other tools.

---

## Package Management & Workspace

### pnpm 10.30.1

**Rationale:** Faster installs than npm/yarn via content-addressable store. Native workspace support with strict dependency isolation — packages cannot accidentally import unlisted dependencies. Disk-efficient on shared CI runners.

**Configuration:** `pnpm-workspace.yaml` (workspace root), `.npmrc` (hoisting rules)

**Rules:** `npm` and `npx` are forbidden project-wide. Use `pnpm` and `pnpm dlx` for everything. Exception: Playwright — use `pnpm exec playwright` (never `pnpm dlx playwright`, which downloads a conflicting version).

**Relationship:** pnpm is the foundation. Turborepo, Biome, and all tooling run through pnpm scripts.

---

## Build Orchestration

### Turborepo 2.8.10

**Rationale:** Task graph execution with remote and local caching. Runs `build`, `test`, `lint`, `check-types` across all packages in dependency order. Skips unchanged packages using content hashing. Supports parallelism where tasks are independent.

**Configuration:** `turbo.json` at project root

**Pipeline tasks defined:**
- `build` — depends on upstream `build`, outputs `.next/**`, `dist/**`
- `test` — depends on upstream `build`
- `lint` — no dependencies, runs in parallel
- `check-types` — depends on upstream `build`
- `dev` — persistent, no caching

**Relationship:** Wraps pnpm scripts. All `pnpm turbo <task>` commands are the standard way to run cross-package operations. Direct `pnpm --filter` is used only when targeting a single package.

---

## Language

### TypeScript 5.7.0

**Rationale:** Static typing prevents entire categories of runtime errors. Required for Shadcn/ui component generation, Auth.js type augmentation, and Next.js page/layout type safety.

**Configuration:**
- `tsconfig.base.json` — root base config (strict mode, path aliases, module resolution)
- `apps/website/tsconfig.json` — extends base, adds Next.js plugin
- `apps/dashboard/tsconfig.json` — extends base, adds Next.js plugin
- `packages/*/tsconfig.json` — extends base per package

**Key settings:** `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: bundler`

**Relationship:** All packages and apps use TypeScript. Biome type-checks using `tsconfig.json`. Turborepo's `check-types` task runs `tsc --noEmit` per package.

---

## Linting & Formatting

### Biome 2.4.4

**Rationale:** Replaces ESLint and Prettier with a single Rust-based tool. Dramatically faster than JavaScript-based linting. Unified configuration eliminates conflicts between a linter and a formatter. No plugin ecosystem fragmentation.

**Configuration:** `biome.json` at project root (single config for the entire monorepo)

**Key configuration notes:**
- Valid rule domains: `react`, `test`, `solid`, `next`, `qwik`, `vue`, `project`, `tailwind`, `turborepo`, `playwright`, `types` — NOT `"accessibility"`
- `organizeImports` lives under `assist.actions.source.organizeImports`
- CSS Tailwind directives require `css.parser.tailwindDirectives: true`

**Commands:**
```bash
pnpm exec biome check .           # Lint + format check (CI)
pnpm exec biome check --write .   # Auto-fix lint + format
```

**Relationship:** Replaces ESLint + Prettier entirely. Turborepo's `lint` task calls Biome. Pre-commit hooks run Biome before commits.

---

## Framework

### Next.js 15.2.0

**Rationale:** App Router provides React Server Components (RSC), streaming, and built-in layouts — essential for the dashboard's SSR data fetching pattern. SSG support covers the website's static content requirements. Single framework for both apps reduces cognitive overhead.

**Configuration:**
- `apps/website/next.config.mjs` — `transpilePackages`, security headers, image domains, redirects
- `apps/dashboard/next.config.mjs` — `transpilePackages`, security headers, auth middleware integration

**Website rendering strategy:** SSG — all pages statically generated at build time and served by the website container.

**Dashboard rendering strategy:** SSR — pages rendered server-side with data fetched from the Core API. The dashboard owns no product database.

**Dev server constraint:** Must use `--hostname 127.0.0.1` in PRoot containers. Turbopack (`--turbo`) crashes in PRoot — Webpack is used instead.

**Production server constraint:** `next start` must run with CWD at `apps/website` or `apps/dashboard`, not the project root.

**Relationship:** Next.js consumes packages from `ui`, `shared`, `analytics`, `auth`, and `forms`. The apps ship as Docker images for the OSS runtime and hosted deployments.

---

## Styling

### Tailwind CSS 4.0

**Rationale:** Utility-first CSS eliminates stylesheet bloat and naming overhead. v4 uses a CSS-native configuration (`@theme`) instead of `tailwind.config.js`, enabling better IDE tooling and build performance. Tree-shaking ensures minimal final bundle size.

**Configuration:** Configured inline within CSS entry files using `@import "tailwindcss"` and `@theme` blocks.

**Relationship:** Works with Biome (Tailwind class sorting), Shadcn/ui (utility-based component variants), and the theme system (CSS custom property tokens consumed by Tailwind utilities).

### Shadcn/ui (Radix primitives)

**Rationale:** Accessible, unstyled Radix UI primitives with Tailwind-based styling. Components are copied into the codebase (not installed as a dependency), so they are fully customizable without forking a library. Built-in ARIA patterns cover keyboard navigation and screen reader requirements.

**Location:** `packages/ui/src/components/`

**Configuration:** `packages/ui/components.json` (Shadcn CLI config — registry, paths, aliases)

**Relationship:** Built on Radix UI primitives. Styled with Tailwind CSS. All components consumed by `apps/website` and `apps/dashboard` via the `ui` package.

### Theme System

**Architecture:** Two-layer Tailwind v4 approach. `packages/ui/src/themes/shared/base.css` maps semantic names (`--color-primary`, `--color-background`) to CSS variables. Theme-specific token files (`tokens/light.css`, `tokens/dark.css`) set the actual values per theme.

**Dark mode:** Toggled via `.dark` class on `<html>` element.

**Location:** `packages/ui/src/themes/`

**Spec:** `packages/ui/src/themes/THEMES.md`

---

## Testing

### Vitest 4.0.18

**Rationale:** Native ESM support without transform overhead. Compatible with the same assertion APIs as Jest (`.toBe`, `.toEqual`, etc.) so migration is friction-free. Faster than Jest in watch mode. Integrates with `@testing-library/react` for component tests.

**Configuration:** `vitest.config.ts` at project root

**Test projects (7 total):**
| Project | Path |
|---|---|
| shared | `packages/shared` |
| forms | `packages/forms` |
| analytics | `packages/analytics` |
| auth | `packages/auth` |
| ui | `packages/ui` |
| website | `apps/website` |
| dashboard | `apps/dashboard` |

**Pool settings:** `forks`, max 3 workers (memory-constrained ARM64 container)

**Dashboard timeout:** 15 seconds per test (AWS SDK heavy imports)

**Test convention:** `*.test.ts` / `*.test.tsx` files co-located next to source files

**Commands:**
```bash
pnpm vitest run --coverage            # All tests with coverage
pnpm vitest run --project website     # Single project
pnpm turbo test                       # Via Turborepo (cached)
```

**Relationship:** Turborepo's `test` task runs Vitest. Coverage reports fed to CI.

### Playwright 1.58.2

**Rationale:** Cross-browser E2E testing with first-class TypeScript support. Reliable auto-waiting eliminates flaky tests from hardcoded sleeps. Built-in trace viewer and screenshot capture aid debugging. Official chromium binaries available on ARM64.

**Configuration:** `playwright.config.ts` at project root

**Browser:** Chromium only (Chrome not available on ARM64/PRoot)

**Viewports:**
| Name | Width |
|---|---|
| mobile | 375px |
| tablet | 768px |
| desktop | 1280px |
| wide | 1440px |

**Test files:**
- `tests/audit.spec.ts` — SEO, accessibility, infrastructure checks
- `tests/visual-functional.spec.ts` — Visual and functional checks

**Settings:** `workers: 3`, `fullyParallel: true`, `trace/video/screenshot: 'off'`

**Network blocking:** `test.beforeEach` blocks analytics/tracker domains (GA4, Microsoft Clarity, Intercom)

**Locales:** English only by default. Set `TEST_LOCALES=en,pt-br` for Portuguese.

**Screenshots:** Saved to `./screenshots/` folder

**Commands:**
```bash
pnpm exec playwright test                            # All E2E tests
pnpm exec playwright test tests/audit.spec.ts        # Specific file
BASE_URL=http://127.0.0.1:4000 pnpm exec playwright test  # Custom base URL
```

**Relationship:** Playwright uses `webServer` config to auto-start the production Next.js server before tests. Never use `pnpm dlx playwright` — it downloads a conflicting version.

---

## Authentication

### Local JWT Auth

**Rationale:** The OSS runtime must boot without Clerk, Cognito, AWS, or any paid
identity provider. Core signs local JWTs with `JWT_SECRET`; the dashboard stores
the token in the `__session` cookie and verifies it through Core `/v1/auth/me`.

**Configuration:** `apps/dashboard/.env.example` (`JWT_SECRET`,
`CAUSEFLOW_RUNTIME=oss`) and Core `.env.example` must use the same secret.

**Relationship:** `apps/dashboard/src/middleware.ts` and
`src/lib/api/with-auth.ts` protect routes/API handlers. Hosted deployments can
still use Core-issued tokens backed by Clerk, but the dashboard does not own the
identity provider.

---

## Data Access

### Core API Client

**Rationale:** The dashboard is a BFF/UI over Core. Product data, tenant
records, incidents, integrations, audit entries, billing state, and secrets are
owned by Core.

**Configuration:** `CORE_API_URL` points to Core. Blank local dev uses
`mock-api-client.ts`; Docker uses `http://causeflow-api:5171`.

**Relationship:** `src/lib/api/http-api-client.ts` calls Core with the current
session token. `src/lib/api/mock-api-client.ts` supports app-only development.

---

## Infrastructure & Hosting

### Docker

**Rationale:** The OSS runtime must run locally with one command and no cloud
dependencies. Docker Compose starts Core, worker, Postgres, Redis, Hindsight,
the website, and the dashboard.

**Configuration:**
- `docker-compose.yml` — full OSS stack
- `apps/website/Dockerfile` — website image
- `apps/dashboard/Dockerfile` — dashboard image

**Build commands:**
```bash
docker compose up -d
docker compose build causeflow-website causeflow-dashboard
```

**Relationship:** Hosted deployments build the same app Dockerfiles through
GitHub Actions.

### CloudFront + WAF

**Rationale:** Global CDN for static website assets. Sub-10ms cache hits worldwide. WAF provides rate limiting, IP-based rules, and bot detection without application-level code changes.

**Relationship:** CloudFront is provisioned by SST. WAF attached to the CloudFront distribution for the website. Dashboard CloudFront distribution fronts Lambda@Edge.

### Route 53 + ACM

**Hosted zone:** Z01593322DGY9I94W9S7C (NS delegated from GoDaddy)

**SSL certificates:** Amazon ACM auto-managed, auto-renewed. Valid until Sep 2026.

**Domains managed:**
- causeflow.ai (website production)
- staging.causeflow.ai (website staging)
- dashboard.causeflow.ai (dashboard production)
- dashboard-staging.causeflow.ai (dashboard staging)

---

## Analytics

### Google Analytics 4

**Rationale:** Industry-standard web analytics. Free tier covers CauseFlow's scale. Custom event tracking for conversion funnel analysis (sign-up button clicks, pricing page interactions).

**Configuration:** Measurement ID set in root `.env.local` (`NEXT_PUBLIC_GA4_ID`)

**Implementation:** `packages/analytics/src/` — tracking events abstracted behind a typed API so the underlying provider can be swapped without touching app code.

**Relationship:** Loaded in both `apps/website` and `apps/dashboard`. Playwright tests block GA4 requests to prevent test traffic from polluting production metrics.

### Microsoft Clarity

**Rationale:** Session recording and heatmaps for UX analysis. Free tier. Complements GA4 quantitative data with qualitative user behavior insights.

**Configuration:** Project ID set in root `.env.local` (`NEXT_PUBLIC_CLARITY_ID`)

**Relationship:** Same analytics package as GA4. Playwright tests block Clarity requests.

---

## Internationalisation

### next-intl

**Rationale:** First-class Next.js App Router integration. Server-component compatible (no client-side bundle overhead for static translations). Type-safe message keys. Handles locale detection, routing, and `hreflang` metadata.

**Configuration:**
- `apps/website/src/i18n/request.ts` — locale detection and message loading
- Message files: `packages/shared/src/infrastructure/i18n/messages/en.json`, `pt-br.json`

**Routing:**
- English: no prefix (default locale) — `/pricing`, `/product`, etc.
- Portuguese: `/pt-br/` prefix — `/pt-br/pricing`, `/pt-br/product`, etc.

**Title template:** `'%s | CauseFlow AI'` — adds 15 characters; keep page title ≤ 55 chars to stay within 70-char SEO limit.

**Helper:** `generatePageMetadata` at `apps/website/src/lib/metadata.ts`

---

## Forms

### Zod

**Rationale:** Runtime schema validation with TypeScript type inference. Define the schema once, get both the type and the validator. Works on both client and server — same schema validates form input client-side and sanitizes data server-side.

**Relationship:** Used in `packages/forms` for all form schemas. Consumed by `apps/website` contact and waitlist forms.

## CI/CD

### GitHub Actions

**Configuration:**
- `.github/workflows/website-deploy.yml` — build, test, deploy website to staging and production
- `.github/workflows/dashboard-deploy.yml` — build, test, deploy dashboard to staging

**Relationship:** Calls pnpm + Turborepo commands, builds the app Dockerfiles,
and deploys hosted environments.

---

## Tool Relationship Summary

```
pnpm (package manager)
  └── Turborepo (task orchestration + caching)
        ├── TypeScript tsc (type checking)
        ├── Biome (lint + format — replaces ESLint + Prettier)
        ├── Vitest (unit + integration tests)
        └── Next.js build
              ├── Tailwind CSS 4 (styling)
              ├── Shadcn/ui → Radix primitives (components)
              ├── next-intl (i18n)
              ├── local JWT middleware (auth, dashboard)
              └── Core API client (data, dashboard)

Docker Compose (OSS runtime)
  ├── causeflow-website
  ├── causeflow-dashboard
  ├── causeflow-api / worker
  ├── Postgres / Redis
  └── Hindsight

Playwright (E2E tests — runs against deployed or local Next.js)
GA4 + Clarity (analytics — loaded in both apps, blocked in tests)
```

---

## Forbidden Tools

The following tools are explicitly forbidden in this project:

| Forbidden | Use Instead | Reason |
|---|---|---|
| `npm` | `pnpm` | Workspace hoisting inconsistencies |
| `npx` | `pnpm dlx` or `pnpm exec` | Resolves wrong binary versions |
| `pnpm dlx playwright` | `pnpm exec playwright` | Dlx downloads a conflicting Playwright version |
| ESLint | Biome | Replaced — running both causes conflicts |
| Prettier | Biome | Replaced — running both causes conflicts |
| Turbopack (`--turbo`) | Webpack (`next dev`) | Crashes in PRoot/ARM64 containers |
