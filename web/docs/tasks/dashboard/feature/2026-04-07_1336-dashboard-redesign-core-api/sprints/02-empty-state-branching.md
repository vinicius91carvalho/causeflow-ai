# Sprint 02 — Empty-State Branching: Pure Function + Branch Components

**Batch:** 2
**Depends on:** 01
**Model:** sonnet
**Estimated:** 45–60 min

## Objective

Introduce deterministic three-branch empty-state logic (`A`, `B`, `C`) as a single pure function plus the two new empty-state components (`BranchAEmptyState`, `BranchBEmptyState`). Branch C is handled in sprint 4. Existing `DashboardEmptyState` will be renamed or retired depending on reuse.

## Context (from PRD §2 Goal 4, §6.3, §8)

- The branch function has signature `selectEmptyStateBranch({ hasAnalyses, hasIntegrations }) → 'A' | 'B' | 'C'`.
- Truth table: `(false,false)=A`, `(false,true)=B`, `(true,false)=C` (degenerate — treat as C; analyses imply something happened), `(true,true)=C`.
- Branch A copy: title "Welcome to CauseFlow", subtitle explains the user has nothing connected yet. Two buttons: "Connect Integration" → `/dashboard/integrations`, "Set up Relay" → `/dashboard/relay` (see Risk note in PRD §12; if route missing, sprint 4 will swap to `/dashboard/integrations?type=relay`).
- Branch B copy: same welcome title, subtitle explains integrations are connected, now create first analysis. Single button: "Create Your First Analysis" → `/dashboard/analyses/new`.
- Both branches reuse the same feature-list UI from the existing `DashboardEmptyState` (three feature lines).
- All copy goes through `next-intl`. Add new keys under `dashboard.home.emptyState.branchA.*` and `.branchB.*` in both `en.json` and `pt-br.json` inside `contexts/shared/infrastructure/i18n/`.

## Tasks

1. [x] Create `apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.ts` with the `EmptyStateBranch` type and the `selectEmptyStateBranch` function.
2. [x] Write `empty-state-branch.test.ts` with all 4 truth-table cases.
3. [x] Create `apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx`. Accept a `messages` prop for all text. Two `<Link>` buttons.
4. [x] Create `apps/dashboard/src/contexts/shared/presentation/components/branch-b-empty-state.tsx`. Single CTA button.
5. [x] Write component tests `branch-a-empty-state.test.tsx` and `branch-b-empty-state.test.tsx` asserting the correct hrefs, button counts, and text.
6. [x] Add i18n keys in `contexts/shared/infrastructure/i18n/en.json` and `pt-br.json` under `dashboard.home.emptyState`:
   ```json
   "branchA": { "title": "...", "subtitle": "...", "connectIntegration": "Connect Integration", "setUpRelay": "Set up Relay" },
   "branchB": { "title": "...", "subtitle": "...", "createFirstAnalysis": "Create Your First Analysis" }
   ```
7. [x] Extend `dashboard-page.tsx`'s `messages` object to include the new keys. **Do not** wire them into `DashboardOverview` yet — sprint 4 does the wiring. Just ensure the keys are available.
8. [x] Add `data-testid` attributes: `branch-a-empty-state`, `branch-b-empty-state`, `cta-connect-integration`, `cta-setup-relay`, `cta-create-first-analysis`.

## Acceptance Criteria

- [x] `selectEmptyStateBranch` exported with full type, all 4 truth cases tested.
- [x] `BranchAEmptyState` renders two buttons with hrefs `/dashboard/integrations` and `/dashboard/relay`.
- [x] `BranchBEmptyState` renders single button with href `/dashboard/analyses/new`.
- [x] New i18n keys present in both `en.json` and `pt-br.json` with matching structure.
- [x] Vitest unit and component tests pass.
- [x] `pnpm turbo check-types` green.

## Agent Notes

### Decisions

1. **Test strategy: source-file inspection (not jsdom rendering)** — The vitest project config uses `environment: 'node'`, consistent with all existing component tests in the codebase. All new tests use `readFileSync` + string assertions rather than DOM rendering. This aligns with the established pattern in `empty-state.test.tsx`, `quick-actions.test.tsx`, etc.

2. **BranchA/BranchB accept full feature-list messages** — The `messages` prop on both components includes `feature1`, `feature2`, `feature3` so the feature highlights rows can be driven by i18n. These keys reuse the existing `home.emptyState.feature1/2/3` values in `dashboard-page.tsx` rather than adding redundant new keys.

3. **dashboard-page.tsx branchA/branchB messages include feature labels** — To avoid Sprint 4 needing to touch `dashboard-page.tsx` again just to add feature labels, the sub-objects passed through include `feature1/2/3` derived from the already-loaded shared keys.

4. **Extra test file `dashboard-page.test.ts` created** — TDD hook requires a test file before modifying `dashboard-page.tsx`. Created a minimal source-inspection test verifying the new keys exist. This is within the sprint's scope since the spec says to extend that file.

### Assumptions

- 🟢 `biome.json` ignoring worktree paths — all 'post-edit-quality.sh' warnings are expected and non-blocking; the hook cannot process files outside the main project root
- 🟢 Pre-existing failures (integration-card timeout, choose-plan-page import, services.test.ts TenantPlan) — confirmed these exist on main/Sprint 1 branch and are not introduced by Sprint 2
- 🟡 `/dashboard/relay` route — spec notes this may not exist yet; Sprint 4 will swap to `/dashboard/integrations?type=relay` if needed

### Issues Found

- None introduced by Sprint 2. Three pre-existing test failures remain:
  1. `integration-card.test.tsx` — 15s import timeout (pre-exists on main)
  2. `choose-plan-page.test.tsx` — default export mismatch (pre-exists on worktree branch, fixed on main after branch fork)
  3. `system-status.test.tsx` — dynamic import timeout (Sprint 1 work, pre-exists on branch)

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.ts
  - apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.test.ts
  - apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.test.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/branch-b-empty-state.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/branch-b-empty-state.test.tsx

files_to_modify:
  - apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json
  - apps/dashboard/src/contexts/shared/infrastructure/i18n/pt-br.json
  - apps/dashboard/src/contexts/shared/presentation/pages/dashboard-page.tsx

files_read_only:
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-empty-state.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx

shared_contracts:
  - EmptyStateBranch type
  - selectEmptyStateBranch signature
```

## Verification Steps

1. `pnpm --filter dashboard test -- empty-state-branch branch-a branch-b`
2. `pnpm turbo check-types --filter=dashboard`
3. Verify i18n JSON is valid (`node -e 'JSON.parse(require("fs").readFileSync("apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json"))'`).
