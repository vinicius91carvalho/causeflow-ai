# Sprint 3: Integration + Layout Wiring

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 4
- **Depends on:** Sprint 2
- **Batch:** 3 (sequential)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Wire the onboarding system into the dashboard layout. Replace the existing WelcomeTour with the new onboarding orchestrator. Add driver.js page-specific highlights. Handle navigation between steps.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-orchestrator.tsx` — Top-level component that manages onboarding lifecycle (reads progress, renders checklist + modals, handles navigation)
- `apps/dashboard/src/contexts/onboarding/presentation/components/step-highlights.ts` — driver.js highlight configurations per step (element selectors, popover content)

### Modifies (can touch)

- `apps/dashboard/src/contexts/shared/presentation/components/layout/dashboard-layout.tsx` — Add OnboardingOrchestrator as a child component
- `apps/dashboard/src/contexts/shared/presentation/components/welcome-tour.tsx` — Replace entire content with a comment pointing to new onboarding system OR delete and update imports
- `apps/dashboard/src/contexts/billing/presentation/components/subscription-gate.tsx` — Adjust `?welcome=1` handling: instead of just setting sessionStorage, also trigger onboarding start

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/shared/presentation/components/layout/sidebar.tsx` — `data-tour` attributes for driver.js targeting
- `apps/dashboard/src/contexts/shared/presentation/components/layout/topbar.tsx` — Reference for layout context
- `apps/dashboard/src/middleware.ts` — Understand route protection
- `apps/dashboard/src/app/[locale]/dashboard/layout.tsx` — Understand component hierarchy

### Shared Contracts (consume from prior sprints or PRD)

- `OnboardingProgress` interface from Sprint 1
- `useOnboardingProgress` hook from Sprint 2
- `OnboardingChecklist` component from Sprint 2
- `OnboardingModal` component from Sprint 2
- driver.js API (already installed, v1.4.0)

### Consumed Invariants (from INVARIANTS.md)

- Onboarding step keys — must navigate to correct pages
- Onboarding API paths — orchestrator calls these

## Tasks

- [ ] Create `step-highlights.ts`:
  - Define driver.js step configs for each onboarding step
  - `integrations` step: highlight `[data-tour="nav-integrations"]` sidebar item + main content area
  - `relay` step: highlight `[data-tour="nav-relay"]` sidebar item
  - `firstIncident` step: highlight `[data-tour="nav-incidents"]` sidebar item + "New Incident" button if visible
  - `receiveEvents` step: highlight `[data-tour="nav-integrations"]` with events explanation
  - `billing` step: highlight `[data-tour="nav-billing"]` sidebar item
  - Each config: element selector, popover title, description, side/align
- [ ] Create `onboarding-orchestrator.tsx`:
  - Uses `useOnboardingProgress` hook
  - On mount with `?welcome=1` URL param: calls `startOnboarding()` to create initial record, shows welcome modal
  - Renders `OnboardingChecklist` when progress exists and not completed/skipped
  - Handles step click: navigate to step's href via `router.push()`, then trigger driver.js highlight after short delay (allow page to render)
  - Handles step completion: when user clicks "Mark as Done" in the highlight popover
  - Handles skip: calls `skipAll()`, hides everything
  - Handles completion: when all action steps are completed, shows complete modal
  - Cleans up `?welcome=1` from URL after processing
- [ ] Modify `dashboard-layout.tsx`:
  - Import and render `OnboardingOrchestrator` inside the layout, after `<ErrorBoundary>`
  - Pass no props (orchestrator is self-contained)
- [ ] Replace `welcome-tour.tsx`:
  - Remove the entire WelcomeTour component and TOUR_STYLES
  - Export a no-op component or delete file entirely
  - Update any imports that reference WelcomeTour
- [ ] Adjust `subscription-gate.tsx`:
  - When `?welcome=1` is detected and subscription is valid, preserve the param for the onboarding orchestrator to consume
  - Don't strip the param in subscription gate (let orchestrator handle it)

## Acceptance Criteria

- [ ] OnboardingOrchestrator renders inside dashboard layout
- [ ] `?welcome=1` triggers welcome modal and creates onboarding progress record
- [ ] Clicking a step in the checklist navigates to the correct page
- [ ] After navigation, driver.js highlight appears on the relevant sidebar/page element
- [ ] driver.js highlight popover has "Mark as Done" action that completes the step
- [ ] Completing all steps triggers the "Mission Complete" modal
- [ ] Skipping dismisses everything permanently
- [ ] Old WelcomeTour is fully replaced (no duplicate tour behavior)
- [ ] URL is cleaned of `?welcome=1` after onboarding starts

## Verification

- [ ] Build passes: `pnpm turbo build`
- [ ] Lint passes: `pnpm exec biome check .`
- [ ] Type-check passes: `pnpm turbo check-types`
- [ ] Dev server starts and dashboard loads without errors

## Context

**Navigation + Highlight Pattern:**

When user clicks a step in the checklist:
1. `router.push('/dashboard/integrations')` (or whichever page)
2. Wait for navigation to complete (use `router.events` or a short `setTimeout`)
3. Initialize driver.js with the step-specific highlight config
4. driver.js shows the highlight popover
5. User reads the popover, clicks "Mark as Done" (custom button in popover)
6. Step is marked complete, driver.js dismissed

**driver.js integration:**

```typescript
import { driver } from 'driver.js';

function showStepHighlight(stepConfig: StepHighlightConfig) {
  const d = driver({
    popoverClass: 'causeflow-tour',
    steps: [{
      element: stepConfig.element,
      popover: {
        title: stepConfig.title,
        description: stepConfig.description,
        side: stepConfig.side,
      },
    }],
    onDestroyed: () => { /* cleanup */ },
  });
  d.drive();
}
```

**WelcomeTour replacement:**

The current WelcomeTour in `welcome-tour.tsx` is triggered by `?welcome=1` and runs a linear driver.js tour. The new onboarding system replaces this entirely. The TOUR_STYLES CSS has been extracted to `onboarding.css` in Sprint 2. The WelcomeTour component should be either:
1. Replaced with a re-export of the OnboardingOrchestrator, OR
2. Deleted entirely if no other code imports it

Search for imports of `WelcomeTour` to determine which approach.

**subscription-gate.tsx adjustment:**

Currently, `subscription-gate.tsx` uses `?welcome=1` as a bypass condition (skip subscription check). This should continue to work, but the param should NOT be stripped from the URL here — let it flow through to the dashboard where the OnboardingOrchestrator picks it up.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
