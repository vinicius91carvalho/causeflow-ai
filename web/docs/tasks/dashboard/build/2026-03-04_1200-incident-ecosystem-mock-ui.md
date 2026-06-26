# Incident Ecosystem: Mock UI for Incidents, Audit, Remediation & Approvals

## Context (The Why)
The Dashboard currently uses "Analysis" as its core entity, backed by DynamoDB persistence. The product is pivoting to an external API model where Incidents, Approvals, Remediations, and Audit entries are managed by a separate API service. The Dashboard needs to become purely a visual layer with mocked data. This refactor also introduces new entity structures (Incident with richer fields, Remediation with steps/PRs, Approval with expiry, Audit with hash chain) and new screens.

## Definition (The What)
1. **Refactor Analysis → Incident**: Update types, mock data, screens, and simulation to match the new Incident entity structure (severity includes 'info', status includes 'triaging'/'investigating'/'awaiting_approval'/'remediating', new fields: sourceProvider, sourceAlertId, assignedAgents, rootCause, resolution, resolvedAt)
2. **Remove DynamoDB persistence**: Replace repository layer with pure in-memory mocks
3. **Create Audit screen**: Display audit entries with action filter and cursor pagination (mocked)
4. **Create Remediation view**: Show remediation details linked to an incident (steps, PRs, status flow)
5. **Create Approval view**: Show pending/resolved approvals with action buttons (mocked)
6. **Settings update**: Add company slug field and autoRemediation toggle
7. **Navigation update**: Add new sidebar items for the new screens

## Acceptance Criteria (The How to Test)
- [x] No ElectroDB or DynamoDB imports remain in dashboard code
- [x] Incident list shows new fields (sourceProvider, assignedAgents, rootCause)
- [x] Incident detail page shows full incident with remediation and approval sections
- [x] Audit screen lists entries with action filter, pagination controls
- [x] Remediation screen shows steps with status, pull requests, proposer/approver info
- [x] Approval screen shows pending approvals with approve/reject buttons (mocked actions)
- [x] Settings page has company slug field and autoRemediation toggle
- [x] Sidebar navigation includes Incidents, Audit, Remediations, Approvals
- [x] All data is mocked — no real API calls for these entities
- [x] Build passes (`pnpm turbo build`)
- [x] Type checks pass (`pnpm turbo check-types`)
- [x] Lint passes (`pnpm exec biome check .`)

## Restrictions (The Boundaries)
- NO real API persistence — everything mocked with in-memory data
- NO ElectroDB/DynamoDB for incidents (remove existing)
- Keep existing Analysis API routes working but backed by mock data
- Don't break existing auth, billing, settings, or integration flows
- Follow existing dashboard design patterns (Shadcn/ui, Tailwind)
- Mobile-first responsive approach

---

## PLAN 1: Foundation & Incident Refactor (This Context)

### Phase 1: Research & Setup
- [x] Search `docs/solutions/` for related patterns
- [x] Read `session-learnings.md` for recent context
- [x] Identify all files using ElectroDB/DynamoDB for analyses/incidents
- [x] Map current Analysis type fields to new Incident entity fields

### Phase 2: Type Definitions & Mock Data
- [x] Create new Incident TypeScript types matching entity structure
- [x] Create Remediation TypeScript types
- [x] Create Approval TypeScript types
- [x] Create AuditEntry TypeScript types
- [x] Create mock data generators for all 4 entities
- [x] Create mock data store (in-memory, replaces DynamoDB)

### Phase 3: Incident Screen Refactor
- [x] Update incident list page with new fields (sourceProvider, severity badges including 'info', new statuses)
- [x] Update incident detail page with full new structure (rootCause, resolution, assignedAgents, resolvedAt)
- [x] Update incident creation animation/simulation to use new fields
- [x] Update status badges for new statuses (triaging, investigating, awaiting_approval, remediating)
- [x] Remove DynamoDB/ElectroDB imports from analysis repository
- [x] Update API routes to use mock data store

### Phase 4: Validation (Plan 1)
- [x] Build passes (`pnpm turbo build`)
- [x] Type checks pass (`pnpm turbo check-types`)
- [x] Lint passes (`pnpm exec biome check .`)
- [x] Existing tests still pass (617 tests, 56 files — all pass)
- [x] Remove unused code/imports

### Phase 6: Compound (Plan 1)
- [x] Document learnings from refactor

---

## PLAN 2: New Screens & Settings (Next Context)

### Phase 1: Audit Screen
- [x] Create audit list page at `/dashboard/audit`
- [x] Create audit entry components (list item, filters, pagination)
- [x] Wire up mock data

### Phase 2: Remediation Screen
- [x] Create remediation list/detail at `/dashboard/remediations`
- [x] Create remediation step components (step list, status indicators, PR links)
- [x] Link remediation from incident detail page

### Phase 3: Approval Screen
- [x] Create approval list at `/dashboard/approvals`
- [x] Create approval card with action buttons (approve/reject — mocked)
- [x] Show approval status and expiry

### Phase 4: Settings & Navigation
- [x] Add company slug field to company settings tab
- [x] Add autoRemediation toggle to settings
- [x] Update sidebar navigation with new items (Incidents, Audit, Remediations, Approvals)
- [x] Update command palette with new routes

### Phase 5: Validation (Plan 2)
- [x] Build, type check, lint all pass
- [x] Fix mock data tenant ID mismatch (see BLOCKER below)
- [x] Dev server runs without errors
- [x] All new screens render correctly
- [x] Navigation works for all new routes

### Phase 6: Compound (Plan 2)
- [x] Full learnings capture
- [x] Update documentation

## Learnings

### What worked
- Parallel worktree agents for independent screen implementations
- Mock data store pattern with lazy seeding per tenant
- Keeping legacy `Analysis` types with `@deprecated` during migration

### What didn't work
- Hardcoded `tenant-mock-001` in mock data didn't match dynamic dev auth tenant IDs → empty lists
- Dev credentials provider was unreachable because `credentialsSignIn` callback check took priority in both provider selection AND JWT callback

### Key decisions
1. **Dev credentials priority**: Reversed the check order in `auth-config.ts` so `ENABLE_DEV_CREDENTIALS=true` takes precedence over `credentialsSignIn` callback — both in provider registration AND JWT token population
2. **Mock data tenant mapping**: `getMock*()` functions use `.map(x => ({...x, tenantId}))` instead of `.filter()` so any tenant gets full mock data
3. **Lazy seeding**: Repositories seed on first access per tenantId rather than at init time

### Prevention rules added
- When adding dev-only auth bypasses, ensure BOTH the provider selection AND the JWT/session callback respect the same priority
- Mock data must never hardcode tenant IDs — always accept tenantId as parameter

---

## BLOCKER: Mock Data Tenant ID Mismatch

**Status:** FIXED — dev credentials priority reordered + JWT callback updated.

**Problem:** Mock data in `mock-data.ts` generates data keyed to `tenant-mock-001`, but the dev auth system (`dev-seed.ts`) creates tenants dynamically based on the user's email. When API routes call repositories with the real session tenantId, the mock data doesn't match → lists return empty.

**Affected screens:** Incidents list (empty), Remediations list (empty). Audit and Approvals may also be affected.

**Fix needed in these files:**

1. **`apps/dashboard/src/lib/mock-data.ts`** — Ensure `getMockIncidents(tenantId)`, `getMockRemediations(tenantId)`, `getMockApprovals(tenantId)`, `getMockAuditEntries(tenantId)` all map the passed tenantId onto returned objects (not hardcoded `tenant-mock-001`).

2. **`apps/dashboard/src/lib/db/repositories/incident-repository.ts`** — Change from seeding at init with fixed tenant to lazy seeding: on first `listIncidents(tenantId)` call, if no data exists for that tenantId, call `getMockIncidents(tenantId)` and store.

3. **`apps/dashboard/src/lib/db/repositories/remediation-repository.ts`** — Same lazy seeding pattern.

4. **`apps/dashboard/src/app/api/approvals/route.ts`** — Pass session tenantId to `getMockApprovals(tenantId)`.

5. **`apps/dashboard/src/app/api/audit/route.ts`** — Pass session tenantId to mock data functions.

**After fixing:** Re-test all screens in dev server, take screenshots, verify data loads.
