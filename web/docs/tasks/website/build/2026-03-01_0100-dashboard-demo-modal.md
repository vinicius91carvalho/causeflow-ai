# Enable Dashboard Button with Demo Modal on Production

## Context (The Why)
The "Dashboard" button in the website navigation is currently disabled (greyed-out `<span>`) on production. Users should instead see a clickable button that opens a modal showcasing a dashboard demo video alongside a lead capture form — converting curiosity into leads.

## Definition (The What)
Create a new `DashboardDemoModal` component using Shadcn Dialog. The modal shows an auto-playing demo video and the lead capture form (same fields/endpoint as the existing `ContactModal`). Update both header and mobile menu to use this modal on production instead of the disabled span.

## Acceptance Criteria (The How to Test)
- [ ] Dashboard button on production opens the demo modal (not disabled)
- [ ] Video autoplays (muted) in the modal
- [ ] Form submits to `/api/notify` and shows success state with confetti
- [ ] Responsive layout: mobile (stacked video+form) vs desktop (side-by-side)
- [ ] Staging still links to actual dashboard (unchanged behavior)
- [ ] All existing tests pass
- [ ] Playwright screenshots verify layout at multiple viewports

## Restrictions (The Boundaries)
- Do NOT change staging/dev behavior (still links to SITE.dashboardUrl)
- Reuse existing form logic pattern from ContactModal
- Use existing Shadcn components from @causeflow/ui
- Keep the same `/api/notify` endpoint

## Phase 1: Research & Setup
- [x] Read ContactModal for form logic pattern
- [x] Read header.tsx for current Dashboard button logic
- [x] Read mobile-menu.tsx for current Dashboard button logic
- [x] Check existing i18n keys that can be reused
- [x] Verify demo video exists at expected path

## Phase 2: Implementation
- [x] Create DashboardDemoModal component
- [x] Update header.tsx to use modal on production
- [x] Update mobile-menu.tsx to use modal on production
- [x] Add any needed i18n keys (none needed — reusing existing patterns)

## Phase 3: Validation
- [x] Run lint (`pnpm exec biome check .`) — auto-fixed format in new file
- [x] Run type check (`pnpm turbo check-types`) — PASS, all 7 packages clean
- [x] Run build (`pnpm turbo build`) — PASS, website 32 pages + dashboard 45 pages
- [x] Run tests (`pnpm turbo test`) — PASS, 602 tests across 59 files
- [x] Dev server verification — no server-side or front-end errors
- [x] Playwright screenshots at multiple viewports (desktop 1280, mobile 375)

## Phase 4: Compound
- [x] Document learnings
- [x] Update session-learnings if needed — no new patterns needed

## Learnings
- Replicating form logic from ContactModal was straightforward since the pattern is well-established
- The `<video autoPlay muted playsInline loop>` pattern works correctly; `muted` is required for autoplay
- The two-column layout (`flex-col lg:flex-row`) with `lg:w-3/5` / `lg:w-2/5` provides a good video/form ratio
- Using `max-w-5xl` on DialogContent accommodates the wider layout well
- DialogHeader with `sr-only` keeps the title accessible while hiding it visually (since the form section has its own visible heading)
