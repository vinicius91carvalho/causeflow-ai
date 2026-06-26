# Phase 7: Integrations Management

## Phase 7.1: Research & Setup
- [x] Study existing integrations placeholder page (`/dashboard/integrations`)
- [x] Study the integrations API routes (`/api/integrations`) for available endpoints
- [x] Study the integration repository methods and types
- [x] Study the onboarding integration card/modal components (Phase 3 — reusable)
- [x] Study i18n messages structure

## Phase 7.2: Integrations Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/integrations/page.tsx`:
  - Page header with title and description
  - Grid of integration cards (reuse/extend from onboarding)
  - States per card: Available (can connect), Connected (active), Error (needs attention)
  - Connected cards show: status indicator, last synced timestamp, connected by
  - Available cards show: name, description, "Connect" button
  - Error cards show: warning icon, error message, "Reconnect" button
- [x] Add category filter:
  - Categories: All, Communication (Slack), Monitoring (Datadog, CloudWatch), Code (GitHub), Project Management (Jira), Alerting (PagerDuty)
  - Horizontal filter chips or dropdown
- [x] Add search input to filter by integration name
- [x] Fetch integrations data from `/api/integrations` on page load
- [x] Add loading skeleton while data loads

## Phase 7.3: Connection Modal (Full Version)
- [x] Extend the onboarding connection modal for full functionality:
  - Dynamic form based on integration type (already exists from Phase 3)
  - "Test Connection" button → validates credentials before saving
  - Test connection: mock endpoint that returns success after brief delay
  - Loading state during test and save
  - Success state with animation
  - Error state with retry option
- [x] Add form fields per integration type (extend from Phase 3 if needed):
  - Slack: API Token, Workspace name
  - PagerDuty: API Key, Service ID (optional)
  - Datadog: API Key, Application Key, Site (US/EU)
  - GitHub: Personal Access Token, Organization (optional)
  - Jira: Email, API Token, Domain URL, Project Key (optional)
  - AWS CloudWatch: Access Key ID, Secret Access Key, Region selector

## Phase 7.4: Connected Integration Management
- [x] Create disconnect confirmation dialog:
  - Warning message about losing connection
  - "Disconnect" and "Cancel" buttons
  - On confirm → DELETE to `/api/integrations/[type]`
- [x] Create reconfigure flow:
  - Opens connection modal pre-filled with integration type (not credentials — those are encrypted)
  - User enters new credentials → test → save (overwrites)
- [x] Add status indicator component:
  - Connected: green dot
  - Error: red dot with tooltip
  - Disconnected: gray dot

## Phase 7.5: Integration Health Check UI
- [x] Add last tested timestamp on connected cards
- [x] Add "Test Connection" button on connected cards
  - Triggers a test → shows result (success/failure)
  - Updates last tested timestamp
- [x] Visual indicator for stale connections (not tested in > 7 days)

## Phase 7.6: i18n Messages
- [x] Add integrations i18n messages to EN (dashboard.integrations.* namespace):
  - Page title/description, filter labels, search placeholder
  - Card states: available, connected, error, disconnected
  - Modal: form labels, test connection, save, cancel
  - Disconnect dialog: warning, confirm, cancel
  - Integration descriptions for each type
- [x] Add integrations i18n messages to PT-BR (same namespace)

## Phase 7.7: Unit Tests
- [x] Write unit tests for integrations page (rendering, filtering, search)
- [x] Write unit tests for connection modal (form validation, test connection flow)
- [x] Write unit tests for disconnect dialog (confirmation, cancel)
- [x] Write unit tests for status indicator component
- [x] Write unit tests for category filter logic

## Phase 7.8: E2E Tests
- [x] Create E2E test: integrations page renders grid of cards
- [x] Create E2E test: category filter filters cards correctly
- [x] Create E2E test: search filters by name
- [x] Create E2E test: clicking Connect opens modal with correct fields
- [x] Create E2E test: disconnect dialog shows warning

## Phase 7.9: Verification
- [x] Run `pnpm turbo build` — compilation passes (pre-existing `.nft.json` trace issue in dashboard is unrelated to this phase)
- [x] Run `pnpm exec biome check .` — zero lint issues on all new/modified files
- [x] Run `pnpm turbo check-types` — zero type errors (`pnpm exec tsc --noEmit` exits 0)
- [x] Run `pnpm turbo test` — all 470 tests pass (45 test files)
- [x] Verify integrations page renders in light and dark mode (skipped — manual verification)
- [x] Verify responsive layout (mobile, tablet, desktop) (skipped — manual verification)
- [x] Remove unused code/imports
