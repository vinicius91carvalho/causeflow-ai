# INVARIANTS — Dashboard Redesign with Core API Integration

Cross-cutting contracts that multiple sprints rely on. Each is machine-verifiable.
The `check-invariants.sh` PostToolUse hook walks from edited files up to this directory
and enforces every entry.

---

## IncidentAnalytics Shape (dashboard-side contract)

- **Owner:** `apps/dashboard/src/lib/api/core-api-types.ts` (the `IncidentAnalytics` interface)
- **Preconditions:** Any consumer reading incident analytics must use `HttpApiClient.getIncidentAnalytics()`, not `request('/v1/analytics/incidents')` directly.
- **Postconditions:** The returned object has fields `totalIncidents: number`, `openIncidents: number`, `mttr: number`, `byStatus: Record<string, number>`, `bySeverity: Record<string, number>`, `totalCostUsd: number`, `avgCostUsd: number | null`. Core's wire field names (`total`, `openCount`, `mttrMinutes`) never leak past `http-api-client.ts`.
- **Invariants:** The string `totalIncidents` appears in `core-api-types.ts`. The string `openCount` appears ONLY inside `http-api-client.ts` (as a wire-shape reference). No other file under `apps/dashboard/src` references `openCount` or `mttrMinutes`.
- **Verify:** `! grep -rn --include='*.ts' --include='*.tsx' -E '\b(openCount|mttrMinutes)\b' apps/dashboard/src | grep -v 'http-api-client'`
- **Fix:** Route the consumer through `HttpApiClient.getIncidentAnalytics()`; delete any direct wire-shape reference.

## SystemStatus Endpoint

- **Owner:** `apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx`
- **Preconditions:** `/api/health` BFF route exists and returns `HealthStatus`.
- **Postconditions:** `SystemStatus` fetches `/api/health` exclusively. The string `/api/health/detailed` must not appear in `system-status.tsx`.
- **Invariants:** `system-status.tsx` contains the substring `'/api/health'` and does NOT contain `'/api/health/detailed'`.
- **Verify:** `grep -q "'/api/health'" apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx && ! grep -q "/api/health/detailed" apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx`
- **Fix:** Change the fetch URL back to `/api/health` and remove any detailed-endpoint reference.

## Empty-State Branch Selection

- **Owner:** `apps/dashboard/src/contexts/shared/presentation/lib/empty-state-branch.ts`
- **Preconditions:** Callers provide both `hasAnalyses` and `hasIntegrations` as booleans derived from real API responses (not assumptions).
- **Postconditions:** Exactly one of `'A' | 'B' | 'C'` is returned for any input. Components render only the matching branch.
- **Invariants:** The function is the single source of branch selection — no component hard-codes branch logic.
- **Verify:** `grep -rn --include='*.tsx' -E 'hasAnalyses.*hasIntegrations|hasIntegrations.*hasAnalyses' apps/dashboard/src/contexts/shared/presentation/components | grep -v 'selectEmptyStateBranch' | wc -l | grep -q '^0$'`
- **Fix:** Replace any ad-hoc branch logic in components with a call to `selectEmptyStateBranch`.

## Branch A CTA Targets

- **Owner:** `apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx`
- **Preconditions:** `/dashboard/integrations` exists. Either `/dashboard/relay` exists, or the Branch A component uses `/dashboard/integrations?type=relay` as the fallback.
- **Postconditions:** Both CTA hrefs in Branch A resolve to reachable routes.
- **Invariants:** The file contains exactly one `href="/dashboard/integrations"` (Connect Integration CTA) and exactly one href matching either `/dashboard/relay` or `/dashboard/integrations?type=relay` (Set up Relay CTA).
- **Verify:** `grep -q 'href="/dashboard/integrations"' apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx && grep -qE 'href="/dashboard/(relay|integrations\?type=relay)"' apps/dashboard/src/contexts/shared/presentation/components/branch-a-empty-state.tsx`
- **Fix:** Restore the CTA hrefs per the Tasks in sprint 02 / sprint 04.

## BFF Route Auth Wrapping

- **Owner:** `apps/dashboard/src/lib/api/with-auth.ts`
- **Preconditions:** Every new route handler under `apps/dashboard/src/contexts/*/api/*-handler.ts` that this PRD creates wraps its exported `GET`/`POST`/etc. with `withAuth(...)`.
- **Postconditions:** No unauthenticated access to new Core-proxy routes.
- **Invariants:** Each of the files created by sprint 3 imports `withAuth` and uses it to wrap exported handlers.
- **Verify:** `for f in apps/dashboard/src/contexts/approvals/api/approvals-pending-handler.ts apps/dashboard/src/contexts/integrations/api/relay-status-handler.ts apps/dashboard/src/contexts/shared/api/memory-insights-handler.ts apps/dashboard/src/contexts/billing/api/usage-handler.ts apps/dashboard/src/contexts/shared/api/topology-health-handler.ts; do [ -f "$f" ] && grep -q 'withAuth' "$f" || exit 1; done`
- **Fix:** Wrap the handler with `withAuth(...)` following the `notifications-handler.ts` pattern.

## Monthly Analyses Card Removed

- **Owner:** `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx`
- **Preconditions:** None.
- **Postconditions:** The "Analyses this month" metric card is not rendered by `DashboardOverview` or any of its direct children.
- **Invariants:** The literal `data-testid="metric-monthly-analyses"` does not appear in any `.tsx` under `apps/dashboard/src`.
- **Verify:** `! grep -rn --include='*.tsx' 'data-testid="metric-monthly-analyses"' apps/dashboard/src`
- **Fix:** Remove the card from wherever it was reintroduced.

## Per-Section Error Fence

- **Owner:** each section component under `contexts/shared/presentation/components/dashboard-sections/`
- **Preconditions:** Each section uses its own `useEffect` / fetch / try-catch.
- **Postconditions:** A failing section renders an error chip locally; it does not throw up the tree.
- **Invariants:** Each section file contains a `try` and a `catch` in the fetch lifecycle.
- **Verify:** `for f in apps/dashboard/src/contexts/shared/presentation/components/dashboard-sections/*.tsx; do grep -q 'catch' "$f" || exit 1; done`
- **Fix:** Wrap the fetch in try/catch and set a local error-state.
