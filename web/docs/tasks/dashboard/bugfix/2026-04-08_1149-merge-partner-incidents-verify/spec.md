# Merge Partner's Incidents Page — Verify & Adapt to Current Layout

## State of Play (read this first)

**The merge is already committed.** Merge commit `d8503cb` on local `main` (Apr 8, 2026
11:33 UTC) already integrated Sergio's origin/main changes (commits `01dee81`,
`3411ac7`, `f5bdd3b`) into our `incident-detail-redesign` work. Local `main` is 11
commits ahead of `origin/main`; `git log main..origin/main` is empty (nothing in
origin/main that isn't already in local main).

What the merge did:
- Kept our two-column grid layout (`lg:grid-cols-12`) + full sub-component decomposition
  (`incident-detail/` sub-folder: `IncidentNarrative`, `IncidentStatusPanel`,
  `LiveActivityTimeline`, `IncidentActionBar`, `DisconnectedBanner`, etc.).
- Kept our SSE-based `useIncidentStream` hook and `useIncidentActions` hook — dropped
  the partner's 5-second polling (`POLL_INTERVAL_MS`).
- **Kept partner's additions:** `InvestigationLiveFeed` WebSocket component,
  `/api/investigation/[id]/relay-token` BFF proxy, and the `http-api-client.ts`
  feedback URL fix (`/v1/knowledge/feedback` → `/v1/investigation/{id}/feedback`).
- Wired `InvestigationLiveFeed` into the right column, **above** `LiveActivityTimeline`
  (the two components are complementary — LiveActivityTimeline is the audit-trail
  history view, InvestigationLiveFeed is the interactive live WebSocket relay).
- Added `investigation-live-feed.test.tsx` — 5 smoke tests.

What was verified in the merge commit:
- `pnpm exec biome check` — clean
- `pnpm turbo check-types` — 7 successful tasks
- `pnpm turbo test` — 794 tests pass (incl. 5 new live-feed smoke + 157 investigation regression)
- `pnpm turbo build` — successful, relay-token route appears in the manifest

**What is NOT yet done:** Playwright browser verification of the merged UI on the
running dev server. The End-of-Task Browser Verification Protocol (mandatory for UI/API
work per global CLAUDE.md) was skipped during the merge. The user's request — "resolve
merge conflicts and verify with Playwright" — explicitly calls this out as the missing
step. Plus, since the merge happened in an earlier session and nobody has actually
*looked* at the page since, there is a real chance that subtle layout/visual issues
exist: right-column stacking order, spacing between the live feed and timeline,
`awaiting_approval` status visibility (the partner's original design showed the feed in
that state, which we preserved), or console errors from the WebSocket connection flow.

This PRD is therefore primarily a **verification + adjustment** task, not a fresh
merge. If Playwright verification turns up no issues, this is a quick sign-off. If it
turns up issues, those become scope.

## What & Why

**Problem:** Sergio pushed incident-detail redesign work (live WebSocket feed +
relay-token proxy) to `origin/main`. We had simultaneously done our own incidents-
detail-redesign sprint sequence (Sprints 1-5 of `dashboard-redesign-core-api`, plus the
`incident-detail-compact` refactor). The merge commit `d8503cb` integrated both sets of
changes on disk and in `git`, but the user has never actually loaded the resulting
incidents page in a browser to confirm it works end-to-end. The task is to close that
loop: run the dev server, drive the affected routes with Playwright, confirm both
consoles are clean, and fix anything that breaks.

**Desired Outcome:**
1. The incidents list page (`/en/dashboard/incidents`) loads cleanly with no console
   errors on dev server + browser.
2. The incident detail page (`/en/dashboard/incidents/[id]`) renders with our
   two-column layout intact: left column shows `IncidentNarrative` +
   `RemediationsSection` + `IncidentFeedback`; right column shows
   `IncidentStatusPanel` + `InvestigationLiveFeed` + `LiveActivityTimeline` in that
   order.
3. `InvestigationLiveFeed` is visible when the incident is in a live state
   (`open | triaging | investigating | awaiting_approval`), hidden otherwise, and
   shows a "Waiting for agent activity..." placeholder when there are no messages yet.
4. `LiveActivityTimeline` still shows the audit-trail history correctly and subscribes
   to the SSE stream.
5. No hydration mismatches, no React key warnings, no unhandled promise rejections,
   no 500s from the relay-token route (even if it returns 503 "Core API not configured"
   in local dev — that is expected and the UI should degrade gracefully).
6. Portuguese locale (`/pt-br/dashboard/incidents/[id]`) renders correctly.
7. If any of the above fails, fix it in this task — not a follow-up.

## Correctness Contract

**Audience:** Vinicius (me) and Sergio. The decision this output enables: "Is it safe to
push the merge to origin/main and continue building on top of it?"

**Failure:** The page compiles and tests pass, but a real user loading
`/en/dashboard/incidents/[incidentId]` sees a broken layout, a missing section, a
console error flood, or a hydration mismatch. Worse: the `InvestigationLiveFeed`
silently fails to connect and the user never knows the live feed is broken.

**Danger:** We push the merge to origin/main with a subtle regression in the incident
detail page — which is the single most critical screen in the whole product. If the
incident detail page is broken, SREs cannot do their job. Also: if the relay-token
route leaks authentication tokens or returns sensitive data in errors, that is a
security regression.

## Context Loaded

- **`apps/dashboard/CLAUDE.md`** — Incident detail lives at
  `src/contexts/investigation/presentation/components/incident-detail.tsx`; page route
  is the thin re-export at `app/[locale]/dashboard/incidents/[id]/page.tsx`; bounded
  contexts + DDD layers are mandatory; direct deep imports only (no barrels); `lib/db`
  aggregation imports are removed — types come from
  `@/contexts/investigation/domain/types`.
- **`~/.claude/CLAUDE.md` — End-of-Task Browser Verification** — mandatory for any task
  touching UI or API routes. Must start dev server, drive with Playwright MCP, take
  screenshots to `.artifacts/playwright/screenshots/YYYY-MM-DD_HHmm/`, check browser +
  server consoles, fix any errors before claiming complete. Playwright MCP stays in the
  main agent, never delegated.
- **`~/.claude/CLAUDE.md` — Anti-Premature Completion Protocol** — "all tests pass" is
  not sufficient; dev server must start AND routes must render AND consoles must be
  clean before claiming completion.
- **Merge commit `d8503cb` body** — documents the resolution strategy: keep our
  layout, add `InvestigationLiveFeed` to the right column above `LiveActivityTimeline`,
  keep partner's relay-token route and `http-api-client.ts` feedback URL fix. Kept
  biome-ignore on `[feed]` dependency (auto-scroll effect).
- **`incident-detail.tsx` (current, verified on disk)** — imports both
  `LiveActivityTimeline` and `InvestigationLiveFeed`; places them in the right column
  in that order; passes `isInProgress || incident.status === 'awaiting_approval'` to
  the live feed (so the feed is visible in awaiting_approval per partner's fix
  `3411ac7`).
- **`investigation-live-feed.tsx` (current, verified on disk)** — client component;
  fetches `/api/investigation/[id]/relay-token`; degrades silently if relay unavailable
  (`return null` when `!isInProgress && feed.length === 0`); guidance input disabled
  when not connected.
- **`relay-token/route.ts` (current, verified on disk)** — wrapped in `withAuth`; uses
  `getBackendToken()` (Clerk JWT); returns 503 if `CORE_API_URL` is not set. In local
  dev without Core API this is expected, and the client component should handle it
  gracefully.
- **Dev server command (project rule #5)** — `pnpm turbo dev` starts both website
  (3000) and dashboard (3001). Must kill existing Next.js/Playwright processes before
  starting: `pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f
  playwright 2>/dev/null`.
- **PRoot environment** — Turbopack crashes; Webpack only. `next dev --hostname
  localhost` (not 127.0.0.1 — Clerk requires localhost). Chromium only on arm64.

## Acceptance Criteria

- [ ] Dev server starts cleanly (`pnpm turbo dev`) — dashboard compiles without errors
      or warnings about the merged files.
- [ ] Playwright navigates to `http://localhost:3001/en/dashboard/incidents` and the
      list page renders (or the configured empty/auth state renders correctly).
- [ ] Playwright navigates to an incident detail page (either via the list page or a
      seeded test incident) and the two-column layout is visible: left column has
      narrative/remediations/feedback; right column has status panel, live feed (or its
      hidden state), and activity timeline — in that vertical order.
- [ ] `InvestigationLiveFeed` component is rendered in the DOM when the incident status
      is one of `open | triaging | investigating | awaiting_approval`. The "Live
      Investigation Feed" heading is visible.
- [ ] `LiveActivityTimeline` is rendered beneath the live feed and shows the audit-
      trail entries (or its loading/empty state, depending on the fixture).
- [ ] Browser console has ZERO ERRORS and ZERO warnings caused by our code (third-party
      analytics-blocker warnings are allowed and must be documented).
- [ ] Dev server console has ZERO compilation errors and ZERO runtime exceptions. React
      hydration warnings = FAIL.
- [ ] `/pt-br/dashboard/incidents/[id]` also renders without errors (hreflang + i18n
      sanity check).
- [ ] Screenshots saved under `.artifacts/playwright/screenshots/2026-04-08_HHmm/` —
      at minimum `incidents-list_en.png`, `incident-detail_en.png`,
      `incident-detail_pt-br.png`.
- [ ] If any visual/layout issue is found, a fix is applied in the same task and the
      verification loop is re-run until both consoles are clean.

## Non-Goals / Boundaries

- **NOT re-doing the merge.** The merge is committed and verified by unit/type tests.
  Reverting `d8503cb` is out of scope.
- **NOT touching the live WebSocket relay backend.** The backend/core side of the
  WebSocket relay belongs to the `core` service, not this repo. In local dev the relay
  will not connect; that is the expected degraded state and the UI must handle it.
- **NOT adding new features** to the incidents page. No new buttons, no new data, no
  new layout sections.
- **NOT modifying `LiveActivityTimeline` or `IncidentNarrative`** unless a bug is
  found. These landed in earlier sprints and are tested.
- **NOT modifying `http-api-client.ts`** unless a bug is found. The feedback URL fix
  from partner's commit was kept as-is.
- **Files that MUST NOT be modified (unless a bug is found AND user is notified first):**
  - `apps/dashboard/src/contexts/investigation/domain/types.ts`
  - `apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts`
  - `apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-stream.ts`
  - `apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-actions.ts`
  - Anything under `packages/`.
- **NOT pushing to origin/main or deploying** as part of this task. That is the
  `/ship-test-ensure` skill's job, invoked separately by the user after they sign off.

## If Uncertain

**Stop and ask the user.** Rationale: the merge already happened in a prior session and
the user's intent for this task is to verify, not re-merge. If verification turns up
something unexpected (e.g., a missing file, a hydration error that requires changing
a core hook, a failing test that wasn't flagged by the merge commit), the right move is
to surface it immediately rather than guess, because the user needs to decide whether
the fix falls within scope or becomes a follow-up task.

Specifically, **stop and ask** if any of these happen:
- Dev server fails to start for a reason unrelated to the merge (port conflict,
  missing dep, pnpm store corruption).
- Playwright cannot load the site at all (e.g., Clerk redirects block the test user).
- A fix requires modifying a file listed in the "MUST NOT be modified" list above.
- The verification scope creeps past the incident detail page (e.g., fixing the
  incidents list page reveals that the whole dashboard sidebar is broken).
- More than one approach to a fix is defensible and the choice is load-bearing.

## Tradeoff Resolution

**When partner's change conflicts with our layout: partner's logic wins; our layout
wins.** Concretely:
- Partner's `InvestigationLiveFeed` component + its behavior (WebSocket relay, guidance
  input, auto-scroll) is **kept as-is**. Do not refactor it just because the style
  differs from our sub-components.
- Partner's `/api/investigation/[id]/relay-token` route is **kept as-is**.
- Partner's `http-api-client.ts` feedback URL change is **kept as-is**.
- But the **placement** and the **surrounding layout** follow our structure: two-column
  grid, right column stacking order (status → live feed → timeline), our sub-component
  decomposition remains.
- The polling-based refresh from partner's version (5s interval) is **discarded** in
  favor of our SSE `useIncidentStream` hook — this was already decided in the merge
  commit and is not re-opened here.

**When tests catch a bug but fixing it expands scope: stop, log the bug, ask the
user.** Do not silently fix unrelated issues found along the way.

**When a console warning is ambiguous (third-party vs ours): err on the side of
fixing.** Production code does not ship debug output.

## Verification

- [ ] `pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f playwright
      2>/dev/null` — kill stale processes first.
- [ ] `pnpm turbo dev` — both website + dashboard start; keep dashboard log visible.
- [ ] `pnpm exec biome check .` — clean on touched files (should already be clean from
      the merge commit, but re-verify).
- [ ] `pnpm turbo check-types` — clean (should already pass from merge commit).
- [ ] `pnpm turbo test --filter=dashboard` — all dashboard tests pass (should be 794
      passing from merge commit; any new regression is a FAIL).
- [ ] Playwright MCP navigates to `http://localhost:3001/en/dashboard/incidents`,
      takes a screenshot, calls `browser_console_messages`, classifies every entry.
- [ ] Playwright MCP navigates to an incident detail URL (list page click, or a
      known-good ID if the list page is empty), takes a screenshot, checks the
      console.
- [ ] Playwright MCP navigates to `http://localhost:3001/pt-br/dashboard/incidents/[id]`,
      takes a screenshot, checks the console.
- [ ] Dashboard dev server log is re-read after each navigation — zero runtime
      exceptions, zero hydration mismatches, zero React key warnings, zero unhandled
      rejections, zero 500s from the relay-token route.
- [ ] All screenshots saved under
      `.artifacts/playwright/screenshots/2026-04-08_1149/`.
- [ ] Final report lists each route verified, both console states, and confirms the
      Anti-Premature Completion Protocol checklist.

## Implementation

- [ ] **Step 1 — Pre-flight:** Run the kill command. Confirm ports 3000/3001 are free.
      Confirm `git status` is clean. Confirm `git log -1` is the merge commit
      `d8503cb`.
- [ ] **Step 2 — Start dev server in background:** `pnpm turbo dev` with
      `run_in_background: true`. Capture the log handle. Wait for the dashboard to
      report ready on `http://localhost:3001`.
- [ ] **Step 3 — Verify static checks still clean:** run biome, check-types, and the
      dashboard filter of the test suite. If any regress vs the merge commit, stop
      and investigate.
- [ ] **Step 4 — Playwright: incidents list (EN):** `browser_navigate` to
      `http://localhost:3001/en/dashboard/incidents`. Take screenshot. Read console.
      Read server log. If not signed in, handle the Clerk sign-in flow with a test
      account (document the credentials in session-learnings if not already there).
- [ ] **Step 5 — Playwright: incident detail (EN):** Click into a listed incident, or
      navigate directly to a seeded ID if the list is empty. Take screenshot. Verify
      the two-column layout is visible and both the live feed section and the activity
      timeline are present in the right column. Verify `InvestigationLiveFeed` shows
      the "Waiting for agent activity..." placeholder if the relay isn't connected.
      Read console. Read server log.
- [ ] **Step 6 — Playwright: incident detail (PT-BR):** Navigate to the `/pt-br/`
      equivalent of the same incident. Take screenshot. Verify translations render.
      Read console. Read server log.
- [ ] **Step 7 — Fix-loop:** For every ERROR or WARN found in steps 4-6, fix it at the
      source (not by suppressing). After each fix, if it is a code change, loop back to
      the static checks (step 3) and re-navigate the affected route (steps 4-6). Do
      NOT mark the task complete until both consoles are clean on every route.
- [ ] **Step 8 — Regression tests:** Re-run `pnpm turbo test --filter=dashboard` after
      any fix. All 794+ tests must still pass.
- [ ] **Step 9 — Kill dev server:** Run the kill command again to clean up.
- [ ] **Step 10 — Evidence + final report:** Confirm final screenshots in
      `.artifacts/playwright/screenshots/2026-04-08_1149/`. Write a final report
      listing each route verified, both console states, test count, and the
      Anti-Premature Completion Protocol checklist items (re-read this spec, enumerate
      remaining items, cite evidence per criterion, dev server started, tested as
      user).

## Learnings (filled after completion)

_To be filled in the /compound step after task completion._
