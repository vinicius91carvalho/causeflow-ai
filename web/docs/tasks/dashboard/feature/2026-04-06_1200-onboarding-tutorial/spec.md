# Dashboard Onboarding Tutorial: Product Requirements Document

## 1. What & Why

**Problem:** New users land on the dashboard after completing profile + choosing a plan and see a one-time linear driver.js tour that highlights sidebar items. This is insufficient — users don't know *what to do next* (connect integrations, set up relay, create first incident). Activation rate suffers because users don't discover the full workflow.

**Desired Outcome:** A persistent, multi-step onboarding checklist that guides new users through the full "first value" journey: welcome, connect integrations, set up relay, create first incident, receive events, understand billing. Progress persists across sessions. Completion triggers celebration. Users can skip at any time.

**Justification:** Activation is the highest-leverage metric for a product in beta. Every user who completes onboarding is dramatically more likely to convert. This is the natural next step after the plan-selection flow.

## 2. Correctness Contract

**Audience:** New dashboard users who just completed profile + plan selection. They need clear, sequential guidance to reach "first value" (resolving their first incident with CauseFlow).

**Failure Definition:** Tutorial shows to existing users (retroactive), progress doesn't persist (user restarts every session), checklist blocks normal dashboard usage, or steps navigate to wrong pages.

**Danger Definition:** Tutorial modifies user data or triggers unintended API calls. Tutorial prevents access to critical dashboard features. Tutorial creates DynamoDB items for users who shouldn't have them.

**Risk Tolerance:** For UI/UX: prefer showing something rather than nothing (fail open). For data persistence: prefer not writing if uncertain (fail closed). A user who doesn't see the tutorial is better than a user who can't dismiss it.

## 3. Context Loaded

- `welcome-tour.tsx`: Current linear driver.js tour, triggered by `?welcome=1` URL param. Has TOUR_STYLES CSS, confetti integration. This will be replaced.
- `sidebar.tsx`: Has `data-tour="nav-*"` attributes on all nav items. These will be consumed by onboarding step highlights.
- `dashboard-layout.tsx`: Has `data-tour="main-content"` on main area. This is where the floating checklist widget will be rendered.
- `subscription-gate.tsx`: Blocks dashboard until subscription confirmed. Uses `?welcome=1` as bypass. Onboarding must work within this gate (after subscription is active).
- `confetti.ts`: Has `signUpConfetti()`, `planSelectConfetti()`, `analysisCompleteConfetti()`. Reuse for completion.
- `shared/domain/types.ts`: Tenant type with plan, credits, etc. Onboarding progress will be stored as tenant metadata.
- `identity/domain/types.ts`: User type with `profileComplete` flag. No onboarding field yet — onboarding is tenant-level.
- `middleware.ts`: Clerk-based auth, routes to org creation if no orgId. Public routes include `/onboarding/*`.
- Dashboard routes: `/dashboard/integrations`, `/dashboard/relay`, `/dashboard/incidents`, `/dashboard/billing` all exist.
- i18n: `shared/infrastructure/i18n/en.json` has existing `tour.*` keys. New onboarding keys will be added here.
- driver.js v1.4.0 already installed. canvas-confetti already installed.

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Tutorial completion rate | N/A (no persistent tutorial) | >40% of new users | Count `completed: true` in onboarding records |
| Steps completed per user | N/A | avg 4+ of 6 | Average `currentStep` in onboarding records |
| Time to first incident | Unknown | Reduce by 30% | Time between tenant creation and first incident |
| Tutorial skip rate | N/A | <30% | Count `skipped: true` in onboarding records |

## 5. User Stories

GIVEN a new user who just completed plan selection and lands on dashboard with `?welcome=1`
WHEN the dashboard loads
THEN a welcome modal appears with detective-themed "mission briefing" messaging, and a floating checklist widget appears in the bottom-right corner showing all steps

GIVEN a user is on the dashboard with an active onboarding checklist
WHEN they click a step in the checklist (e.g., "Connect Integrations")
THEN the app navigates to the relevant page (`/dashboard/integrations`) and a driver.js highlight shows them key elements on that page

GIVEN a user has completed 4 of 6 steps
WHEN they close the browser and return later
THEN the checklist widget reappears showing 4/6 completed, with the next uncompleted step highlighted

GIVEN a user clicks "Skip Tutorial" at any point
WHEN they confirm the skip
THEN the checklist disappears permanently, onboarding is marked `skipped: true`

GIVEN a user completes all 6 steps
WHEN the last step is marked complete
THEN a "Mission Complete" modal appears with confetti, and the checklist disappears permanently

GIVEN an existing user who was already using the dashboard before onboarding was built
WHEN they log in
THEN they see NO onboarding checklist (no retroactive onboarding)

## 6. Acceptance Criteria

- [ ] Welcome modal appears on first dashboard load for new users (triggered by `?welcome=1` or `onboardingStatus === 'not_started'`)
- [ ] Floating checklist widget renders in bottom-right corner with all 7 steps (welcome + 5 action steps + complete)
- [ ] Each action step has: title, description, status indicator (pending/completed/skipped), click-to-navigate
- [ ] Clicking a step navigates to the correct page and triggers a driver.js highlight on key elements
- [ ] Progress persists across browser sessions via `GET/PATCH /api/onboarding/progress`
- [ ] "Skip Tutorial" button marks onboarding as skipped and hides the checklist permanently
- [ ] Completion of all steps triggers "Mission Complete" modal with confetti
- [ ] Existing users (no onboarding record) never see the checklist
- [ ] New users who already completed onboarding don't see the checklist again
- [ ] i18n: All user-facing strings available in EN and PT-BR
- [ ] Checklist widget is responsive (full widget on desktop, collapsed FAB on mobile)
- [ ] Widget can be minimized/expanded by the user
- [ ] Type-safe: all components and API handlers pass `pnpm turbo check-types`
- [ ] Lint-clean: passes `pnpm exec biome check .`

## 7. Non-Goals (at least as detailed as goals)

- **Auto-detection of step completion** — Steps are marked complete via explicit user action ("Mark as done" button or completing a page action), NOT by detecting if the user actually connected an integration. Why: auto-detection requires deep coupling into each feature's API layer and adds fragility. Ship manual completion first, add auto-detection in a follow-up.
- **Analytics/tracking events** — Not adding GA4 events for onboarding funnel in this PRD. Why: the DynamoDB progress record provides sufficient data for now. Analytics events can be added later.
- **Onboarding for team members (non-admins)** — Only the first user (admin) who creates the organization gets the tutorial. Why: team members join later, have different needs, and admin has already set up integrations.
- **Email drip campaign** — No onboarding emails triggered by step completion. Why: separate concern, different infrastructure (Loops.so), can be added independently.
- **Guided incident creation wizard** — The "Create First Incident" step navigates to the existing new-incident page, not a special wizard. Why: scope control. The existing page is functional.

## 8. Technical Constraints

- **Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS + Shadcn/ui, driver.js v1.4.0, canvas-confetti
- **Architecture:** DDD bounded contexts under `src/contexts/`. New `onboarding` context. Thin re-exports in `app/`.
- **Data:** DynamoDB single-table design. Onboarding progress stored as tenant metadata (`ONBOARDING#<tenantId>` SK pattern).
- **Auth:** Clerk-based. API endpoints protected with `withAuth()` HOC.
- **Performance:** Checklist widget must not add >50ms to LCP. Lazy-load driver.js highlights. No blocking API calls in the render path.
- **PRoot/ARM64:** Dev uses Webpack (no Turbopack). Tests via Vitest.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| New `onboarding` bounded context | Low | Extend `shared` or `identity` | Onboarding has its own domain (progress, steps), API, and presentation. Clean separation. Easy to delete if onboarding is replaced. |
| Tenant-scoped onboarding (not user-scoped) | Med | User-scoped progress | Only admin does onboarding. Tenant-scope means we check once per org, not per user. Simpler queries. |
| Manual step completion (not auto-detected) | Low | Event-driven auto-detection | Auto-detection couples onboarding to every feature's API. Manual is simpler, ships faster, can be enhanced later. |
| DynamoDB for persistence (not localStorage) | Low | localStorage, cookies | Must persist across devices/sessions. Tenant metadata is already in DynamoDB. Natural extension. |
| driver.js for page-specific highlights | Low | Custom highlight implementation | Already installed, styled, proven in current tour. No additional dependency. |
| Replace WelcomeTour entirely | Low | Keep both | Current tour is a subset of the new onboarding. No reason to maintain both. |

## 10. Security Boundaries

- **Auth model:** All API endpoints (`/api/onboarding/progress`) protected by `withAuth()`. Requires active Clerk session + organization membership.
- **Trust boundaries:** Onboarding progress is tenant-scoped. Users can only read/write their own tenant's progress. `tenantId` comes from session (server-side), never from client input.
- **Data sensitivity:** No PII in onboarding records. Only step statuses and timestamps.
- **Tenant isolation:** PK pattern `TENANT#<tenantId>` ensures one tenant can't access another's progress. Standard DynamoDB tenant isolation pattern.

## 11. Data Model

**Access Patterns (define BEFORE schema):**
1. Dashboard layout reads onboarding status on every page load to decide whether to render checklist widget — must be fast (<50ms), single query by tenantId
2. Step completion writes update a single step's status — PATCH by tenantId
3. Skip/complete writes mark the whole onboarding as done — PATCH by tenantId

**Entity: OnboardingProgress**
```typescript
interface OnboardingProgress {
  tenantId: string;
  completed: boolean;
  skipped: boolean;
  currentStep: number; // 0-6
  steps: {
    welcome: 'pending' | 'completed' | 'skipped';
    integrations: 'pending' | 'completed' | 'skipped';
    relay: 'pending' | 'completed' | 'skipped';
    firstIncident: 'pending' | 'completed' | 'skipped';
    receiveEvents: 'pending' | 'completed' | 'skipped';
    billing: 'pending' | 'completed' | 'skipped';
    complete: 'pending' | 'completed';
  };
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
}
```

**DynamoDB Schema:**
- PK: `TENANT#<tenantId>`
- SK: `ONBOARDING`
- Attributes: all fields from OnboardingProgress
- entityType: `OnboardingProgress`

**Schema justification:** Single-item lookup by PK+SK satisfies all access patterns. No GSI needed. Updates are atomic PATCHes on the same item.

## 12. Shared Contracts

### Design Tokens
Reuse existing CauseFlow theme tokens. TOUR_STYLES CSS from `welcome-tour.tsx` will be extracted to a shared CSS file under the onboarding context.

### Component Interfaces

```typescript
// OnboardingChecklist widget props
interface OnboardingChecklistProps {
  progress: OnboardingProgress;
  onStepClick: (stepKey: StepKey) => void;
  onSkip: () => void;
  onMinimize: () => void;
  minimized: boolean;
}

// OnboardingModal props (welcome + complete)
interface OnboardingModalProps {
  type: 'welcome' | 'complete';
  onDismiss: () => void;
}

// Step configuration (static)
interface OnboardingStepConfig {
  key: StepKey;
  icon: React.ComponentType<{ className?: string }>;
  href: string; // navigation target
  tourTargets?: string[]; // data-tour selectors for driver.js highlights
}

type StepKey = 'welcome' | 'integrations' | 'relay' | 'firstIncident' | 'receiveEvents' | 'billing' | 'complete';
```

### Data Types

```typescript
// API request/response types
interface GetOnboardingProgressResponse {
  progress: OnboardingProgress | null; // null = no record = existing user
}

interface PatchOnboardingProgressRequest {
  step?: StepKey;
  action: 'complete' | 'skip' | 'skip_all' | 'start';
}

interface PatchOnboardingProgressResponse {
  progress: OnboardingProgress;
}
```

### Layout Structure
- Checklist widget: fixed position, bottom-right, z-index above page content but below modals
- Modal: full-screen overlay with centered card, z-index above everything
- Mobile: widget collapses to a small FAB button; expands on tap

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---------|-------|---------------|----------------|
| Onboarding step keys | `onboarding` domain | `welcome\|integrations\|relay\|firstIncident\|receiveEvents\|billing\|complete` | `grep -rn "StepKey" apps/dashboard/src/contexts/onboarding/ \| grep -c "type StepKey"` |
| Onboarding step status | `onboarding` domain | `pending\|completed\|skipped` | `grep -rn "OnboardingStepStatus" apps/dashboard/src/contexts/onboarding/domain/` |
| Onboarding DynamoDB SK | `onboarding` infrastructure | `ONBOARDING` (literal string) | `grep -rn "buildOnboardingSK" apps/dashboard/src/contexts/onboarding/ \| grep -c "ONBOARDING"` |
| Onboarding API paths | `onboarding` API | `/api/onboarding/progress` (GET + PATCH) | `test -f apps/dashboard/src/app/api/onboarding/progress/route.ts` |

**Dependency direction:** Dashboard layout (shared) depends on onboarding context for the checklist widget. Onboarding context depends on shared for layout utilities, confetti, and tour styles.

## 14. Open Questions

- [x] Should step completion be manual or auto-detected? **Decision: Manual first, auto-detect later.**
- [x] Tenant-scoped or user-scoped? **Decision: Tenant-scoped (only admin sees it).**
- [ ] Should the onboarding record be created at plan-selection time or on first dashboard load? **Recommendation: At plan-selection time (in checkout success flow), so the record exists before dashboard load. But if that's complex, create on first dashboard load when `?welcome=1` is present.**

## 15. Uncertainty Policy

When uncertain: **Flag** — document the assumption and continue. Reviewer catches it later.
When UI/UX conflicts with data integrity: prefer data integrity.
When performance conflicts with feature completeness: prefer feature completeness (optimize later).

## 16. Verification

- **Deterministic:**
  - `pnpm turbo check-types` passes
  - `pnpm exec biome check .` passes
  - `pnpm turbo test` — unit tests for hooks, API handler, components
  - `pnpm turbo build` succeeds
- **Manual:**
  - New user flow: sign up -> choose plan -> dashboard shows welcome modal + checklist
  - Click each step: navigates to correct page, driver.js highlight appears
  - Close browser, reopen: progress persists
  - Complete all steps: "Mission Complete" modal + confetti
  - Skip tutorial: checklist disappears permanently
  - Existing user login: no checklist visible
  - Mobile viewport: checklist collapses to FAB

## 17. Sprint Decomposition

Maximum 5 sprints. Each sprint is extracted into its own file under `sprints/` during planning.

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|--------|-------|------------|-------|-------|---------------|
| 1 | Domain + API + Infrastructure | None | 1 | sonnet | -- |
| 2 | Core UI Components | Sprint 1 | 2 | sonnet | -- |
| 3 | Integration + Layout Wiring | Sprint 2 | 3 | sonnet | -- |
| 4 | i18n + Polish + Tests | Sprint 3 | 4 | sonnet | -- |

### Sprint 1: Domain + API + Infrastructure -> `sprints/01-domain-api-infrastructure.md`

**Objective:** Create the `onboarding` bounded context with domain types, DynamoDB repository, and API endpoints.
**Estimated effort:** M

**File Boundaries:**
- `files_to_create`: domain types, repository, API handlers, API route, Zod schemas
- `files_to_modify`: `shared/domain/types.ts` (add onboarding SK builder)
- `files_read_only`: `lib/db/client.ts`, `lib/api/with-auth.ts`, existing repositories for patterns

### Sprint 2: Core UI Components -> `sprints/02-core-ui-components.md`

**Objective:** Build the OnboardingChecklist widget, OnboardingModal, OnboardingStepCard, and useOnboardingProgress hook.
**Estimated effort:** L

**File Boundaries:**
- `files_to_create`: checklist widget, modal, step card, hook, CSS
- `files_to_modify`: None
- `files_read_only`: domain types from Sprint 1, TOUR_STYLES from welcome-tour.tsx

### Sprint 3: Integration + Layout Wiring -> `sprints/03-integration-layout-wiring.md`

**Objective:** Wire onboarding into dashboard layout, replace WelcomeTour, add driver.js page highlights, handle navigation.
**Estimated effort:** M

**File Boundaries:**
- `files_to_create`: onboarding orchestrator component, step highlight configs
- `files_to_modify`: `dashboard-layout.tsx`, `welcome-tour.tsx` (replace), `subscription-gate.tsx` (adjust welcome param handling)
- `files_read_only`: sidebar.tsx (data-tour attributes), layout.tsx

### Sprint 4: i18n + Polish + Tests -> `sprints/04-i18n-polish-tests.md`

**Objective:** Add EN + PT-BR translations, responsive polish, comprehensive tests, and cleanup.
**Estimated effort:** M

**File Boundaries:**
- `files_to_create`: test files for all components, API handlers
- `files_to_modify`: `shared/infrastructure/i18n/en.json`, `shared/infrastructure/i18n/pt-br.json`, `lib/i18n/compose.ts`
- `files_read_only`: all onboarding components from prior sprints

## 18. Execution Log

[Filled during execution -- tracked in progress.json]

## 19. Learnings (filled after all sprints complete)

[Compound step output]
