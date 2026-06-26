# Sprint 05 — Playwright E2E + Dev-Server Smoke

**Batch:** 4
**Depends on:** 04
**Model:** sonnet
**Estimated:** 45–60 min

## Objective

Add a Playwright spec that exercises all three empty-state branches and the full Branch-C dashboard, asserts every `/api/*` request returns 200, asserts zero console errors and zero page errors, and verifies one section's failure does not break the page.

## Context (PRD §11 AC-1..AC-9)

All E2E is stub-based — Playwright intercepts `/api/*` routes and returns canned responses. The test never touches real Core. The Next.js dev server starts via Playwright `webServer` config (already configured at the repo root).

## Tasks

1. Create `apps/dashboard/tests/dashboard-overview.spec.ts`.
2. Add a `beforeEach` that sets up shared route interceptions and attaches listeners:
   - `page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); })`
   - `page.on('pageerror', err => pageErrors.push(err))`
3. Define a `stubEndpoints(page, overrides?)` helper that intercepts every `/api/*` used by the dashboard and returns canned 200 JSON. Overrides let individual tests flip specific endpoints to empty arrays or 500 errors.
4. **Test 1 — Branch A (no analyses, no integrations):**
   - Stub `/api/metrics` to return `{ totalIncidents: 0, openIncidents: 0, mttr: 0, ... }`.
   - Stub `/api/integrations` to return `[]`.
   - Visit `/dashboard`.
   - Assert `data-testid="branch-a-empty-state"` visible.
   - Assert `data-testid="cta-connect-integration"` has href `/dashboard/integrations`.
   - Assert `data-testid="cta-setup-relay"` has href matching the route sprint 4 verified.
   - Assert `consoleErrors.length === 0`.
5. **Test 2 — Branch B (no analyses, has integrations):**
   - Stub metrics with `totalIncidents: 0`; integrations with one item.
   - Assert `data-testid="branch-b-empty-state"` visible.
   - Assert `data-testid="cta-create-first-analysis"` has href `/dashboard/analyses/new`.
   - Assert `consoleErrors.length === 0`.
6. **Test 3 — Branch C (full dashboard):**
   - Stub metrics with `totalIncidents: 42`; integrations with three items; all other section endpoints with canned data.
   - Assert `data-testid="system-operational-card"` visible.
   - Assert all 7 section `data-testid`s visible.
   - Assert `data-testid="metric-total-analyses"` contains `42`.
   - Assert `data-testid="metric-monthly-analyses"` has count 0 (removed card).
   - Assert `consoleErrors.length === 0` and `pageErrors.length === 0`.
   - Collect all `/api/*` responses; assert every one is 200.
7. **Test 4 — Section error fence:**
   - Stub Branch C endpoints as in test 3, but make `/api/memory/insights` return 500.
   - Assert `data-testid="memory-insights-section"` shows error chip.
   - Assert all other sections still render normally.
   - Assert the page itself did not crash (`system-operational-card` still visible).
8. **Test 5 — `/api/health` contract:**
   - Intercept `/api/health`; assert that the request URL matches `^/api/health$` exactly — never `/api/health/detailed`.
9. Run `pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null` before starting to satisfy project rule.
10. Run the spec: `pnpm exec playwright test apps/dashboard/tests/dashboard-overview.spec.ts`.

## Acceptance Criteria

- [ ] All 5 Playwright tests pass.
- [ ] Dev server starts cleanly with no errors on stdout during the run.
- [ ] Zero `console.error` events captured in any test.
- [ ] Zero `pageerror` events in any test.
- [ ] Every `/api/*` response observed in Branch-C test returns 200 (except the deliberate 500 in test 4).
- [ ] `pnpm exec biome check .` clean.
- [ ] Final: `pnpm turbo test` and `pnpm turbo check-types` both green across the monorepo.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/tests/dashboard-overview.spec.ts

files_to_modify:
  - apps/dashboard/CLAUDE.md    # append E2E spec to test convention section if notable

files_read_only:
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/branch-b-empty-state.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/*
  - apps/dashboard/src/contexts/shared/presentation/components/system-operational-card.tsx
  - playwright.config.ts

shared_contracts:
  - data-testid attributes defined in sprints 2 and 4
```

## Verification Steps

1. `pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null`
2. `pnpm exec playwright test apps/dashboard/tests/dashboard-overview.spec.ts`
3. `pnpm turbo test`
4. `pnpm turbo check-types`
5. `pnpm exec biome check .`
