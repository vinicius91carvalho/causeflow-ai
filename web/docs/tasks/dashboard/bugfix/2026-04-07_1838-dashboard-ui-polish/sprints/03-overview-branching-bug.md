# Sprint 03 — DashboardOverview Integration Count Extraction Bug

**Depends on:** none
**Blocks:** none
**Est. effort:** 30-45 min
**Parallel:** yes, with Sprints 01 and 02 (no file overlap)

## Goal
Fix the root cause of "`/dashboard` still shows 'Connect integrations' empty state even after the user has integrations connected." The bug is a response-shape mismatch between the `/api/integrations` handler and the `DashboardOverview` consumer.

## Context — The Bug

**Handler** (`apps/dashboard/src/contexts/integrations/api/integrations-handler.ts:13-21`):
```ts
export const GET = withAuth(async (_request: NextRequest) => {
  const status = await getApiClient().getOAuthStatus();
  if (Array.isArray(status)) {
    return NextResponse.json({ integrations: status });
  }
  return NextResponse.json(status); // status is already { integrations: [...] }
});
```
Return shape is always `{ integrations: ApiIntegration[] }` in practice.

**Consumer** (`apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx:112-116`):
```ts
if (integrationsRes.ok) {
  const integrations = (await integrationsRes.json()) as unknown[];
  const list = Array.isArray(integrations) ? integrations : [];
  setIntegrationCount(list.length);
}
```

The consumer calls `Array.isArray()` on the wrapper object `{ integrations: [...] }`, which is always `false`. So `integrationCount` stays `0` forever. This drives `hasIntegrations = false`, the branch selector returns `'A'`, and the user is stuck on the Branch A empty state regardless of how many integrations they actually have.

## File Boundaries
- **Create:**
  - `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.test.tsx` (if no sibling test exists — check with glob first)
- **Modify:**
  - `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx`
  - `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` — add a contract comment only (no logic change)
  - `tests/dashboard/dashboard-overview.spec.ts` — extend with a Branch B scenario using route interception
- **Read-only:**
  - `apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.ts`
  - `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts`

## Tasks

### Fix the extraction
1. In `dashboard-overview.tsx` lines 112-116, replace the array-first logic with this:
   ```ts
   if (integrationsRes.ok) {
     const json = (await integrationsRes.json()) as
       | { integrations?: unknown[] }
       | unknown[];
     const list = Array.isArray(json)
       ? json
       : Array.isArray(json.integrations)
         ? json.integrations
         : [];
     setIntegrationCount(list.length);
   }
   ```
2. Add a short comment above the block: `// /api/integrations returns { integrations: [...] }; tolerate raw arrays for back-compat.`

### Contract comment on the handler
3. In `integrations-handler.ts`, add/update the JSDoc above `GET` to explicitly state:
   ```
   * Response shape contract: { integrations: ApiIntegration[] }.
   * Consumers must extract `.integrations`; raw array shape is deprecated and only returned
   * if the upstream Core API returns an array directly (legacy).
   ```

### Unit test (vitest)
4. Glob for existing `dashboard-overview.test.*`. If absent, create `dashboard-overview.test.tsx`.
5. Use React Testing Library + vitest. Mock `global.fetch` per test.
6. Test cases:
   - **Branch A**: metrics 0 analyses, integrations `{ integrations: [] }` → `BranchAEmptyState` renders
   - **Branch B (the fix)**: metrics 0 analyses, integrations `{ integrations: [{id:'1'},{id:'2'}] }` → `BranchBEmptyState` renders. This test would FAIL on the current code.
   - **Branch B (legacy shape)**: metrics 0 analyses, integrations `[{id:'1'}]` (raw array) → `BranchBEmptyState` renders. Validates back-compat.
   - **Branch C**: metrics `{ totalAnalyses: 5 }`, integrations `{ integrations: [{id:'1'}] }` → SystemOperationalCard visible
7. Follow TDD order: write failing tests, then apply fix, confirm green.

### Playwright E2E
8. Read `tests/dashboard/dashboard-overview.spec.ts` (already in git status as untracked — check current state).
9. Add a test that intercepts `/api/integrations` with `page.route()` returning `{ integrations: [{id:'aws'},{id:'github'}] }` and `/api/metrics` with `{ metrics: { totalAnalyses: 0, activeIntegrations: 2, teamMembers: 1, creditsTotal: 5, creditsUsed: 0, creditsRemaining: 5 } }`, navigates to `/dashboard`, and asserts `[data-testid="branch-b-empty-state"]` is visible.
10. Also assert `[data-testid="branch-a-empty-state"]` is NOT visible (regression guard).

### Dev server smoke
11. `pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null`
12. `pnpm --filter dashboard dev`
13. With real or seeded data, verify `/dashboard` lands on Branch B if you have integrations but no analyses, and on Branch C if you have analyses.
14. Kill processes when done.

## Acceptance Criteria
- [ ] `dashboard-overview.tsx` extracts integration count from both wrapped `{ integrations: [...] }` and raw array shapes
- [ ] Unit tests cover all three branches with both response shapes; all green
- [ ] Playwright test with mocked routes shows Branch B visible, Branch A hidden
- [ ] Manual dev server smoke: user with integrations connected sees Branch B (or C with analyses), NOT Branch A
- [ ] No regression: user with zero integrations still sees Branch A
- [ ] Contract JSDoc added to `integrations-handler.ts`
- [ ] `pnpm turbo test` — green
- [ ] `pnpm exec biome check apps/dashboard/src/contexts/shared/` — green
- [ ] `pnpm turbo check-types` — green

## Out of scope
- Changing the branch logic itself (still 2-input: hasAnalyses, hasIntegrations)
- Adding Relay to the branching decision (user pick pending; default: leave as-is)
- Refactoring `dashboard-overview.tsx` beyond the minimal extraction fix
- Refactoring the handler's return shape

## Return Summary
- Diff summary of dashboard-overview.tsx
- Test file additions with test count
- Before/after behavior verification (branch selected for each scenario)
- Confirmation that the existing Branch A / Branch C tests still pass
- Dev server smoke result
