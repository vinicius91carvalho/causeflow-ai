> General engineering methodology (Compound Engineering, Task Workflow, TDD, Context Engineering, Model Assignment, Parallel Execution with Worktrees, Self-Improvement Protocol, Development Rules, Git Workflow, Security Checklist, Performance Targets) lives in `~/.claude/CLAUDE.md`. This file contains CauseFlow-specific configuration only.

---

# CauseFlow AI

AI-powered incident investigation platform for engineering teams (2-50 engineers). Bridges SRE investigation and customer issue resolution.

Competitors: resolve.ai, incident.io, Rootly, IncidentFox.

---

## Documentation

Complete documentation lives in `docs/`. Per-app context in `apps/*/CLAUDE.md`.

| Topic | Location |
|---|---|
| Docs Index | [`docs/README.md`](docs/README.md) |
| Architecture | [`docs/architecture/`](docs/architecture/) |
| Website | [`docs/apps/website/`](docs/apps/website/) + [`apps/website/CLAUDE.md`](apps/website/CLAUDE.md) |
| Dashboard | [`docs/apps/dashboard/`](docs/apps/dashboard/) + [`apps/dashboard/CLAUDE.md`](apps/dashboard/CLAUDE.md) |
| Packages | [`docs/packages/`](docs/packages/) |
| Design System | [`docs/design-system/`](docs/design-system/) — primitives, patterns, foundations, features |
| Deployment | [`docs/deployment/`](docs/deployment/) |
| Development | [`docs/development/`](docs/development/) |
| Solutions | [`docs/solutions/`](docs/solutions/) |

### Documentation Update Rules (Phase 6 trigger)

After every task, evaluate whether documentation needs updating. This is part of Phase 6 and is NOT optional.

| Change Type | Action Required |
|---|---|
| New route added | Update Routes section in CLAUDE.md + `docs/apps/<app>/` |
| New component/package | Update Monorepo Structure + relevant package docs |
| Architecture change | Update `docs/architecture/` |
| New environment variable | Update Environment Files section |
| New command/script | Update Commands section |
| Dependency added/removed | Update Tech Stack table if significant |
| New pattern established | Create `docs/solutions/` entry |
| Deployment process changed | Update `docs/deployment/` |
| Bug class eliminated | Add prevention rule to `session-learnings.md` |
| Performance optimization found | Document in `docs/solutions/` with benchmarks |
| Security pattern established | Document in `docs/solutions/` + Security Checklist |

---

## Solutions Library

The `docs/solutions/` directory is the project's institutional memory. Every solved problem becomes searchable documentation that future tasks can reference.

### Structure

```
docs/solutions/
├── infrastructure/
│   ├── 2026-02-28_proot-turbopack-workaround.md
│   ├── 2026-02-28_playwright-arm64-chromium.md
│   ├── 2026-02-28_sst-proot-bun-wrapper.md
│   ├── 2026-02-28_next-dev-hostname-crash.md
│   └── 2026-02-28_next-start-cwd-requirement.md
├── patterns/
│   ├── 2026-02-28_env-local-standard.md
│   ├── 2026-02-28_staging-auth-cookie-gate.md
│   ├── 2026-02-28_fail-safe-auth-defaulting.md
│   ├── 2026-02-28_dashboard-url-constant.md
│   ├── 2026-03-03_stripe-subscription-integration.md
│   ├── 2026-03-04_bounded-contexts-nextjs-refactoring.md
│   ├── 2026-07-11_oss-playwright-dashboard-e2e.md
│   ├── 2026-07-11_oss-incident-create-sse.md
│   └── 2026-07-11_oss-llm-connector-settings.md
├── bugfixes/
│   ├── 2026-02-28_cognito-secrethash.md
│   ├── 2026-02-28_sst-opennext-header-renaming.md
│   ├── 2026-02-28_playwright-controlled-inputs.md
│   └── 2026-02-28_tabslist-h-auto-overflow.md
├── security/
│   └── 2026-02-28_csp-header-configuration.md
└── performance/
```

Solution doc template and rules are in `~/.claude/CLAUDE.md` under "Solutions Library".

---

## Session Learnings

For multi-task workflows, create or read the session learnings file before starting:

```
/root/.claude/projects/-root-projects-causeflow-ai/memory/session-learnings.md
```

This is the **living memory** that survives `/compact`. Write to it continuously. After compaction, re-read immediately to restore context.

See `~/.claude/CLAUDE.md` for session learnings vs solutions library comparison and promotion rules.

---

## Task File Location

- **Location:** `docs/tasks/<app>/<category>/YYYY-MM-DD_HHmm-descriptive-name.md`
- **Apps:** `website`, `dashboard`
- **Categories:** `build`, `testing`, `infrastructure`, `design`, `deployment`, `bugfix`
- **Example:** `docs/tasks/website/build/2026-02-22_1430-homepage-redesign.md`

---

## Tech Stack

| Tool | Details |
|---|---|
| Package Manager | pnpm (workspaces) — `npm` and `npx` are **forbidden** |
| Build Orchestration | Turborepo (`turbo`) — caches build, test, lint, check-types |
| Linting & Formatting | Biome (`biome.json`) — replaces ESLint + Prettier |
| Dev Bundler | Webpack (`next dev`) — Turbopack crashes in PRoot |
| Unit/Integration Tests | Vitest (root `vitest.config.ts`) |
| E2E Tests | Playwright (chromium only, 4 viewports) |
| Framework | Next.js (App Router, SSG for website / SSR for dashboard) |
| Styling | Tailwind CSS + Shadcn/ui |
| Language | TypeScript (strict mode) |
| Hosting | SST on AWS |
| Analytics | Google Analytics 4 + Microsoft Clarity |
| Forms | Loops.so + Zod validation |
| i18n | next-intl (EN default, PT-BR secondary) |
| Observability | Sentry (dashboard only) — `@sentry/nextjs` via `instrumentation*.ts` + `withSentryConfig` in `next.config.mjs` |
| Domain | causeflow.ai (website), dashboard.causeflow.ai (dashboard prod), dashboard-staging.causeflow.ai (dashboard staging) |

---

## Monorepo Structure

```
causeflow-ai/
├── apps/
│   ├── website/             # Next.js — marketing site (SSG)
│   │   └── src/
│   │       ├── app/         # Thin re-exports only (no business logic)
│   │       ├── contexts/    # Bounded contexts: marketing, engagement, legal, shell
│   │       │   └── <name>/  # Each context uses DDD layers:
│   │       │       ├── domain/              # Pure types — no framework imports
│   │       │       ├── infrastructure/      # APIs, i18n/ (en.json, pt-br.json)
│   │       │       ├── presentation/        # React components + pages
│   │       │       │   ├── pages/           # Page implementations (server components)
│   │       │       │   └── components/
│   │       │       └── api/                 # API route handler implementations
│   │       └── lib/         # Shared infrastructure: metadata, rate-limit, i18n/compose.ts
│   └── dashboard/           # Next.js — product app (SSR, Clerk auth, Sentry)
│       └── src/
│           ├── app/         # Thin route orchestrators + API routes
│           ├── contexts/    # Bounded contexts: investigation, approvals, audit,
│           │   │            #   identity, team, integrations, billing, settings, shared
│           │   └── <name>/  # Each context uses DDD layers:
│           │       ├── domain/              # Pure types, RBAC (identity only)
│           │       ├── application/         # Use cases, service orchestration
│           │       ├── infrastructure/      # Repositories, schemas, i18n/ (en.json, pt-br.json)
│           │       ├── presentation/        # React components
│           │       │   └── components/
│           │       └── lib/                 # Special exception (identity auth configs only)
│           └── lib/         # Shared infrastructure: db/client, api/with-auth, rate-limit,
│                            #   i18n/compose.ts
├── packages/
│   ├── shared/              # Types, utils, constants, i18n keys
│   ├── ui/                  # Reusable UI components (design system)
│   ├── analytics/           # GA4, Microsoft Clarity, tracking events
│   ├── auth/                # Legacy Auth.js v5 + Cognito wrapper — dashboard migrated to Clerk; retained for reference, not used at runtime
│   └── forms/               # Form logic and validation
├── docs/
│   ├── solutions/           # Compound knowledge base (searchable solved problems)
│   ├── tasks/               # Task files with checklists and learnings
│   └── ...                  # Architecture, app docs, packages, deployment, development
├── pnpm-workspace.yaml
├── package.json             # Root scripts & shared devDependencies
└── tsconfig.base.json
```

**DDD Layers** per context: `domain/` → `application/` → `infrastructure/` → `presentation/`. Only create layers the context needs. Layer dependency rule: domain has no imports; each higher layer may import from lower layers only.

**i18n**: Each context owns its translations at `infrastructure/i18n/`. A composer at `lib/i18n/compose.ts` deep-merges all context files into a single next-intl message tree.

**Bounded Contexts** per app: Feature code lives in `src/contexts/<name>/`. Route files are thin orchestrators. Cross-context imports use direct deep paths (context `index.ts` barrels have been removed). See [`docs/architecture/bounded-contexts.md`](docs/architecture/bounded-contexts.md) for the full reference.

---

## Environment URLs

| Environment | Website | Dashboard |
|---|---|---|
| Production | `https://causeflow.ai` | `https://dashboard.causeflow.ai` |
| Staging | `https://staging.causeflow.ai` | `https://dashboard-staging.causeflow.ai` |
| Local Dev | `http://localhost:3000` | `http://localhost:3001` |

---

## Environment Files

- Use `.env.local` for local configuration — this is the project standard
- SST injects stage-specific env vars at deploy time via `sst.config.ts`
- `.env.staging` and `.env.production` do NOT exist — never search for them
- Staging password: `causeflow-staging-2026` (set in sst.config.ts)

---

## Commands

```bash
pnpm turbo build              # Build all (cached)
pnpm turbo test               # Vitest all (cached)
pnpm turbo dev                # Dev servers (Webpack)
pnpm turbo lint               # Biome lint all
pnpm turbo check-types        # TypeScript check
pnpm exec biome check .       # Lint + format check
pnpm exec biome check --write . # Auto-fix lint + format
pnpm vitest run --coverage    # Tests with coverage
```

---

## Execution Config

Used by `/ship-test-ensure` and other pipeline skills.

```yaml
build_command: "pnpm turbo build"
test_command: "pnpm turbo test"
lint_command: "pnpm exec biome check ."
typecheck_command: "pnpm turbo check-types"
kill_command: "pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null"
e2e_command: "pnpm exec playwright test tests/"
package_manager: "pnpm"

github_repo: "causeflow/web"

staging_urls:
  - name: "Website"
    url: "https://staging.causeflow.ai"
  - name: "Dashboard"
    url: "https://dashboard-staging.causeflow.ai"

production_urls:
  - name: "Website"
    url: "https://causeflow.ai"
  - name: "Dashboard"
    url: "https://dashboard.causeflow.ai"

staging_credentials:
  env_var: "STAGING_PASSWORD=causeflow-staging-2026"

deploy_commands:
  staging_trigger: "auto"
  production:
    - name: "Website Deploy"
      command: 'gh workflow run "Website Deploy" --repo causeflow/web -f stage=production'
    - name: "Dashboard Deploy"
      command: 'gh workflow run "Dashboard Deploy" --repo causeflow/web -f stage=production'

app_detection_paths:
  - name: "website"
    paths: ["apps/website/", "packages/shared/", "packages/ui/", "packages/analytics/", "packages/forms/"]
  - name: "dashboard"
    paths: ["apps/dashboard/", "packages/shared/"]

pages_to_audit:
  - "https://causeflow.ai/"
  - "https://causeflow.ai/product"
  - "https://causeflow.ai/security"
  - "https://causeflow.ai/integrations"
  - "https://causeflow.ai/pricing"
  - "https://causeflow.ai/use-cases"
  - "https://causeflow.ai/privacy"
  - "https://causeflow.ai/terms"
```

---

## Strict Project Rules

1. **Zero NPM/NPX:** Use `pnpm` and `pnpm dlx` exclusively. Exception: Playwright — use `pnpm exec playwright`, never `pnpm dlx playwright`.
2. **Use agents and subagents** for parallel independent tasks. They reduce main context usage and speed up work. See `~/.claude/CLAUDE.md` for Context Engineering and Model Assignment details.
3. **Kill before starting:** Before any test or server start, kill existing Next.js/Playwright processes: `pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f playwright 2>/dev/null`
4. **Before committing:** Run `pnpm exec biome check .` to catch lint/format issues.
5. **MANDATORY:** After finishing implementation, run the dev server (`pnpm turbo dev`) and test the features you fixed or implemented to ensure there are no errors on the server side or front-end side.
6. **MANDATORY:** If a feature cannot be implemented entirely within the current plan, notify the user at the end and add it to the plan as pending tasks.
7. **MANDATORY for dashboard changes:** Follow the [Verification Protocol for Dashboard Changes](apps/dashboard/CLAUDE.md#verification-protocol-for-dashboard-changes) — Playwright on localhost, `aws logs tail /ecs/causeflow-staging-api --follow` against staging, ask the user before relying on any manual external setup (Sentry, OAuth apps, etc.), and ship a Playwright spec with the PR. Bugs have shipped because flows were not visually verified — this is non-negotiable.

---

## Routes (EN default)

```
/                    Homepage
/product             Product / How It Works
/security            Security
/integrations        Integrations
/pricing             Pricing
/use-cases           Use Cases
/from-opsgenie       Opsgenie Migration
/privacy             Privacy Policy
/terms               Terms of Service
```

PT-BR mirrors all routes with `/pt-br/` prefix.

---

## i18n

- English default (no prefix), Portuguese at `/pt-br/` prefix
- hreflang tags on every page
- Language selector in header

---

## Import Conventions

- **Ordering:** Handled by Biome — run `pnpm exec biome check --write .` to auto-sort
- **Path aliases:** Use `@/` for app-internal imports (configured in each app's `tsconfig.json`)
- **Package imports:** Use package names (`@causeflow/shared`, `@causeflow/ui`), never relative paths across package boundaries
- **No barrel file re-exports** unless the package explicitly defines a public API in its `index.ts`
- **No context barrel imports:** Context `index.ts` barrel files have been removed from both apps. Always use direct deep paths to the specific file (e.g., `@/contexts/engagement/presentation/components/dashboard-demo-modal`, `@/contexts/investigation/domain/types`). Barrel imports force Webpack to parse entire context trees, severely slowing dev compilation.
- **No `lib/db/` in dashboard:** directory removed entirely. Dashboard owns no storage — all data flows through the Core API (`CORE_API_URL`). Import types from `@/contexts/<name>/domain/types` and call the Core API via `@/lib/api/http-api-client`.

---

## Theme System

Themes live in `packages/ui/src/themes/`. Each theme is self-contained with tokens (HSL CSS variables), animations, fonts, and images. Entry point: `entry.css`. Uses two-layer Tailwind v4 approach: `shared/base.css` maps semantic names (`--color-primary`) to CSS vars, theme-specific `tokens/light.css` and `dark.css` set the values. Dark mode via `.dark` class on `<html>`.

See `./packages/ui/src/themes/THEMES.md` for full spec (folder structure, creating new themes, variable reference).

---

## Playwright Test Suite

- **Test files:** `tests/audit.spec.ts` (SEO, A11y, Infrastructure), `tests/visual-functional.spec.ts` (Visual/Functional checks)
- **OSS compose E2E (AC-054):** `tests/oss/` — project `dashboard-oss-e2e` targets compose dashboard `:3001` + Core `:3099` with Core local register/login (no Clerk, no `.env.staging` STAGING_TEST_USER, no `page.route` mocks of `/api/integrations/*` or `/api/incidents*` as the pass path). Includes AC-059 LLM connector settings (`tests/oss/ac-059-llm-connector.spec.ts`). Command: `pnpm exec playwright test --project=dashboard-oss-e2e`
- **Config:** `playwright.config.ts` at project root
- **Settings:** `workers: 3`, `fullyParallel: true`, `trace/video/screenshot: 'off'`
- **Locales:** English-only by default. Set `TEST_LOCALES=en,pt-br` for Portuguese.
- **Network:** `test.beforeEach` blocks analytics/tracker domains (GA, Microsoft Clarity, Clarity, Intercom)
- **No hardcoded waits:** Use `await expect(locator('main')).toBeVisible()` and `waitUntil: 'domcontentloaded'`
- **Run:** `pnpm exec playwright test tests/audit.spec.ts` (server auto-starts via `webServer` config)
- **Test convention:** `*.test.ts` / `*.test.tsx` colocated next to source files (for Vitest)
- **Screenshots:** Always put screenshots into the `./screenshots` folder

---

## Environment (PRoot/ARM64 Container)

**Device:** Samsung S24 Ultra in Dex mode → Termux → proot-distro Ubuntu

- **Turbopack:** Crashes in PRoot with "Invalid symlink". Use Webpack (`next dev`). `dev:turbopack` exists for native systems only.
- **Dev server:** Always use `next dev --hostname localhost` (Clerk requires `localhost`, not `127.0.0.1`; plain `next dev` crashes on `os.networkInterfaces()` in PRoot)
- **Production server:** `next start -H localhost` — must run with CWD at `apps/website`, not project root
- **Ports:** Dev uses 3000, production uses 3000. Always verify port is free.
- **Playwright browser:** chromium ONLY. Chrome is NOT available on arm64. Use `pnpm exec playwright test` (never `pnpm dlx`).

---

## Docs Imports

@docs/README.md
@docs/design-system/README.md
