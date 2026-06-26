# Sprint 04 — DashboardOverview Rebuild: Branch C Sections + Wiring

**Batch:** 3
**Depends on:** 02, 03
**Model:** sonnet
**Estimated:** 75–90 min

## Objective

Rebuild `DashboardOverview` so it (a) fetches integrations to compute `hasIntegrations`, (b) routes to the correct empty-state branch via `selectEmptyStateBranch`, (c) removes the "Analyses this month" card, and (d) for Branch C, renders the new Core-powered sections. Each section is a self-contained component with its own loading/error fence.

## Context (PRD §2 Goals 3–6, §6.2, §7)

Seven new sections in Branch C, plus the existing metrics strip (minus monthly analyses) and the "System operational" card:

1. **System operational card** — health from `/api/health` + integration count (already fetched) + a shortcut button to start a new analysis. This is the Branch-C-only variant of the existing SystemStatus.
2. **ActiveIncidentsSection** — `GET /api/incidents?status=active&limit=5`
3. **PendingApprovalsSection** — `GET /api/approvals/pending`
4. **RecentNotificationsSection** — `GET /api/notifications?limit=5`
5. **SystemHealthSection** (graph) — `GET /api/topology/health`
6. **RelayStatusSection** — `GET /api/relay/status`
7. **MemoryInsightsSection** — `GET /api/memory/insights`
8. **UsageHistorySection** — `GET /api/billing/usage`

Each section: own `useEffect` with `AbortController`, own skeleton, own error chip, own `data-testid`. No section failure cascades to siblings.

### Relay route verification

Before wiring Branch A's "Set up Relay" button, verify whether `/dashboard/relay` page exists (`apps/dashboard/src/app/[locale]/dashboard/relay/page.tsx` or equivalent). If missing, swap the href to `/dashboard/integrations?type=relay` in `BranchAEmptyState` and update the `data-testid` test expectation.

## Tasks

1. Modify `DashboardOverview` to fetch integrations list alongside metrics: `const [metrics, integrations] = await Promise.all([...])`. Compute `hasIntegrations = integrations.length > 0` and `hasAnalyses = (metrics?.totalIncidents ?? 0) > 0`.
2. Call `selectEmptyStateBranch({ hasAnalyses, hasIntegrations })` to pick the view.
3. Remove the "Analyses this month" metric card from the metrics strip. Update the metrics-strip component accordingly and remove the `monthlyAnalyses` i18n key usage (leave the key in JSON for now — sprint 5 Playwright test asserts the card is absent).
4. Fix the metric cards that consumed `totalAnalyses` to now read `metrics.totalIncidents` (from the remapped shape). Add `data-testid="metric-total-analyses"`.
5. Render Branch A → `<BranchAEmptyState>`, Branch B → `<BranchBEmptyState>`, Branch C → new layout.
6. Create the seven section components under `contexts/shared/presentation/components/dashboard-sections/`. Each with skeleton, error chip, and `data-testid={section-name}`.
7. Create a Branch-C "System operational" card variant at `contexts/shared/presentation/components/system-operational-card.tsx` that combines health + integration count + "New Analysis" CTA. Use `data-testid="system-operational-card"`.
8. Verify `/dashboard/relay`. If missing, update `branch-a-empty-state.tsx` href to `/dashboard/integrations?type=relay`. Update the matching test.
9. Add new i18n keys under `dashboard.home.sections.*` for each section's title, empty-state copy, and error copy. Both `en.json` and `pt-br.json`.
10. Update `dashboard-page.tsx`'s `messages` prop to include the new section keys.
11. Update `dashboard-overview.test.tsx` with branch-selection test cases and section render tests (stub fetch).

## Acceptance Criteria

- [ ] `DashboardOverview` computes `hasIntegrations` from a real `/api/integrations` call.
- [ ] Branch selection matches `selectEmptyStateBranch` output exactly.
- [ ] "Analyses this month" card does not render anywhere in the component tree.
- [ ] "Total Analyses" card reads from `metrics.totalIncidents` and renders the correct integer.
- [ ] All seven sections render independently with their own skeleton/error state.
- [ ] One section failing (stubbed 500) does not break the others — verified by component test.
- [ ] Relay route verified; Branch A CTAs point to reachable routes.
- [ ] Vitest component tests pass.
- [ ] `pnpm turbo check-types` green.
- [ ] Dev server loads `/dashboard` with no console errors in all three branch states (stubbed via route interception in the next sprint, but manually smoke-tested here).

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/shared/presentation/components/system-operational-card.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/system-operational-card.test.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/active-incidents-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/pending-approvals-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/recent-notifications-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/system-health-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/relay-status-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/memory-insights-section.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/usage-history-section.tsx
  # Colocated tests for each section

files_to_modify:
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.test.tsx
  - apps/dashboard/src/contexts/shared/presentation/pages/dashboard-page.tsx
  - apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json
  - apps/dashboard/src/contexts/shared/infrastructure/i18n/pt-br.json
  - apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx    # only if relay route missing
  - apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.test.tsx  # only if href changed

files_read_only:
  - apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.ts
  - apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx
  - apps/dashboard/src/lib/api/core-api-types.ts

shared_contracts:
  - selectEmptyStateBranch
  - IncidentAnalytics (remapped shape)
```

## Verification Steps

1. `pnpm --filter dashboard test -- dashboard-overview dashboard-sections system-operational-card`
2. `pnpm turbo check-types --filter=dashboard`
3. Start dev server; manually navigate `/dashboard` and confirm which branch renders for the current test user; confirm no console errors.
