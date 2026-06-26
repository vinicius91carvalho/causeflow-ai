# Phase 1: Dashboard App Scaffold & Layout

## Phase 1.1: Research & Setup
- [x] Study the website app structure (`apps/website/`) — package.json, tsconfig, next.config.mjs, layout patterns
- [x] Study shared packages integration — how website imports from @causeflow/ui, @causeflow/shared, @causeflow/analytics, @causeflow/forms
- [x] Study theme system integration — how website uses ThemeProvider, entry.css, dark mode
- [x] Study i18n setup — how website configures next-intl, message loading, routing

## Phase 1.2: Create Dashboard App
- [x] Create `apps/dashboard/` directory structure following Next.js 15 App Router conventions
- [x] Create `apps/dashboard/package.json` with dependencies (next, react, typescript, workspace packages)
- [x] Create `apps/dashboard/tsconfig.json` extending base config
- [x] Create `apps/dashboard/next.config.mjs` configured for SSR (not SSG like website)
- [x] Create `apps/dashboard/tailwind.config.ts` or CSS config for Tailwind v4
- [x] Add dashboard to Turbo pipeline in `turbo.json` if needed
- [x] Verify `pnpm install` resolves all workspace dependencies

## Phase 1.3: Configure i18n
- [x] Create `apps/dashboard/src/i18n/` directory with routing.ts, request.ts, navigation.ts
- [x] Set up next-intl middleware for EN (default) + PT-BR
- [x] Create `apps/dashboard/src/middleware.ts` with i18n routing (auth will be added in Phase 2)
- [x] Extend `@causeflow/shared` i18n messages with dashboard-specific keys (dashboard.sidebar.*, dashboard.topbar.*, etc.)

## Phase 1.4: Build Dashboard Layout (Mobile First)
- [x] Create `apps/dashboard/src/app/[locale]/layout.tsx` — root layout with ThemeProvider, fonts, metadata
- [x] Create `apps/dashboard/src/app/[locale]/globals.css` importing theme entry.css
- [x] Create Sidebar component — collapsible, responsive, with navigation items:
  - Overview, Analyses, Integrations, Team, Settings
  - Credits/Usage badge at bottom
  - Collapse toggle (hamburger on mobile, chevron on desktop)
- [x] Create Topbar component — logo, breadcrumbs placeholder, theme toggle, user menu placeholder
- [x] Create DashboardLayout wrapper combining sidebar + topbar + main content area
- [x] Mobile layout: sidebar hidden by default, hamburger menu in topbar to toggle
- [x] Tablet layout: sidebar collapsed (icons only), expandable
- [x] Desktop layout: sidebar expanded by default, collapsible
- [x] Wide desktop: same as desktop with wider content area
- [x] Integrate ThemeProvider from @causeflow/ui (light/dark toggle in topbar)

## Phase 1.5: Create Placeholder Routes
- [x] Create `/dashboard` (Overview) page with placeholder content
- [x] Create `/dashboard/analyses` page with placeholder content
- [x] Create `/dashboard/analyses/new` page with placeholder content
- [x] Create `/dashboard/integrations` page with placeholder content
- [x] Create `/dashboard/team` page with placeholder content
- [x] Create `/dashboard/settings` page with placeholder content
- [x] Root route `/` redirects to `/dashboard`
- [x] Verify all navigation links work in sidebar

## Phase 1.6: Testing Setup
- [x] Add dashboard as Vitest project in root `vitest.config.ts`
- [x] Create a basic smoke test for the dashboard layout component
- [x] Extend Playwright config with dashboard webServer (port 3001)
- [x] Create basic E2E test: navigate to dashboard, verify sidebar and topbar render

## Phase 1.7: SST Skeleton
- [x] Create `apps/dashboard/sst.config.ts` skeleton for `dashboard.causeflow.ai` deployment
- [x] Configure for SSR (Lambda + CloudFront, not static)

## Phase 1.8: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (dashboard files: 0 errors; pre-existing website errors unchanged)
- [x] Run `pnpm turbo check-types` — zero type errors (12/12 tasks successful)
- [x] Run dev server on port 3001 — dashboard loads with sidebar, topbar, and theme toggle
- [x] Verify dark mode toggle works
- [x] Verify responsive layout (mobile, tablet, desktop)
- [x] Remove unused code/imports
