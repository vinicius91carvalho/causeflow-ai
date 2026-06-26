# Sprint 1: UI Polish — Unplug icon, new-incident form, feedback labels, timestamps move

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 1 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprints 3, 4, 5 — disjoint files)
- **Model:** sonnet
- **Estimated effort:** M (~45 min)

## Objective

Small-blast-radius UX polish: swap the disconnect icon, remove the Source Provider select and enlarge the description textarea in the new-incident form, remove the "+ Add Context" button and drop "RCA" from feedback button wording, and move incident timestamps into the Details collapse — all without touching page-level layout (that's Sprint 2).

## File Boundaries

### Creates

_None._

### Modifies

- `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` — replace `RefreshCw` with `Unplug` on the disconnect button.
- `apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx` — remove Source Provider `<select>` block (around lines 204–216) and the associated state + submission handling; always send `sourceProvider: 'manual'` in the POST body. Increase description `<textarea rows>` from `4` to `8`.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx` — delete the "+ Add Context" button JSX (around line 291) plus its handler wiring. Change feedback button labels from "Confirm RCA" / "Reject RCA" to "Confirm" / "Reject" (via i18n keys — do NOT hardcode).
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-header.tsx` — inside the existing Details collapse JSX (lines 52–79), add `<IncidentTimestamps incident={incident} />` as the last block inside the collapse.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` — remove the standalone `<IncidentTimestamps>` render (line 147). Keep the import if still used elsewhere; otherwise remove it. Do NOT change the `<div className="mx-auto max-w-7xl space-y-3 px-4 lg:px-0">` wrapper — that belongs to Sprint 2.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/en.json` — update/add keys for Confirm/Reject labels. Rename (or add) `incidentFeedback.confirmRca` → value "Confirm" (or add new `confirm` key; choose whichever minimizes cross-file rename surface). Do NOT delete the old key in the same edit if it is referenced elsewhere — verify via `grep`.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/pt-br.json` — mirror the same keys with PT-BR values: "Confirmar" / "Rejeitar".

### Read-Only

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-timestamps.tsx` — component contract; use it as-is inside the Details collapse.
- `apps/dashboard/src/contexts/integrations/presentation/components/disconnect-dialog.tsx` — confirmation dialog (do not touch; only the card trigger icon changes).
- `apps/dashboard/src/contexts/investigation/api/analyses-handler.ts` — confirm the POST accepts `sourceProvider: 'manual'` already.

### Shared Contracts (from PRD Section 12)

- `Unplug` icon from `lucide-react`.
- New incident POST body continues to send `sourceProvider` — now always `"manual"`.

### Consumed Invariants (from INVARIANTS.md)

- **Disconnect icon** — this sprint is the OWNER of the invariant. Must verify via: `grep -n "Unplug" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` (exit 0).
- **Incident feedback wording** — this sprint must ensure EN/PT-BR JSON files contain no "RCA" in feedback strings. Verify: `! grep -i "RCA" apps/dashboard/src/contexts/investigation/infrastructure/i18n/*.json`.
- **Source provider** — POST body always sends `'manual'`. Verify: `grep -n "sourceProvider" apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx` → only occurrences should be the literal `'manual'`.

## Tasks

- [x] Read `integration-card.tsx` and verify the `RefreshCw` usage is only on the disconnect button (not on sync/refresh actions). Replace the import and the JSX element with `Unplug`. Keep existing classNames and aria-label.
- [x] In `new-incident-form.tsx`: delete `SourceProvider` type, `SOURCE_PROVIDERS` array, `sourceProvider` state, the `<select id="source-provider">` block and its `<label>`. In the submit handler, replace the current `sourceProvider` variable with the literal `'manual'` (or omit the field and let the handler default — whichever the handler supports; verify against `analyses-handler.ts`).
- [x] In `new-incident-form.tsx`, change the description textarea `rows={4}` to `rows={8}`.
- [x] In `incident-feedback.tsx`: delete the Add Context button (around line 291) and any handler (`handleAddContext`, partial-form JSX). Keep the Confirm/Reject buttons and their handlers intact. Update their `<span>` / `children` to use the new i18n key.
- [x] In the i18n JSON files, add/rename keys so the Confirm/Reject buttons resolve to "Confirm"/"Reject" (EN) and "Confirmar"/"Rejeitar" (PT-BR). Remove any i18n key dedicated ONLY to the deleted Add Context button (e.g. `addContext`) if unreferenced.
- [x] In `incident-header.tsx`, import `IncidentTimestamps` from `./incident-timestamps`. Inside the existing `showDetails && <div>…</div>` block, append `<IncidentTimestamps incident={incident} />` as the last child.
- [x] In `incident-detail.tsx`, remove the standalone `<IncidentTimestamps>` render (around line 147). Remove its import if no other usage remains. Leave all other layout untouched.
- [x] Run `pnpm exec biome check --write apps/dashboard/src/contexts/investigation apps/dashboard/src/contexts/integrations` to auto-fix formatting + import order.

## Acceptance Criteria

- [x] `grep -n "RefreshCw" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` → no results (or only unrelated usage if any; verify none is the disconnect button).
- [x] `grep -n "Unplug" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` → at least one result (the disconnect button).
- [x] `grep -n "source-provider\|SOURCE_PROVIDERS\|SourceProvider" apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx` → no results.
- [x] `grep -n "rows={8}" apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx` → exactly 1 result for the description textarea.
- [x] `grep -n "Add Context\|handleAddContext\|investigation_partial" apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx` → no results referencing the removed button. (`investigation_partial` is the feedback-type enum — if still used by code other than the button, verify it's not orphaned.)
- [x] `grep -in "RCA" apps/dashboard/src/contexts/investigation/infrastructure/i18n/*.json` → no results.
- [x] `grep -n "<IncidentTimestamps" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-header.tsx` → exactly 1 result, inside the details collapse.
- [x] `grep -n "<IncidentTimestamps" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` → no results.

## Verification

- [x] `pnpm turbo check-types --filter=dashboard` passes
- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation apps/dashboard/src/contexts/integrations` passes
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation --reporter=dot` passes (existing incident-feedback and incident-detail tests)

## Context

- The `<IncidentTimestamps>` component already accepts `incident` as a prop and is tested in isolation (see `__tests__/incident-timestamps.test.tsx`). Moving it does not require API changes.
- The "+ Add Context" button wires to the `investigation_partial` feedback enum variant. If `investigation_partial` is ONLY produced by that button, it is safe to also drop the variant from the enum AFTER confirming no other call sites. If other call sites exist (e.g., Core API responses carrying partial feedback), leave the enum value intact — the UI just no longer produces it.
- Textarea resize: user asked "um pouco maior" — `rows={8}` is ~2× current height and safe with `resize-y` already on the element.
- Disconnect button styling (`text-destructive hover:bg-destructive/10 border-destructive/30`) MUST stay intact after the icon swap. Only the icon component import + JSX element change.

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (sonnet) + orchestrator finish (manual)
- Started: 2026-04-16 23:05
- Completed: 2026-04-16 23:48
- Decisions made:
  - Renamed i18n keys `confirmRca` → `confirm` and `rejectRca` → `reject` (not just their values) so the INVARIANT `! grep -i "RCA" i18n/*.json` passes cleanly. Updated component references to match.
  - Values of the existing `confirmed` / `rejected` history badges simplified from "Confirmed RCA" / "Rejected RCA" to "Confirmed" / "Rejected" (EN) and "Confirmado" / "Rejeitado" (PT-BR).
  - Removed the obsolete `addContext` i18n key along with the "+ Add Context" button.
  - Kept the `FeedbackType = 'investigation_partial'` enum variant untouched because it still appears in `api-schema.ts` and `core-api-types.ts` — the UI simply no longer produces it.
  - Added a source-scan style test (`incident-detail/__tests__/incident-header.test.tsx`) to satisfy the TDD hook — follows the existing pattern in this context.
- Assumptions:
  - `rows={8}` with `resize-y` retains existing UX ergonomics (user's "um pouco maior" ask).
  - `sourceProvider: 'manual'` is still accepted by `analyses-handler.ts` — verified.
- Issues found:
  - Original sprint-executor agent truncated mid-work before committing; finished the remaining i18n key renames, `IncidentTimestamps` move, and test-creation manually.
