# Sprint 2: Core UI Components

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 4
- **Depends on:** Sprint 1
- **Batch:** 2 (sequential)
- **Model:** sonnet
- **Estimated effort:** L

## Objective

Build the OnboardingChecklist floating widget, OnboardingModal (welcome + complete), OnboardingStepCard, useOnboardingProgress hook, and onboarding CSS. These are standalone components that consume the domain types from Sprint 1.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-checklist.tsx` — Floating widget (bottom-right) showing progress with step list
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-modal.tsx` — Full-screen modal for welcome + mission complete steps
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-step-card.tsx` — Expandable card within checklist for each step
- `apps/dashboard/src/contexts/onboarding/presentation/hooks/use-onboarding-progress.ts` — Hook for reading/writing progress via API, local optimistic state
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding.css` — Detective/mission theme styles (extracted from TOUR_STYLES + new checklist styles)

### Modifies (can touch)

- None (all new files)

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/onboarding/domain/types.ts` — Domain types from Sprint 1
- `apps/dashboard/src/contexts/shared/presentation/components/welcome-tour.tsx` — TOUR_STYLES CSS to extract/adapt
- `apps/dashboard/src/contexts/shared/lib/confetti.ts` — Confetti functions to call on completion
- `packages/ui/src/themes/` — Theme tokens for CSS variables

### Shared Contracts (consume from prior sprints or PRD)

- `OnboardingProgress` interface from Sprint 1
- `StepKey` type from Sprint 1
- `OnboardingStepConfig` interface (defined in PRD Section 12)
- `OnboardingChecklistProps`, `OnboardingModalProps` interfaces (defined in PRD Section 12)

### Consumed Invariants (from INVARIANTS.md)

- Onboarding step keys — must match domain type: `welcome|integrations|relay|firstIncident|receiveEvents|billing|complete`
- Onboarding step status — must render all three: `pending|completed|skipped`

## Tasks

- [ ] Create `use-onboarding-progress.ts` hook:
  - Fetches `GET /api/onboarding/progress` on mount
  - Returns `{ progress, loading, error, startOnboarding, completeStep, skipStep, skipAll, completeOnboarding }`
  - Implements optimistic updates (update local state immediately, sync to API)
  - Uses SWR-like pattern: fetch once, cache in state, mutations call PATCH then update local
- [ ] Create `onboarding.css`:
  - Extract TOUR_STYLES from `welcome-tour.tsx` (the detective/mission-briefing theme)
  - Add new styles for: checklist widget container, step cards, progress bar, minimize/expand animation, mobile FAB
  - Use CSS variables from the theme system (`hsl(var(--primary))`, etc.)
- [ ] Create `onboarding-step-card.tsx`:
  - Renders: icon, title, description, status badge (pending/completed/skipped)
  - Click handler calls `onStepClick(stepKey)`
  - Completed steps show green checkmark
  - Skipped steps show dimmed styling
  - Pending steps show a "Go" action button
- [ ] Create `onboarding-checklist.tsx`:
  - Fixed position bottom-right (desktop: full panel, mobile: collapsed FAB)
  - Header: "Mission Briefing" title + progress indicator ("3/6 steps")
  - Progress bar (visual)
  - List of OnboardingStepCard components
  - Footer: "Skip Tutorial" button
  - Minimize/expand toggle button
  - Minimized state: small floating button with progress count badge
  - Animation: slide-in from bottom-right on mount
- [ ] Create `onboarding-modal.tsx`:
  - Full-screen overlay with centered card
  - `type='welcome'`: detective-themed welcome message, "Begin Mission" CTA, "Skip" secondary button
  - `type='complete'`: celebration message, confetti trigger, "Close" CTA
  - Escape key to dismiss
  - Backdrop click to dismiss
  - Animate entrance (fade + scale)

## Acceptance Criteria

- [ ] `useOnboardingProgress` hook fetches and caches progress, provides mutation functions
- [ ] OnboardingChecklist renders all 7 steps with correct status indicators
- [ ] OnboardingChecklist can be minimized to a FAB and expanded back
- [ ] OnboardingModal renders welcome and complete variants
- [ ] OnboardingModal welcome triggers on first load, complete triggers when all steps done
- [ ] Confetti fires on modal complete dismiss
- [ ] All components use CSS variables from the theme system (works in light and dark mode)
- [ ] Components are responsive: full widget on desktop (>1024px), FAB on mobile

## Verification

- [ ] Build passes: `pnpm turbo build`
- [ ] Lint passes: `pnpm exec biome check .`
- [ ] Type-check passes: `pnpm turbo check-types`
- [ ] Components render without errors (visual verification in Sprint 3)

## Context

**Design direction:**

Continue the "detective/mission briefing" theme established in the current welcome tour. Use the same CSS patterns from TOUR_STYLES:
- JetBrains Mono for badges/labels
- Primary color accents with subtle gradients
- Step badges like `<span class="causeflow-tour-step-badge">STEP 01</span>`
- Box shadows with emerald/primary color glow

**Checklist widget layout (desktop):**
```
+-----------------------------------+
| Mission Briefing     [_] [x]     |
| ================================ |
| [========------] 4/6 steps       |
| ================================ |
| [v] Welcome to HQ               |
| [v] Connect Integrations    ->  |
| [v] Set Up Relay             ->  |
| [ ] Create First Incident    ->  |
| [ ] Receive Events           ->  |
| [v] Review Billing           ->  |
| ================================ |
|        [Skip Tutorial]           |
+-----------------------------------+
```

**Checklist widget (mobile minimized):**
```
  +------+
  | 4/6  |
  | [?]  |
  +------+
```

**useOnboardingProgress hook pattern:**

```typescript
function useOnboardingProgress() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding/progress')
      .then(res => res.json())
      .then(data => setProgress(data.progress))
      .finally(() => setLoading(false));
  }, []);

  const completeStep = async (step: StepKey) => {
    // Optimistic update
    setProgress(prev => ...);
    // API sync
    await fetch('/api/onboarding/progress', { method: 'PATCH', body: ... });
  };

  // ... similar for skipStep, skipAll, etc.
}
```

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
