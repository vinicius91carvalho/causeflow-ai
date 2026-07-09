# Workflow Journal

## WI-AC-019 — Clerk middleware: unauthenticated /dashboard redirects to /auth/sign-in

**State:** `implementation=true`

**Summary:**
- Verified AC-019 behavior at real HTTP boundary on port 5181.
- Step 1 (PASS): `GET /dashboard` without session returns 307 to `/auth/sign-in?redirect_url=%2Fdashboard`.
- Step 2 (PASS): Same redirect behavior for `/dashboard/analyses`, `/dashboard/billing`, `/dashboard/integrations` — all return 307 with `redirect_url` preserving the original path.
- Step 3 (PASS): `GET /api/health/detailed` returns 200 without a session (previously returned 401 because the handler used `withAuth`).
- **Fix:** Removed `withAuth` wrapper from `health-detailed-handler.ts` — the handler is now a plain `async function GET()` like the basic `/api/health` handler. The middleware already skips all `/api/` routes, so no middleware change was needed. The handler gracefully degrades to 200 with `{ status: 'degraded', ... }` when the Core API is unavailable.
- Post-fix: `tsc --noEmit` exit 0, `biome check` clean, all 163 dashboard test files pass (1071 tests).
- Black-box: `GET /dashboard` → 307 `/auth/sign-in?redirect_url=%2Fdashboard`; `GET /api/health/detailed` → 200.

---

## QA Verification (WI-AC-019)

**Run by:** qa-agent on 2026-07-09

**Verdict:** `implementation=true, qa=false`

**Checks performed:**

1. **Non-public route redirect (Step 1)** — PASS
   - `GET /dashboard` → 307 `/auth/sign-in?redirect_url=%2Fdashboard`
   - `GET /dashboard/analyses` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fanalyses`
   - `GET /dashboard/billing` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fbilling`
   - `GET /dashboard/settings` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fsettings`

2. **Public API route (Step 3)** — PASS
   - `GET /api/health/detailed` → 200 `{"status":"degraded",...}` (no auth required)
   - `GET /api/health` → 200 (public, no auth required)

3. **Public page routes** — PASS
   - `GET /auth/sign-in` → 200 (public, no redirect)

4. **Code quality** — PASS
   - `tsc --noEmit` exit 0 (12 tasks)
   - Biome lint clean
   - All 163 dashboard test files pass (1071 tests)
   - Dev server runs without errors on port 5181

**Defects found:**

- The sign-in page (`sign-in-page.tsx`) does not consume the `redirect_url` query parameter passed by the middleware. After a successful sign-in, `router.replace('/dashboard')` always redirects to `/dashboard` regardless of the original URL the user was trying to reach. The middleware correctly attaches `?redirect_url=%2F<path>` to the 307, but the sign-in form ignores it. Expected: after sign-in, the user should be redirected to the originally requested URL (e.g., `/dashboard/settings`). Observed: always `/dashboard`. Evidence: line 37 of `sign-in-page.tsx` hard-codes `router.replace('/dashboard')`.

- The middleware uses local JWT auth (`__session` cookie, `decodeJwtPayload`) instead of `clerkMiddleware()` from `@clerk/nextjs/server`. This is an expected consequence of the AC-046 open-source-local-runtime migration and is documented in the project spec as preserving AC-019's redirect behavior. Not counted as a defect.

- `/api/billing/webhook` does not exist in this version of the codebase (no `route.ts` file under `apps/dashboard/src/app/api/billing/webhook/`). The middleware's public-route matcher includes `/api/ingestion/webhook` instead. All `/api/*` routes are skipped by middleware auth anyway, with handler-level auth via `withAuth`. Not counted as a defect.

---

# Workflow Journal

---

## AC Re-verification (WI-AC-019) — redirect_url fix

**Run by:** coding-agent on 2026-07-09

**Verdict:** `implementation=true, qa=true`

**Defect found by QA (now fixed):**
The sign-in page hard-coded `router.replace('/dashboard')` and never read the `redirect_url` query parameter that the middleware sets on the sign-in URL. After a successful sign-in, users always landed on `/dashboard` regardless of the original route they were trying to access.

**Fix (1 edit, 1 file):**
- `apps/dashboard/src/contexts/identity/presentation/pages/sign-in-page.tsx` — replaced hard-coded `/dashboard` with dynamic reading of `redirect_url` from `window.location.search`, with fallback to `/dashboard` when absent. Uses `URLSearchParams` (no new imports, no Suspense boundary needed).

**Verification:**
- `GET /dashboard` → 307 `/auth/sign-in?redirect_url=%2Fdashboard` ✅
- `GET /dashboard/analyses` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fanalyses` ✅
- `GET /api/health/detailed` → 200 ✅
- Sign-in page loads → 200 ✅
- `tsc --noEmit` exit 0 ✅
- `biome check` clean ✅
- All 163 dashboard test files pass (1071 tests) ✅
- Sign-in without redirect_url still falls back to `/dashboard` (backward compatible)

---

## WI-AC-045 — `.env.example` cleanup for open-source-local-runtime

**State:** `implementation=true`

**Summary:**
- Removed `NEXT_PUBLIC_DASHBOARD_URL` from `apps/website/.env.example` — the AC specifies only the two analytics keys (`NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID`) should ship in the website example file.
- Verified `apps/dashboard/.env.example` already ships with only `CORE_API_URL`, `JWT_SECRET`, and optional `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_ID`.
- Verified no `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST-injected vars in either file (AC-045 Step 1 pass).
- Verified docker-compose.yml mounts the same `JWT_SECRET` default for both `causeflow-api` (line 98) and `causeflow-dashboard` (line 171) — `oss-dev-jwt-secret-change-me` matches the .env.example default (AC-045 Step 3 pass).
- Both apps build successfully after the change.

**Previous blocks:** All prior blocks were caused by the pi adapter's credential configuration (nvidia-nim provider key not recognized), not by code defects. With the correct native provider keys in `auth.json`, the implementation completes cleanly.

---

## QA Verification (WI-AC-045)

**Run by:** qa-agent on 2026-07-08

**Verdict:** `implementation=true, qa=true`

**Checks performed:**

1. **apps/website/.env.example** — PASS
   - Contains exactly `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and `NEXT_PUBLIC_CLARITY_ID` (both blank = optional no-op)
   - No `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST vars
   - `LOOPS_API_KEY` is absent (removed per AC)

2. **apps/dashboard/.env.example** — PASS
   - Contains `CORE_API_URL`, `JWT_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID`
   - `CORE_API_URL=http://causeflow-api:5171` matches docker-compose.yml internal network URL
   - `JWT_SECRET=oss-dev-jwt-secret-change-me` matches docker-compose.yml default for both `causeflow-api` and `causeflow-dashboard`
   - No `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST vars

3. **Git tracking** — PASS — Both files tracked and committed as part of WI-AC-045

**Observation (non-blocking):** The project_specs.xml AC-045 description states CORE_API_URL default should be `http://core-api:3099`. The actual docker-compose.yml service is named `causeflow-api` (not `core-api`) and listens on port `5171` internally (port `3099` is the external host binding). The .env.example correctly uses `http://causeflow-api:5171`. This is a spec-text inaccuracy, not a functional defect — the implementation is internally consistent and correct.

---

## WI-AC-004 — Biome 2.4.4 lint+format check exits 0

**State:** `implementation=true`

**Summary (repair 2 — durable fix):**
The previous fix (formatting `feature_list.json` inline) regressed when the harness regenerated the file with multi-line arrays at commit 16733d9. This second repair adds a Biome override that excludes `feature_list.json` from both linter and formatter, making the fix durable against future harness regenerations.

**Root cause:** `feature_list.json` is a harness-generated work-tracking file with 53+ single-element arrays (`["AC-001"]`) written as multi-line (`[\n  "AC-001"\n]`). Biome 2.4.4 JSON formatter requires inline single-element arrays. Since the file is a generated artifact (not source code), the correct approach is to exclude it from Biome checking.

**Change:**
- `web/biome.json` — added override entry for `feature_list.json` that disables linter and formatter (9 lines added). This uses the same pattern as the existing `docs/redesign-review/**` override.

**Verification:**
- `pnpm exec biome check .` exits 0 (76 warnings at `warn` severity, 0 errors)
- `pnpm exec biome check --write .` produces no changes
- Malformed import triggers `assist/source/organizeImports` exit 1
- `--write` auto-fixes malformed imports and exits 0
- No ESLint/Prettier configs exist

---

## WI-AC-050 — SST removed; Dockerfiles; CI workflows updated for open-source-local-runtime

**State:** `implementation=true`

**Summary:**
- Verified `apps/website/sst.config.ts` and `apps/dashboard/sst.config.ts` are already deleted (no `sst.config.*` files exist anywhere in the repo).
- Verified `withSentryConfig(...)` is already removed from `apps/dashboard/next.config.mjs` — export is plain `withNextIntl(nextConfig)` with no Sentry wrapper. `optimizePackageImports`, `headers()`, `redirects()`, `images.remotePatterns`, and `webpack` config are preserved unchanged.
- Both Dockerfiles (`apps/website/Dockerfile`, `apps/dashboard/Dockerfile`) already exist with the multi-stage relay pattern: `builder` stage runs `pnpm install --frozen-lockfile` + `pnpm build`, `runtime` stage runs `pnpm start`.
- Both `.github/workflows/*-deploy.yml` files already have the `sst deploy` step replaced with a Docker-build comment. Added the missing `lint` step to the dashboard workflow (`pnpm turbo lint --filter=@causeflow/dashboard...`) so both workflows keep the full `check-types` / `lint` / `test` / `build` pipeline (AC-050 spec requirement).
- `docker-compose.yml` already references both Dockerfiles (`apps/website/Dockerfile` and `apps/dashboard/Dockerfile`).
- Build (`pnpm turbo build`) exits 0 for all 7 workspace members.
- Dev servers on assigned port 5193 (website) and 5194 (dashboard) both return 200.

---

## QA Verification (WI-AC-050)

**Run by:** qa-agent on 2026-07-08

**Verdict:** `implementation=true, qa=true`

**Checks performed (all PASS):**

1. **sst.config.ts deletion** — PASS
   - `apps/website/sst.config.ts` — file does not exist
   - `apps/dashboard/sst.config.ts` — file does not exist

2. **withSentryConfig removal** — PASS
   - `apps/dashboard/next.config.mjs` — no Sentry import, no `withSentryConfig` wrapper
   - Export is plain `withNextIntl(nextConfig)`
   - `optimizePackageImports`, `headers()`, `redirects()`, `images.remotePatterns` preserved

3. **GitHub Actions workflows** — PASS
   - Both workflows retain `check-types` + `lint` + `test` + `build` steps
   - No `sst deploy` step in either workflow
   - Both have a Docker-build comment pointing operators to `docker compose build`

4. **Multi-stage Dockerfiles** — PASS
   - `apps/website/Dockerfile` — builder stage (pnpm install --frozen-lockfile + pnpm build) + runtime stage (next start)
   - `apps/dashboard/Dockerfile` — same multi-stage pattern

5. **docker-compose.yml references** — PASS
   - `causeflow-website` builds from `apps/website/Dockerfile` (context: `.`, dockerfile: `apps/website/Dockerfile`)
   - `causeflow-dashboard` builds from `apps/dashboard/Dockerfile` (context: `.`, dockerfile: `apps/dashboard/Dockerfile`)

6. **Build verification** — PASS
   - `pnpm install --frozen-lockfile` exits 0
   - `pnpm turbo build --filter=@causeflow/website` exits 0
   - `pnpm turbo build --filter=@causeflow/dashboard` exits 0

7. **Runtime HTTP verification** — PASS
   - Website (port 5193): `/` returns 200; `/product`, `/pricing`, `/security`, `/integrations`, `/use-cases`, `/privacy`, `/terms` all return 200
   - Dashboard (port 5194): `/auth/sign-in` returns 200; `/api/health` returns 200 (public); unauthenticated `/dashboard` returns 307 to `/auth/sign-in`

**Pre-existing issues (outside AC-050 scope):**
- `/from-opsgenie` route returns 404 — the page file does not exist. This is a pre-existing issue in the codebase not related to AC-050.

---

## WI-AC-010 — 9 EN routes + 9 PT-BR routes return 200 with localized content

**State:** `implementation=true`

**Summary:**
- Created missing `/from-opsgenie` route: `apps/website/src/app/[locale]/from-opsgenie/page.tsx` (re-export) and `apps/website/src/contexts/marketing/presentation/pages/from-opsgenie-page.tsx` (page implementation using existing HeroSection, FeatureCard, CallToActionSection components and pre-existing i18n translations).
- All 9 EN routes (/, /product, /security, /integrations, /pricing, /use-cases, /from-opsgenie, /privacy, /terms) return HTTP 200 directly.
- All 9 PT-BR mirrored routes (/pt-br/, /pt-br/product, ... /pt-br/terms) return 200 after following Next.js core 308 trailing-slash redirect (standard framework behavior — `/pt-br/` normalizes to `/pt-br`).
- PT-BR content confirmed: `/pt-br/pricing` contains "Preço" (Portuguese), `/pt-br/from-opsgenie` contains "Migrando do Opsgenie" (Portuguese).

---

## WI-AC-046 — Local JWT auth replaces Clerk

**State:** `implementation=true`

**Summary:**
- Middleware (`apps/dashboard/src/middleware.ts`) no longer imports `clerkMiddleware`. It reads the `__session` httpOnly cookie and decodes the JWT payload (signature verified server-side by `withAuth` via Core whoami). Edge Runtime cannot run `jose`'s compression APIs, so full verification is deferred.
- `with-auth.ts` completely rewritten: extracts the `__session` cookie from the request, calls the Core's `GET /api/v1/auth/me` (whoami) with `Authorization: Bearer <jwt>`, and resolves `userId` + `tenantId` + `role` from the response. Falls back to local JWT claims when Core API is unavailable (mock mode).
- `get-backend-token.ts` rewritten: reads `__session` cookie from request or server-side cookie store (no Clerk dependency).
- Created `lib/auth/session-auth.ts` — server-side JWT verification using `jose` (for Node.js route handlers).
- Created `lib/auth/get-server-auth.ts` — server component helper using `cookies()` from `next/headers`.
- Created `contexts/shared/presentation/components/auth-context.tsx` — client-side `AuthProvider`, `useAuth()`, `useUser()` hooks replacing Clerk's equivalents.
- Sign-in/sign-up pages were already local React forms (no Clerk components).
- `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` already proxy to Core API and set `__session` cookie.
- All Clerk imports removed from source files (20+ files updated).
- `@clerk/nextjs`, `@clerk/themes`, `@clerk/localizations`, `@clerk/testing` removed from `package.json`.
- Clerk optimize entries removed from `next.config.mjs`.
- `clerk-appearance.ts`, `clerk-overrides.css`, `clerk-theme-provider.test.tsx` deleted.
- Topbar rewritten: no `OrganizationSwitcher`/`UserButton` — replaced with local avatar + logout button.
- Server components (integrations page, incident detail, create org, etc.) updated to use local auth helpers.
- Client components (role-guard, team table, approvals list, choose plan, profile tab, use-is-staff, accept invitation, waitlist, team page, settings page) updated to use local auth context.
- API handlers (slack-config, sentry-integration, complete-profile) updated to use `getSessionFromRequest`.
- Test files updated: Clerk mocks replaced with session-auth mocks; topbar tests rewritten for new implementation.
- Build succeeds; dev server serves sign-in (200), sign-up (200); unauthenticated `/dashboard` redirects to `/auth/sign-in` (307).
- All 165 dashboard test files pass (1080 tests).

---

## QA Verification (WI-AC-019) — re-verification after redirect_url fix

**Run by:** qa-agent on 2026-07-09

**Verdict:** `implementation=true, qa=true`

**Checks performed (all PASS):**

1. **Non-public route redirect (Step 1)** — PASS
   - `GET /dashboard` → 307 `/auth/sign-in?redirect_url=%2Fdashboard`

2. **Protected routes (Step 2)** — PASS
   - `GET /dashboard/analyses` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fanalyses`
   - `GET /dashboard/billing` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fbilling`
   - `GET /dashboard/integrations` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fintegrations`
   - `GET /dashboard/settings` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fsettings`
   - `GET /dashboard/team` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Fteam`
   - `GET /dashboard/audit` → 307 `/auth/sign-in?redirect_url=%2Fdashboard%2Faudit`

3. **Public API routes (Step 3)** — PASS
   - `GET /api/health` → 200 `{"status":"ok",...}` (no auth required)
   - `GET /api/health/detailed` → 200 `{"status":"degraded",...}` (no auth required)
   - `GET /auth/sign-in` → 200 (public page, no redirect)
   - `GET /auth/sign-up` → 200 (public page, no redirect)
   - `GET /accept-invitation` → 200 (public page, no redirect)

4. **redirect_url preservation** — PASS
   - POST sign-in reads `redirect_url` from URL query params and redirects there
   - Fallback to `/dashboard` when `redirect_url` is absent

**Defects found:** None.

**Notes:**
- The middleware uses local JWT auth (`__session` cookie, `decodeJwtPayload`) instead of `clerkMiddleware()` from `@clerk/nextjs/server`. This is expected per AC-046 (open-source-local-runtime migration) and documented in the project spec as preserving AC-019's redirect behavior. All behavioral requirements pass.
- `/api/billing/webhook` does not exist as a route in the OSS build — Stripe webhook handling was removed per AC-048/AC-052. The middleware correctly passes all `/api/*` routes through without auth (returns 404 for non-existent routes). This is not a defect.
- Tested against production build (`next build` + `next start` on port 5181) after dev server exhibited compilation hangs on API route first access. Production build compiled cleanly (15.5s) and all routes responded correctly.
