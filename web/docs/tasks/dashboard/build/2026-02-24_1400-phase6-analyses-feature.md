# Phase 6: Analyses Feature

## Phase 6.1: Research & Setup
- [x] Study existing analyses placeholder pages (`/dashboard/analyses`, `/dashboard/analyses/new`)
- [x] Study the analyses API routes (`/api/analyses`) for available endpoints
- [x] Study the analysis repository methods and types
- [x] Study existing component patterns (metrics cards, integration cards) for consistency
- [x] Study i18n messages structure

## Phase 6.2: New Analysis Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/analyses/new/page.tsx`:
  - Prompt input: large textarea with placeholder text
  - Context selector: checkboxes for available integrations to include
  - Severity selector: Low / Medium / High / Critical (radio or dropdown)
  - Submit button → POST to `/api/analyses`
  - Loading state with spinner/progress indicator after submission
  - Success → redirect to analysis detail page
  - Error handling with toast/alert
  - Form validation with Zod (prompt min 10 chars)
- [x] Create severity selector component with color-coded options
- [x] Create integration context selector (checkboxes with integration icons)

## Phase 6.3: Analysis History Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/analyses/page.tsx`:
  - List of analyses as cards or table rows
  - Each item shows: prompt preview (truncated), status badge, severity badge, date, confidence score
  - Status badges: Queued (gray), Running (blue/animated), Completed (green), Failed (red)
  - Severity badges: Low (blue), Medium (amber), High (orange), Critical (red)
  - Click → navigate to `/dashboard/analyses/[id]`
  - Default sort: newest first
  - No delete action (immutable audit trail by design)
- [x] Add filter controls:
  - Status filter (All, Queued, Running, Completed, Failed)
  - Severity filter (All, Low, Medium, High, Critical)
- [x] Add pagination:
  - "Load More" button or cursor-based pagination
  - Shows total count
- [x] Add empty state: no analyses yet → "Create your first analysis" CTA
- [x] Add loading skeleton while fetching

## Phase 6.4: Analysis Detail Page
- [x] Create `apps/dashboard/src/app/[locale]/dashboard/analyses/[id]/page.tsx`:
  - Status banner with timestamp and severity
  - Original prompt section
  - Root cause analysis section:
    - Confidence score (0-100%) with visual indicator (color-coded progress bar)
    - Root cause description
  - Chronological timeline of events (vertical timeline component)
  - Fix recommendations list (numbered, actionable items)
  - Data sources consulted (which integrations were queried, with icons)
  - Investigation audit trail (collapsible section showing every action the agent took)
  - Back to history link
- [x] Create timeline component for event chronology
- [x] Create confidence score indicator component
- [x] Create audit trail collapsible component

## Phase 6.5: Real-time Updates
- [x] Add polling mechanism for in-progress analyses:
  - When analysis status is Queued or Running, poll every 5 seconds
  - Auto-update UI when status changes
  - Stop polling when Completed or Failed
- [x] Add toast notification when analysis completes (using a simple toast component)

## Phase 6.6: i18n Messages
- [x] Add analyses i18n messages to EN (dashboard.analyses.* namespace):
  - New analysis: form labels, placeholders, submit, validation
  - History: filter labels, status/severity labels, empty state, pagination
  - Detail: section headers, confidence, timeline, recommendations, audit trail
- [x] Add analyses i18n messages to PT-BR (same namespace)

## Phase 6.7: Unit Tests
- [x] Write unit tests for new analysis form (validation, submit behavior)
- [x] Write unit tests for analysis history list (rendering, filtering, pagination)
- [x] Write unit tests for analysis detail page components (timeline, confidence, audit trail)
- [x] Write unit tests for status/severity badge components
- [x] Write unit tests for polling mechanism

## Phase 6.8: E2E Tests
- [x] Create E2E test: new analysis page renders form correctly
- [x] Create E2E test: form validation (short prompt shows error)
- [x] Create E2E test: analysis history page renders list
- [x] Create E2E test: filter controls work (status, severity)
- [x] Create E2E test: analysis detail page renders all sections
- [x] Create E2E test: empty state shows when no analyses

## Phase 6.9: Verification
- [x] Run `pnpm turbo build` — compilation succeeds (43/43 pages); post-build ENOENT is pre-existing PRoot env limitation
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors (only missing .next/types pre-build artifacts, pre-existing)
- [x] Run `pnpm turbo test` — all tests pass (399/399)
- [x] Verify all analysis pages render in light and dark mode
- [x] Verify responsive layout (mobile, tablet, desktop)
- [x] Remove unused code/imports
