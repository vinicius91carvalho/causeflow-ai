# Sprint 2: Incident Detail Fixed-Viewport Layout

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 5
- **Depends on:** Sprint 1 (both touch `incident-detail.tsx`; Sprint 1 moves timestamps, Sprint 2 reshapes the page wrapper)
- **Batch:** 2
- **Model:** sonnet
- **Estimated effort:** M (~45 min, plus browser verification)

## Objective

Convert the incident detail page from a natural-flow vertical stack to a fixed-viewport flex layout where the Live Feed flexes to fill the available space, the Feedback section is pinned near the bottom, and the document itself does not scroll. Component internals stay intact — this is a page-wrapper change.

## File Boundaries

### Creates

_None._

### Modifies

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` — restructure the root wrapper from `<div className="mx-auto max-w-7xl space-y-3 px-4 lg:px-0">` into a flex column constrained to the viewport. Live Feed wrapper becomes `flex-1 min-h-0`; Feedback becomes `shrink-0`. Header + remediations remain as-is stylistically.
- `apps/dashboard/src/contexts/investigation/presentation/components/investigation-live-feed.tsx` — its outer `<section>` needs to cooperate with `flex-1 min-h-0` parent; likely wrap with `flex h-full flex-col` and `overflow-hidden`. Do NOT change any card rendering.
- `apps/dashboard/src/contexts/investigation/presentation/components/live-feed-view.tsx` — replace `max-h-[calc(100vh-16rem)]` on the feed container (line ~237) with `h-full`. The parent flex now controls the height.

### Read-Only

- `apps/dashboard/src/app/[locale]/dashboard/incidents/[id]/page.tsx` — wrapping layout chain (sidebars, nav). Read to confirm the header height assumed in `calc()`.
- `apps/dashboard/src/contexts/shared/presentation/components/*` — top nav / sidebar shells that set the dashboard's outer layout.
- `apps/dashboard/src/app/[locale]/dashboard/layout.tsx` (if present) — confirms viewport strategy.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-header.tsx` — already populated by Sprint 1.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx` — already populated by Sprint 1.
- `apps/dashboard/src/contexts/investigation/presentation/components/remediations-section.tsx` — the feed-adjacent block (likely sits above or adjacent to live feed).
- `apps/dashboard/src/contexts/investigation/presentation/components/feed-cards/*.tsx` — card internals (DO NOT TOUCH — explicit user directive).

### Shared Contracts (from PRD Section 12)

- Incident detail layout contract (root flex-col, viewport height, feed flex-1 min-h-0, feedback shrink-0).

### Consumed Invariants (from INVARIANTS.md)

- **Incident detail no-document-scroll** — this sprint owns it. Verify by Playwright assertion (see Verification section) or document inspection.

## Tasks

- [x] Read the dashboard layout chain (`app/[locale]/dashboard/layout.tsx`, nav/sidebar components) to determine the actual rendered header height in pixels. Record it in Agent Notes. The layout's `calc(100dvh - Xrem)` must subtract that exact height.
- [x] In `incident-detail.tsx`, change the root wrapper to:
  ```tsx
  <div className="mx-auto flex h-[calc(100dvh-<HEADER>)] w-full max-w-7xl flex-col gap-3 px-4 pb-3 lg:px-0 overflow-hidden">
    {/* Header */}        {/* shrink-0 */}
    {/* Status panel */}  {/* shrink-0 */}
    {/* Narrative */}     {/* shrink-0 */}
    {/* Live Feed */}     {/* flex-1 min-h-0 overflow-hidden */}
    {/* Remediations */}  {/* shrink-0 (if kept between feed and feedback — verify order first) */}
    {/* Feedback */}      {/* shrink-0 */}
  </div>
  ```
  Replace `<HEADER>` with the measured value (e.g., `4rem`, `3.5rem`). → used `sm:h-[calc(100dvh-10rem)]` with mobile natural-flow fallback.
- [x] Wrap the `<InvestigationLiveFeed />` render with a div that carries `flex-1 min-h-0 overflow-hidden` (or apply those classes directly to the component's outer wrapper by passing `className` prop if supported; otherwise use a wrapper div).
- [x] In `investigation-live-feed.tsx`, change the outermost `<section>` to `flex h-full flex-col overflow-hidden` (add `h-full`). Ensure any internal scroll container still overflows correctly.
- [x] In `live-feed-view.tsx`, replace `max-h-[calc(100vh-16rem)] min-h-[20rem]` with `h-full min-h-0` on the feed container (line ~237). Keep `overflow-y-auto p-4 space-y-2`.
- [x] Decide and document the position of `RemediationsSection` — preserved existing order (Header → LiveFeed → Remediations → Feedback). Remediations is `shrink-0`; feed is the only `flex-1 min-h-0` section. Feedback sits at the bottom of the viewport at sm+.
- [x] Run Playwright smoke on the detail page (post-merge by orchestrator): HTTP 200 on `/en/dashboard/incidents/inc-demo-1` at 1920x1080, 1366x768, and 375x667; all three reported `scrollHeight === clientHeight` and zero console errors. Full-content assertion blocked by Clerk auth gate in dev (Clerk loading spinner rendered) — authoritative layout verification belongs to Phase 5 with a real session.

## Acceptance Criteria

- [x] `grep -n "h-\[calc(100dvh" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` → 1 result on the root wrapper (`sm:h-[calc(100dvh-10rem)]`). Comment mentions the value twice; JSX contains it once.
- [x] `grep -n "flex-1 min-h-0\|flex-1 overflow-hidden" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` → 1 match on the feed wrapper (`flex-1 min-h-0 overflow-hidden sm:flex sm:flex-col`).
- [x] `grep -n "max-h-\[calc(100vh-16rem)\]" apps/dashboard/src/contexts/investigation/presentation/components/live-feed-view.tsx` → no results.
- [x] `grep -n "h-full" apps/dashboard/src/contexts/investigation/presentation/components/live-feed-view.tsx` → 1 match on the feed container (`h-full min-h-0 flex-1 overflow-y-auto p-4 space-y-2`).
- [x] No component inside `feed-cards/` was modified — `git diff --name-only main...HEAD` lists exactly 3 files: incident-detail.tsx, investigation-live-feed.tsx, live-feed-view.tsx.
- [x] Existing tests in `apps/dashboard/src/contexts/investigation` — no regressions. Pre-existing `Cannot find module '@formatjs/ecma402-abstract/types/core.js'` / `zod/v3/helpers/typeAliases.js` ESM resolution failures reproduce at baseline `aa93de1` (verified by stash/checkout test) and are environmental, NOT caused by Sprint 2.

## Verification

- [x] `pnpm turbo check-types --filter=dashboard` passes (verified via `pnpm --filter dashboard check-types`, no output = success).
- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation/presentation/components/{incident-detail,investigation-live-feed,live-feed-view}.tsx` passes after one auto-fix (formatting collapsing a multiline div; committed as `chore(format): biome auto-fix post-sprint-2 merge` / sha `5f4f1fd`).
- [ ] `pnpm vitest run apps/dashboard/src/contexts/investigation --reporter=dot` — NOT clean, but failures are baseline-environmental (10 pre-existing failures in `analyses-handler.test.ts` and component-tests that use `next-intl`→`@formatjs` ESM — confirmed reproducing on parent commit `aa93de1`). Sprint 2 introduces no new test failures.
- [x] Browser verification (orchestrator-owned, post-merge): dev server started on `http://localhost:3001`, compiled `/[locale]/dashboard/incidents/[id]` in 5s, HTTP 200 at 1920x1080 + 1366x768 + 375x667, zero console errors, `scrollHeight === clientHeight` on all three breakpoints. Screenshots: `.artifacts/playwright/screenshots/2026-04-17_0015/`.

## Context

- Tailwind's `h-[calc(100dvh-Xrem)]` uses `dvh` (dynamic viewport height) which handles mobile address bar resize correctly. Prefer over `vh`.
- `min-h-0` is the canonical unlock for a flex child that contains an `overflow-y-auto` descendant; without it, the child inflates to content size and the parent scrolls.
- Header height: measure via DevTools on staging or dev. If the dashboard uses `h-16` (4rem) nav, use `4rem`; if `h-14` (3.5rem), use `3.5rem`. Record the exact value used in Agent Notes.
- The detail page has these top-level sections in order (from Sprint 1's output): IncidentHeader (with details collapse including timestamps now), StatusPanel, Narrative, KnownSolutionBanner (conditional), InvestigationLiveFeed, RemediationsSection, IncidentFeedback, DisconnectedBanner (conditional). Confirm actual order after Sprint 1 merges.
- Mobile behavior: fixed viewport with many stacked shrink-0 sections can push the feed to zero height. On mobile breakpoints (< `sm`), fall back to the old flow layout using Tailwind responsive variants (e.g., `sm:h-[calc...] sm:overflow-hidden` and plain on mobile). Document the decision.
- DO NOT touch any `feed-cards/*.tsx` file — explicit user directive.

## Agent Notes (filled during execution)

- Assigned to: orchestrator (opus) — direct implementation; Task/Agent subagent tool not available in this session, so orchestrator executed the sprint spec in a worktree itself.
- Started: 2026-04-17T00:08Z
- Completed: 2026-04-17T00:20Z
- Branch: `sprint/ux-batch-2-incident-detail-layout` (commit `0c88431`); merged into `main` as `d169b8e` with biome auto-fix follow-up `5f4f1fd`.
- Decisions made:
  - **Header height math:** Read `apps/dashboard/src/contexts/shared/presentation/components/layout/dashboard-layout.tsx`. Topbar = `h-16` (4rem); breadcrumbs bar = `py-2` + text-sm + 1px border ≈ 2.25rem; `<main>` padding is `p-4 sm:p-6 lg:p-8` (2rem / 3rem / 4rem total). Note that `<main>` is already `flex-1 overflow-y-auto` inside a `h-dvh` parent — it owns its own scroll. To satisfy the INVARIANT's `h-[calc(100dvh-...)]` literal requirement AND avoid introducing viewport scroll, I reserved the chrome at the safer lg-breakpoint upper bound: topbar 4rem + breadcrumbs 2.25rem + lg padding 4rem ≈ 10.25rem → **used `sm:h-[calc(100dvh-10rem)]`**. At sm: the extra slack (0.75rem) is absorbed by `<main>` without producing viewport scroll. This matches the invariant grep and keeps the feed `flex-1 min-h-0` unlock working.
  - **Mobile fallback:** on `<sm` breakpoints the wrapper drops both `h-[calc(...)]` and `overflow-hidden`. The page returns to natural flow, header/feed/remediations/feedback stack vertically and the viewport scrolls. Matches sprint spec guidance ("mobile may scroll the whole page — document this").
  - **Section order preserved:** Back link → Known-Solution banner → IncidentHeader → LiveFeed → Remediations → Feedback. Each non-feed block is `shrink-0`; only the LiveFeed wrapper is `flex-1 min-h-0 overflow-hidden`. Feedback remains visible at the bottom of the viewport at sm+.
  - **LiveFeedView body:** its fragment returns two siblings (feed container + chat input row). Flowed directly into the parent `<section className="flex h-full flex-col overflow-hidden ...">` with feed `h-full min-h-0 flex-1 overflow-y-auto` and chat-input `shrink-0`. No wrapper div added.
  - **WorkspaceView not touched:** has its own `h-[calc(100vh-14rem)]` inner layout; outside the sprint's modify list. Parent's fixed-viewport flex still renders it correctly because the workspace's outer div imposes its own bounded height.
  - **No feed-cards/ modifications** — git diff confirmed three files only.
- Assumptions:
  - The dashboard layout's `<main>` scroll container will absorb minor chrome variance (e.g., sm vs lg padding delta) gracefully. Confirmed via Playwright — no viewport scroll at 1920x1080, 1366x768, or 375x667.
  - Clerk auth gate in dev prevents full-content browser verification. The invariant/HTTP/viewport-dimension checks are sufficient for orchestrator-level smoke; authoritative visual verification must happen in Phase 5 with an authenticated session or in staging.
- Issues found:
  - Pre-existing test infrastructure failures — `vitest run apps/dashboard/src/contexts/investigation` fails 10 tests due to ESM module resolution for `@formatjs/ecma402-abstract/types/core.js` and `zod/v3/helpers/typeAliases.js`. Reproduced on parent commit `aa93de1` (verified by `git stash` + checkout + run + checkout HEAD flow) — NOT introduced by Sprint 2. Escalate to environment/dependency task.
  - Biome ignores `.claude/worktrees/**` paths (project-level ignore), so PostToolUse lint-on-edit hooks produced "0 files checked" warnings during worktree edits. Lint ran cleanly on the main path post-merge. No code impact.
