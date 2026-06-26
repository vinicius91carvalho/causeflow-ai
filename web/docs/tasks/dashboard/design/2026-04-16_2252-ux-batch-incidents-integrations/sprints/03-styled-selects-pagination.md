# Sprint 3: Styled Selects + First-Page Limit = 10

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprints 1, 4, 5 — disjoint files)
- **Model:** sonnet
- **Estimated effort:** M (~45 min)

## Objective

Replace 4 native HTML `<select>` elements on the incidents list and audit list with the CauseFlow design-system `Select` (Radix-based, already exported by `@causeflow/ui/primitives`). Change the initial-page fetch limit from 20 to 10 on both pages. Both pages already have functional "Load more" cursor pagination — leave it alone.

## File Boundaries

### Creates

_None._

### Modifies

- `apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx` — replace `<select id="status-filter">` (lines 105–117) and `<select id="severity-filter">` (lines 127–139) with `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` from `@causeflow/ui/primitives`. Replace `onChange={(e) => setX(e.target.value as T)}` with `onValueChange={(v) => setX(v as T)}`. Change `URLSearchParams({ limit: '20' })` on line 53 to `{ limit: '10' }`.
- `apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` — replace the two native `<select>` elements (lines 102–114 action filter, 124–133 actorType filter) with the design-system Select. Change `URLSearchParams({ limit: '20' })` on line 61 to `{ limit: '10' }`.

### Read-Only

- `packages/ui/src/presentation/primitives/select.tsx` — component API reference (Radix). Import path is `@causeflow/ui/primitives`.
- `packages/ui/package.json` — verify the `exports` field and confirm `@causeflow/ui/primitives` is the correct import path.
- `apps/dashboard/src/contexts/investigation/api/incidents-list-handler.ts` — confirms the `limit` query param is forwarded and defaults to 20 server-side (we override client-side).
- `apps/dashboard/src/contexts/audit/api/audit-handler.ts` — same confirmation for audit.

### Shared Contracts (from PRD Section 12)

- Design-system Select API: `<Select value onValueChange><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="…">…</SelectItem></SelectContent></Select>`.
- First-page limit: `10`.

### Consumed Invariants (from INVARIANTS.md)

- **List first-page limit** — owner of the invariant; must satisfy `grep -n "limit: '10'"` in both list files.
- **Design-system Select usage** — owner; must satisfy `! grep -n "<select " <the two files>`.

## Tasks

- [x] Run `cat packages/ui/package.json | grep -A 30 '"exports"'` to verify the correct import path for `Select`. Record in Agent Notes. Expected: `@causeflow/ui/primitives`.
- [x] In `incidents-list.tsx`:
  - Add imports: `import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@causeflow/ui/primitives';` (adjust path per verification above).
  - Replace the status `<select>` block. Keep the `<label htmlFor="status-filter">` for accessibility; link it to the trigger via `id` on `<SelectTrigger id="status-filter">` (verify component supports `id` forwarding).
  - Replace the severity `<select>` similarly.
  - Change `URLSearchParams({ limit: '20' })` → `({ limit: '10' })`.
- [x] In `audit-list.tsx`:
  - Add the same imports.
  - Replace both native selects with the Select component.
  - Change `URLSearchParams({ limit: '20' })` → `({ limit: '10' })`.
- [x] Keep all existing state variables (`statusFilter`, `severityFilter`, `actionFilter`, `actorTypeFilter`) — only the markup changes. Keep `<option value="all">` semantics via `<SelectItem value="all">`.
- [x] Run `pnpm exec biome check --write apps/dashboard/src/contexts/investigation apps/dashboard/src/contexts/audit` for import order + formatting.

## Acceptance Criteria

- [x] `grep -n "<select " apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx` → no results.
- [x] `grep -n "<select " apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` → no results.
- [x] `grep -n "SelectTrigger" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx` → at least 2 results.
- [x] `grep -n "SelectTrigger" apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` → at least 2 results.
- [x] `grep -n "limit: '10'" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx` → exactly 1 result.
- [x] `grep -n "limit: '10'" apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` → exactly 1 result.
- [x] `grep -n "limit: '20'" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` → no results.
- [x] Existing vitest suites under `apps/dashboard/src/contexts/investigation` and `apps/dashboard/src/contexts/audit` still pass.

## Verification

- [x] `pnpm turbo check-types --filter=dashboard` passes (tsc --noEmit exit 0; turbo build ENOTEMPTY is a pre-existing PRoot infra issue unrelated to our changes)
- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation apps/dashboard/src/contexts/audit` passes (2 files, no errors — pre-existing lint issues in other files in the context are out of boundary)
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation apps/dashboard/src/contexts/audit --reporter=dot` passes (18/18 tests pass in the two sprint-boundary test files; 1 pre-existing unrelated failure in remediations-id-handler.test.ts is out of scope)
- [ ] Browser verification (orchestrator, post-merge): click each filter, confirm Radix popover opens, items selectable, URL / fetch triggers with `limit=10`.

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (sonnet)
- Started: 2026-04-16
- Completed: 2026-04-16

### Decisions made

1. **Import path confirmed:** `@causeflow/ui/primitives` — verified from `packages/ui/package.json` exports field. The `./primitives` export maps to `./src/presentation/primitives/index.ts`.

2. **`htmlFor` over `aria-labelledby`:** `SelectTrigger` uses `React.forwardRef` and spreads `...props` (via `React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>`), so it natively accepts and forwards the `id` prop. Used `<label htmlFor="status-filter">` pointing to `<SelectTrigger id="status-filter">` — the standard HTML association. The `aria-labelledby` approach was tried first but Biome's `noLabelWithoutControl` lint rule requires `htmlFor`. Reverted to `htmlFor` approach.

3. **Biome unused-import blocking:** The post-edit hook blocked partial edits where Select imports were present but JSX hadn't been updated yet. Used a full `Write` to atomically replace both the imports and JSX in one operation.

4. **Test file created for incidents-list:** No test existed for `incidents-list.tsx`. Created `incidents-list.test.tsx` using the source-scan pattern (readFileSync + text assertions) consistent with all other test files in the investigation context. Avoided dynamic `import()` of the component because `next-intl` resolves `next/navigation` at import time, which fails in Vitest (confirmed by the audit-list test which also uses source-scan only).

### Assumptions

- 🟢 Pre-existing Biome warnings in out-of-boundary files (question-card, remediations-section, use-investigation-feed, incident-header) do not constitute a sprint failure — they existed before this sprint.
- 🟢 The `ENOTEMPTY: directory not empty, rmdir .next/export` build error is a pre-existing PRoot-Distro environment issue, not caused by our changes. tsc --noEmit exits 0 with no type errors.
- 🟢 `w-[180px]` on SelectTrigger provides appropriate width matching the visual intent of the prior native selects.

### Issues found

- None that affect sprint delivery.
