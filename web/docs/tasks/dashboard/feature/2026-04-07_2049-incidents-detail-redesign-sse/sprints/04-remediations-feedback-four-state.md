# Sprint 4: Remediations + Feedback Four-State UX

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 4 of 5
- **Depends on:** Sprint 1 (the bug fix added the `error` state)
- **Batch:** 2 (parallel with Sprint 3)
- **Model:** sonnet
- **Estimated effort:** S/M

## Objective

Replace the lying "no remediations proposed yet" copy with the four explicit states (`loading | error | pending | completed-empty | populated`) on both the Remediations and Feedback sections. Add the `incidentStatus` prop to `<RemediationsSection>` so it can distinguish "investigation still running, no remediations YET" from "investigation finished with zero remediations". Independently shippable after Sprint 1.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/remediations-empty-state.tsx` — visual state component for the four non-populated states.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/feedback-empty-state.tsx` — same pattern for feedback.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/remediations-empty-state.test.tsx` — RTL tests for each state.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/feedback-empty-state.test.tsx` — RTL tests.

### Modifies (can touch)

- `apps/dashboard/src/contexts/investigation/presentation/components/remediations-section.tsx` — accept `incidentStatus` prop; switch on the four states; replace the bug-fixed Sprint 1 placeholder with the new `<RemediationsEmptyState>` component.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx` — same four-state pattern using `<FeedbackEmptyState>`.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/en.json` — add new keys: `dashboard.incidents.detail.remediations.investigationPending`, `dashboard.incidents.detail.remediations.completedEmpty`, `dashboard.incidents.detail.remediations.errorState`, `dashboard.incidents.detail.remediations.retry`, `dashboard.incidents.detail.feedback.errorState`, `dashboard.incidents.detail.feedback.retry`.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/pt-br.json` — same keys with PT-BR translations.

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/investigation/domain/types.ts` — for `IncidentStatus`, `Remediation`.
- `apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts` (Sprint 1) — for any shared status helpers.
- `apps/dashboard/src/lib/api/core-api-types.ts` — for `FeedbackItem`.

### Shared Contracts (consume from prior sprints or PRD)

- `IncidentStatus` from `domain/types.ts`.
- The four-state pattern is mirrored from Sprint 1's bug fix — Sprint 1 added `error`, this sprint adds `pending` and `completed-empty`.

### Consumed Invariants (from INVARIANTS.md)

- `Loading... literal banned` — Sprint 1 already removed it; this sprint must not reintroduce it.
- `No barrel imports` — direct deep paths only.

## Tasks

- [x] In `infrastructure/i18n/en.json`, add under `dashboard.incidents.detail.remediations`:
  - `"investigationPending": "Waiting for the investigation to propose remediations..."`
  - `"completedEmpty": "Investigation complete — no remediations needed."`
  - `"completedEmptyWithCause": "Investigation complete — no remediations needed. Root cause: {rootCause}"`
  - `"errorState": "Could not load remediations."`
  - `"retry": "Retry"`
  Add under `dashboard.incidents.detail.feedback`:
  - `"errorState": "Could not load feedback."`
  - `"retry": "Retry"`
- [x] Add the same six keys to `infrastructure/i18n/pt-br.json` with PT-BR translations:
  - `investigationPending`: `"Aguardando a investigação propor remediações..."`
  - `completedEmpty`: `"Investigação concluída — nenhuma remediação necessária."`
  - `completedEmptyWithCause`: `"Investigação concluída — nenhuma remediação necessária. Causa raiz: {rootCause}"`
  - `errorState` (remediations): `"Não foi possível carregar as remediações."`
  - `errorState` (feedback): `"Não foi possível carregar o feedback."`
  - `retry`: `"Tentar novamente"`
- [x] Create `remediations-empty-state.tsx`:
  - Props: `{ state: 'pending' | 'completed-empty' | 'error'; rootCause?: string; onRetry?: () => void }`.
  - Renders a card with the appropriate icon (`Clock` for pending, `CheckCircle2` for completed-empty, `AlertCircle` for error), the translated copy, and a Retry button when state is `error` AND `onRetry` is provided.
  - When `state === 'completed-empty'` AND `rootCause` is provided, uses the `completedEmptyWithCause` key with interpolation.
- [x] Create `feedback-empty-state.tsx`:
  - Props: `{ state: 'empty' | 'error'; onRetry?: () => void }`.
  - Renders the appropriate state. The `empty` state uses the existing `dashboard.incidents.detail.feedback.empty` key from i18n.
- [x] Modify `remediations-section.tsx`:
  - Add `incidentStatus?: IncidentStatus` to the props interface (OPTIONAL — defaults to undefined which means "in-progress" / pending state).
  - Add `rootCause?: string` to the props interface (optional — Sprint 5 will pass it).
  - Replace the existing render branches with this logic:
    ```
    if (loading) -> skeleton (already in Sprint 1)
    if (error) -> <RemediationsEmptyState state="error" onRetry={fetchRemediations} />
    if (remediations.length === 0) {
      const inProgress = ['open', 'triaging', 'investigating', 'awaiting_approval', 'remediating'].includes(incidentStatus);
      if (inProgress) return <RemediationsEmptyState state="pending" />;
      return <RemediationsEmptyState state="completed-empty" rootCause={rootCause} />;
    }
    return populated list (existing JSX)
    ```
  - Keep the existing `RemediationCard` JSX and behavior unchanged.
  - Remove the literal `t('noRemediations')` rendering — replaced by the new branches.
- [x] Modify `incident-feedback.tsx`:
  - Replace the `feedback === null` and empty branches with `<FeedbackEmptyState>` calls.
  - The action buttons (Confirm RCA / Reject RCA / Add Context) and the `<ActionForm>` MUST remain unchanged.
- [x] Tests:
  - `remediations-empty-state.test.tsx`: renders each of the three states; renders Retry button only when `onRetry` is provided AND `state === 'error'`; clicking Retry calls `onRetry`; `completed-empty` with `rootCause` uses the inline-cause copy.
  - `feedback-empty-state.test.tsx`: renders both states; Retry button behavior.
  - Update or add tests in any existing `remediations-section.test.tsx` (if it exists, otherwise create one) to verify the new four-state branching: pending state when status is `investigating`, completed-empty when status is `resolved`.

## Acceptance Criteria

- [x] `<RemediationsSection>` accepts an `incidentStatus` prop (TypeScript-optional; Sprint 5 will pass it).
- [x] When `incidentStatus` is in `['open', 'triaging', 'investigating', 'awaiting_approval', 'remediating']` and remediations is `[]`, shows the pending state.
- [x] When `incidentStatus` is in `['resolved', 'closed']` and remediations is `[]`, shows the completed-empty state — NOT "no remediations proposed yet".
- [x] When the fetch errors, shows the error state with a Retry button.
- [x] Same four-state behavior for `<IncidentFeedback>`.
- [x] No literal `"Loading..."` strings.
- [x] All new and existing investigation tests pass.

## Verification

- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation/`
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation/presentation/components`
- [x] `pnpm turbo check-types --filter=dashboard`

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

- The current `t('noRemediations')` value is `"No remediations proposed yet"` in `en.json`. Do NOT delete the key — it may be used by other components. Just stop rendering it from `remediations-section.tsx`.
- This sprint depends on Sprint 1's bug fix (the error state machinery). Sprint 1 may have stubbed `<RemediationsSection>` with a basic error renderer; this sprint replaces that stub with the proper `<RemediationsEmptyState>` component.
- **TypeScript optionality strategy:** Make `incidentStatus` an OPTIONAL prop on `<RemediationsSection>` for now. When undefined, the component falls back to the existing `pending` empty state (the "in-progress" assumption). Sprint 5 makes it required when it rewrites the call site. This avoids needing to touch `incident-detail.tsx` from this sprint and keeps file boundaries clean. Same approach for `<IncidentFeedback>` — both new props are optional.
- This sprint MUST NOT modify `incident-detail.tsx`. The call-site update belongs to Sprint 5. Optional props let both files build green at every stage.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
