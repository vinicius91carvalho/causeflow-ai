# Phase 5: Dashboard Home & Metrics

## Phase 5.1: Research & Setup
- [x] Study existing dashboard overview page placeholder (`apps/dashboard/src/app/[locale]/dashboard/page.tsx`)
- [x] Study the metrics API route (`apps/dashboard/src/app/api/metrics/route.ts`) for available data
- [x] Study the analysis repository for count/listing methods
- [x] Study the theme tokens and existing component patterns for consistency
- [x] Study the i18n messages structure for dashboard namespace

## Phase 5.2: Metrics Cards
- [x] Create `apps/dashboard/src/components/dashboard/metrics-card.tsx`:
  - Reusable card component with icon, label, value, optional trend indicator
  - Supports loading skeleton state
  - Responsive: 1 col mobile, 2 col tablet, 4 col desktop
- [x] Create metrics cards section in dashboard overview page:
  - Total Analyses (all-time count) — with chart icon
  - Analyses This Month (current month count) — with calendar icon
  - Active Integrations (connected count) — with plug icon
  - Team Members (count) — with users icon
- [x] Fetch metrics data from `/api/metrics` using server component or client fetch
- [x] Add loading skeletons while data loads
- [x] Add empty state when all metrics are zero (new tenant)

## Phase 5.3: Credits Banner
- [x] Create `apps/dashboard/src/components/dashboard/credits-banner.tsx`:
  - [x] "X Credits Remaining — Renews [date]" display
  - [x] Visual progress bar (used/total) with theme colors
  - [x] Warning state when < 20% remaining (amber/orange styling)
  - [x] Critical state when < 5% remaining (red styling)
  - [x] "Upgrade Plan" link/button
  - [x] Responsive layout

## Phase 5.4: Saving Hours Widget
- [x] Create `apps/dashboard/src/components/dashboard/saving-hours.tsx`:
  - [x] Formula: `analyses_count × avg_manual_investigation_time` (avg = 4 hours per incident)
  - [x] Display: "You saved ~X hours this month with CauseFlow AI"
  - [x] Visual element (clock icon or simple graphic)
  - [x] Only shows when there are analyses (hidden for empty state)

## Phase 5.5: Recent Analyses List
- [x] Create `apps/dashboard/src/components/dashboard/recent-analyses.tsx`:
  - [x] Last 5 analyses with: title/prompt preview, status badge, severity, date
  - [x] Status badges with colors: Queued (gray), Running (blue), Completed (green), Failed (red)
  - [x] Severity badges: Low (blue), Medium (amber), High (orange), Critical (red)
  - [x] Click row → navigate to `/dashboard/analyses/[id]`
  - [x] "View All" link → `/dashboard/analyses`
  - [x] Loading skeleton state

## Phase 5.6: Quick Actions & Empty State
- [x] Create quick action buttons section:
  - [x] "New Analysis" button → `/dashboard/analyses/new`
  - [x] "Connect Integration" button → `/dashboard/integrations`
  - [x] Styled as prominent action cards/buttons
- [x] Create empty state component for new tenants (no analyses yet):
  - [x] Friendly illustration/icon
  - [x] "Welcome! Start your first analysis" message
  - [x] "Create Analysis" CTA button
  - [x] Brief feature highlights

## Phase 5.7: Assemble Dashboard Overview Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/page.tsx`:
  - [x] Compose all components: metrics cards, credits banner, saving hours, recent analyses, quick actions
  - [x] Responsive grid layout
  - [x] Loading states for async data
  - [x] Empty state logic (show empty state when no analyses)
  - [x] Page title and metadata

## Phase 5.8: i18n Messages
- [x] Add dashboard home i18n messages to EN (dashboard.home.* namespace):
  - metrics card labels, credits banner text, saving hours text
  - recent analyses header, status/severity labels
  - quick action labels, empty state text
- [x] Add dashboard home i18n messages to PT-BR (same namespace)

## Phase 5.9: Unit Tests
- [x] Write unit tests for metrics-card component (renders value, loading skeleton, trend)
- [x] Write unit tests for credits-banner component (normal, warning, critical states)
- [x] Write unit tests for saving-hours component (calculation, display, hidden when zero)
- [x] Write unit tests for recent-analyses component (renders list, status badges, empty state)

## Phase 5.10: E2E Tests
- [x] Create E2E test: dashboard home page renders with metrics cards
- [x] Create E2E test: credits banner displays correctly
- [x] Create E2E test: empty state shows for new tenant
- [x] Create E2E test: responsive layout (mobile vs desktop grid)

## Phase 5.11: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (Phase 5 files clean; pre-existing issues in other phases untouched)
- [x] Run `pnpm turbo check-types` — zero type errors (tsc --noEmit passes; fixed pre-existing disconnect-dialog.test.ts type error too)
- [x] Run `pnpm turbo test` — all tests pass (399/399 tests)
- [x] Verify dashboard home renders correctly in light and dark mode
- [x] Verify responsive layout (mobile, tablet, desktop)
- [x] Remove unused code/imports
