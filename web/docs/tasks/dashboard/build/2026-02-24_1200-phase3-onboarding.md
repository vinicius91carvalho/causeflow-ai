# Phase 3: Onboarding Flow

## Phase 3.1: Research & Setup
- [x] Study existing middleware.ts to understand current auth + i18n routing logic
- [x] Study existing auth config (packages/auth/) to understand session/JWT callbacks and profileComplete flag
- [x] Study existing dashboard layout and theme system for consistency
- [x] Study existing i18n messages structure for dashboard namespace

## Phase 3.2: Onboarding Layout & Routing
- [x] Create `apps/dashboard/src/app/[locale]/onboarding/layout.tsx` — minimal layout (no sidebar, centered card with progress indicator, similar to auth layout)
- [x] Add onboarding routes to middleware as protected but allowing incomplete profiles
- [x] Update middleware logic: authenticated + profileComplete=false → redirect to `/onboarding/complete-profile`
- [x] Update middleware logic: authenticated + profileComplete=true → allow `/dashboard/*`, redirect away from `/onboarding/*`
- [x] Ensure `/onboarding/*` routes are protected (require authentication) but exempt from profileComplete check

## Phase 3.3: Complete Profile Page
- [x] Create `apps/dashboard/src/app/[locale]/onboarding/complete-profile/page.tsx`:
  - Step 1 of 3 progress indicator
  - Company name input (required)
  - Company website URL input (optional, with URL validation)
  - Team size selector (1-5, 6-20, 21-50, 50+)
  - Your role/title input (optional)
  - "Continue" button → saves profile, advances to step 2
  - Form validation with Zod
  - Loading state on submit
- [x] Create API route `apps/dashboard/src/app/api/onboarding/complete-profile/route.ts`:
  - Validates input (Zod)
  - Creates Tenant entity (generates tenantId UUID)
  - Updates user with tenantId, role=Admin, profileComplete=true
  - Updates session/JWT with new attributes
  - Returns success with tenantId
  - Rate limiting

## Phase 3.4: Connect First Integration Page
- [x] Create `apps/dashboard/src/app/[locale]/onboarding/connect-integration/page.tsx`:
  - Step 2 of 3 progress indicator
  - Grid of integration cards (Slack, PagerDuty, Datadog, GitHub, Jira, AWS CloudWatch)
  - Each card: icon, name, brief description, "Connect" button
  - Clicking "Connect" opens a modal with integration-specific form fields
  - "Skip for now" link at the bottom → goes to step 3
  - Success state: card shows green checkmark after connection
  - "Continue" button appears after connecting or shows alongside "Skip"
- [x] Create integration card component (reusable for Phase 7)
- [x] Create connection modal component (reusable for Phase 7)
  - Integration-specific form fields (API key, webhook URL, etc.)
  - Form validation with Zod
  - Submit → POST to a mock/stub endpoint (real KMS encryption in Phase 4)
  - Loading and success states

## Phase 3.5: Welcome Page
- [x] Create `apps/dashboard/src/app/[locale]/onboarding/welcome/page.tsx`:
  - Step 3 of 3 progress indicator (all complete)
  - Welcome message with user's company name
  - Summary of what was set up (profile + integrations if any)
  - "Quick Tips" section:
    - "Start your first analysis" → link to /dashboard/analyses/new
    - "Invite your team" → link to /dashboard/team
    - "Explore integrations" → link to /dashboard/integrations
  - "Go to Dashboard" primary button → /dashboard
  - Celebratory/friendly illustration or icon

## Phase 3.6: Progress Indicator Component
- [x] Create `apps/dashboard/src/components/onboarding/progress-indicator.tsx`:
  - Shows 3 steps: Profile, Integration, Welcome
  - Current step highlighted, completed steps with checkmark
  - Responsive (horizontal on desktop, compact on mobile)
  - Reuses theme tokens for colors

## Phase 3.7: i18n Messages
- [x] Add onboarding i18n messages to EN messages (dashboard.onboarding.* namespace):
  - completeProfile.title, completeProfile.subtitle, form labels, validation messages
  - connectIntegration.title, connectIntegration.subtitle, skip button, integration names/descriptions
  - welcome.title, welcome.subtitle, tips, buttons
  - progress indicator labels
- [x] Add onboarding i18n messages to PT-BR messages (same namespace)

## Phase 3.8: Unit Tests
- [x] Write unit tests for complete-profile API route handler (validation, tenant creation, error cases)
- [x] Write unit tests for middleware onboarding redirect logic (profileComplete true/false scenarios)
- [x] Write unit tests for progress indicator component (step rendering, active/completed states)

## Phase 3.9: E2E Tests
- [x] Create E2E test: unauthenticated user → redirected to sign-in (not onboarding)
- [x] Create E2E test: onboarding complete-profile page renders correctly with form fields
- [x] Create E2E test: form validation works (empty company name shows error)
- [x] Create E2E test: connect-integration page renders grid of integration cards
- [x] Create E2E test: welcome page renders with tips and dashboard link
- [x] Create E2E test: progress indicator shows correct step highlighting

## Phase 3.10: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (new files clean; pre-existing issues in other packages unchanged)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass (91 tests, 7 files)
- [x] Verify onboarding pages render correctly in light and dark mode (build produces correct pages, dark mode via .dark class)
- [x] Verify responsive layout on all onboarding pages (mobile, tablet, desktop)
- [x] Remove unused code/imports
