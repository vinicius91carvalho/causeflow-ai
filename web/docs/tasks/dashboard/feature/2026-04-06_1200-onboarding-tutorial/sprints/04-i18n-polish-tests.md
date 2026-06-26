# Sprint 4: i18n + Polish + Tests

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 4 of 4
- **Depends on:** Sprint 3
- **Batch:** 4 (sequential)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Add EN + PT-BR translations for all onboarding strings, responsive polish, comprehensive unit/integration tests, and final cleanup.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/onboarding/infrastructure/i18n/en.json` — English translations for all onboarding UI
- `apps/dashboard/src/contexts/onboarding/infrastructure/i18n/pt-br.json` — Portuguese translations
- `apps/dashboard/src/contexts/onboarding/presentation/hooks/use-onboarding-progress.test.ts` — Hook unit tests
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-checklist.test.tsx` — Widget render tests
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-modal.test.tsx` — Modal render tests
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-orchestrator.test.tsx` — Integration tests
- `apps/dashboard/src/contexts/onboarding/api/progress-handler.test.ts` — API handler tests
- `apps/dashboard/src/contexts/onboarding/infrastructure/onboarding-repository.test.ts` — Repository tests

### Modifies (can touch)

- `apps/dashboard/src/lib/i18n/compose.ts` — Add onboarding context to the deep-merge import list
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-checklist.tsx` — Add `useTranslations` calls, replace hardcoded strings
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-modal.tsx` — Add `useTranslations` calls
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-step-card.tsx` — Add `useTranslations` calls
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-orchestrator.tsx` — Add `useTranslations` calls
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding.css` — Responsive polish, mobile FAB refinements, animation tuning

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json` — Reference for existing tour keys (to be superseded but kept for backward compat)
- `apps/dashboard/src/contexts/shared/infrastructure/i18n/pt-br.json` — Reference for PT-BR patterns
- `apps/dashboard/src/lib/i18n/compose.ts` — Understand the deep-merge pattern before modifying

### Shared Contracts (consume from prior sprints or PRD)

- All domain types from Sprint 1
- All UI components from Sprint 2
- Orchestrator from Sprint 3
- next-intl `useTranslations` API

### Consumed Invariants (from INVARIANTS.md)

- Onboarding step keys — i18n keys must match step keys
- All UI strings must exist in both en.json and pt-br.json

## Tasks

- [ ] Create `onboarding/infrastructure/i18n/en.json`:
  - Namespace: `onboarding`
  - Keys for: checklist title, step titles, step descriptions, modal welcome title/description/CTA, modal complete title/description/CTA, skip button, progress text, mark-as-done button, minimize button, expand button
  - Maintain detective/mission-briefing tone: "Mission Briefing", "Connect your evidence sources", "Deploy your field agent", etc.
- [ ] Create `onboarding/infrastructure/i18n/pt-br.json`:
  - Full translation of all en.json keys
  - Maintain the same thematic tone in Portuguese
- [ ] Update `lib/i18n/compose.ts`:
  - Import onboarding i18n files
  - Add to the deep-merge sequence
- [ ] Update all onboarding components to use `useTranslations('onboarding')`:
  - `onboarding-checklist.tsx` — checklist title, progress text, skip button
  - `onboarding-modal.tsx` — welcome/complete titles, descriptions, CTAs
  - `onboarding-step-card.tsx` — step titles, descriptions, mark-as-done button
  - `onboarding-orchestrator.tsx` — any orchestrator-level text
- [ ] Polish `onboarding.css`:
  - Ensure smooth animations (slide-in, expand/collapse, FAB)
  - Mobile breakpoint: <640px collapses to FAB
  - Tablet: 640-1024px shows compact widget
  - Desktop: >1024px shows full widget
  - Dark mode compatibility (all colors use CSS variables)
  - Focus styles for keyboard navigation
  - Reduce motion media query for users who prefer reduced motion
- [ ] Write tests:
  - `use-onboarding-progress.test.ts`: mock fetch, test loading/success/error states, test mutation functions
  - `onboarding-checklist.test.tsx`: render with various progress states, test step click callbacks, test minimize/expand
  - `onboarding-modal.test.tsx`: render welcome variant, render complete variant, test dismiss callback, test confetti trigger
  - `onboarding-orchestrator.test.tsx`: test ?welcome=1 detection, test step navigation, test skip flow, test completion flow
  - `progress-handler.test.ts`: mock repository, test GET returns null for no record, test PATCH actions
  - `onboarding-repository.test.ts`: mock DynamoDB client, test CRUD operations
- [ ] Remove old tour keys from `shared/infrastructure/i18n/en.json` if no longer referenced (check WelcomeTour is fully removed first)
- [ ] Final cleanup: remove any console.logs, dead code, unused imports across all onboarding files

## Acceptance Criteria

- [ ] All onboarding UI renders correctly in English (no hardcoded strings)
- [ ] All onboarding UI renders correctly in Portuguese (switch locale and verify)
- [ ] `compose.ts` includes onboarding translations in the merged message tree
- [ ] Checklist widget is responsive: full on desktop, compact on tablet, FAB on mobile
- [ ] Animations respect `prefers-reduced-motion` media query
- [ ] All unit tests pass: hook, components, API handler, repository
- [ ] No hardcoded strings remain in onboarding components
- [ ] No console.logs or dead code in onboarding files
- [ ] All lint and type-check passes

## Verification

- [ ] Build passes: `pnpm turbo build`
- [ ] Lint passes: `pnpm exec biome check .`
- [ ] Type-check passes: `pnpm turbo check-types`
- [ ] All tests pass: `pnpm turbo test`
- [ ] Dev server: onboarding shows correct text in both locales

## Context

**i18n pattern in this project:**

Each bounded context owns its translations at `infrastructure/i18n/`. The `lib/i18n/compose.ts` file deep-merges all context files:

```typescript
// compose.ts pattern (simplified)
import sharedEn from '@/contexts/shared/infrastructure/i18n/en.json';
import onboardingEn from '@/contexts/onboarding/infrastructure/i18n/en.json';
// ... etc

const messages = {
  en: deepMerge(sharedEn, onboardingEn, ...),
  'pt-br': deepMerge(sharedPtBr, onboardingPtBr, ...),
};
```

Components use `useTranslations('onboarding')` to access their namespace.

**Detective theme i18n keys (English):**

```json
{
  "onboarding": {
    "checklist": {
      "title": "Mission Briefing",
      "progress": "{completed} of {total} steps",
      "skip": "Skip Tutorial",
      "minimize": "Minimize",
      "expand": "Expand briefing"
    },
    "steps": {
      "welcome": { "title": "Welcome to HQ", "description": "Your command center is ready." },
      "integrations": { "title": "Connect Evidence Sources", "description": "Link your tools — Slack, GitHub, AWS, and more." },
      "relay": { "title": "Deploy Field Agent", "description": "Set up the CauseFlow Relay to stream real-time data." },
      "firstIncident": { "title": "Open First Case", "description": "Create your first incident investigation." },
      "receiveEvents": { "title": "Incoming Intel", "description": "See how events flow from your connected sources." },
      "billing": { "title": "Review Field Office", "description": "Check your credits and plan details." },
      "complete": { "title": "Mission Complete", "description": "All systems operational." }
    },
    "modal": {
      "welcome": { "title": "Welcome, Detective", "description": "...", "cta": "Begin Mission", "skip": "Skip Briefing" },
      "complete": { "title": "Mission Accomplished", "description": "...", "cta": "Close Briefing" }
    },
    "highlight": {
      "markDone": "Mark as Done"
    }
  }
}
```

**Test patterns:**

This project uses Vitest for unit/integration tests. Test files are colocated next to source files (`.test.ts` / `.test.tsx`). Use `@testing-library/react` for component tests. Mock `fetch` for API calls. Mock `useRouter` for navigation tests.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
