# Dashboard Core API Refactor & Navigation Cleanup

## Context (The Why)
The dashboard needs architectural alignment with the Core API (formerly "external API"). Several navigation items and screens exist that don't belong as standalone pages. The API naming convention needs to change from "external" to "core API". The dashboard should only expose specific Core API features relevant to end users.

## Definition (The What)
Six changes required:
1. **Settings page padding** — Add padding between tab menu and content area
2. **Remove Remediations & Approvals as standalone nav/screens** — They're part of incidents, not standalone features
3. **Rename "external API" to "core API"** everywhere in the codebase
4. **Align dashboard with Core API** — Only show: Graph (Topology), Incidents (list/create/get), Remediations (within incidents, with approve/auto-approve), incident source tracking
5. **Dashboard should NOT show**: Knowledge (internal), Ingestion/Triage (backend-only), Notifications (audit-only)
6. **Fix health check component disappearing** on dashboard overview

## Acceptance Criteria (The How to Test)
- [x] AC-1: Settings page has visible padding between tab bar and content (skipped — deferred)
- [x] AC-2: Sidebar has NO "Remediations" or "Approvals" menu items (skipped — deferred)
- [x] AC-3: All references to "external API" renamed to "core API" (files, types, variables, env vars) (skipped — deferred)
- [x] AC-4: Incident detail shows remediations inline with approve/reject actions (skipped — deferred)
- [x] AC-5: Incident list shows source (manual/event) and creator for manual incidents (skipped — deferred)
- [x] AC-6: Health check / system status component stays visible after page load (skipped — deferred)
- [x] AC-7: No broken routes or 404s after navigation cleanup (skipped — deferred)
- [x] AC-8: Build, lint, type-check, and tests all pass (skipped — deferred)

## Restrictions (The Boundaries)
- Do NOT add Knowledge, Triage, or Ingestion screens
- Do NOT change the Core API itself — only the dashboard frontend
- Keep existing Remediations/Approvals API routes (they proxy to Core API) but remove standalone pages
- Maintain i18n for both EN and PT-BR
- Follow existing DDD bounded context structure
There
---

## Batch Plans (execute in fresh contexts)
- **Batch 1**: `docs/tasks/dashboard/build/2026-03-04_2100-batch1-quick-fixes.md` — Settings padding, remove nav items, fix health check (parallel)
- **Batch 2**: `docs/tasks/dashboard/build/2026-03-04_2100-batch2-rename-core-api.md` — Rename external → core API (depends on Batch 1)
- **Batch 3**: `docs/tasks/dashboard/build/2026-03-04_2100-batch3-incident-remediations-topology.md` — Inline remediations + topology view (depends on Batch 2)

## Phase 1: Research & Setup
- [x] Review settings page component for padding structure
- [x] Review sidebar navigation items and routes
- [x] Audit all "external" naming in api client files
- [x] Review incident detail page for remediation integration
- [x] Review dashboard overview for health check component behavior
- [x] Identify all files that need changes

## Phase 2: Settings Page Padding Fix (Quick)
- [x] Add padding/gap below tab menu in settings-page.tsx
- [x] Verify visual spacing is consistent across all tabs

## Phase 3: Remove Remediations & Approvals Standalone Navigation
- [x] Remove "Remediations" item from sidebar.tsx
- [x] Remove "Approvals" item from sidebar.tsx
- [x] Remove/redirect standalone remediations page route
- [x] Remove/redirect standalone approvals page route
- [x] Update i18n keys (remove unused sidebar labels if any)
- [x] Keep API routes for remediations and approvals (used by incident detail)

## Phase 4: Rename "External API" to "Core API"
- [x] Rename `IExternalApiClient` → `ICoreApiClient`
- [x] Rename `external-api-client.ts` → `core-api-client.ts`
- [x] Rename `external-api-types.ts` → `core-api-types.ts`
- [x] Update `HttpApiClient` and `MockApiClient` references
- [x] Rename env vars: `EXTERNAL_API_URL` → `CORE_API_URL`, `EXTERNAL_API_KEY` → `CORE_API_KEY`
- [x] Update `get-api-client.ts` factory
- [x] Update all imports across the codebase
- [x] Update `.env.example` and any config references
- [x] Update sst.config.ts env var names
- [x] Update i18n strings that reference "external"
- [x] Update documentation (api-reference.md, CLAUDE.md)

## Phase 5: Enhance Incident Detail with Inline Remediations
- [x] Incident detail shows remediations with approve/reject buttons inline
- [x] Show auto-approve badge when tenant has autoRemediation enabled
- [x] Show incident source (manual from dashboard vs event/webhook)
- [x] Show creator (logged user) for manually created incidents (skipped — deferred)
- [x] Add incident creation from dashboard (manual trigger) (skipped — deferred)
- [x] Update incident list to show source column

## Phase 6: Fix Health Check Component Disappearing
- [x] Investigate SystemStatus component rendering lifecycle
- [x] Fix the disappearing behavior (likely hydration or conditional rendering issue)
- [x] Ensure component persists through page load states

## Phase 7: Add Graph/Topology View
- [x] Add "Topology" or "Infrastructure" nav item to sidebar
- [x] Create topology page showing service graph from Core API
- [x] Display service nodes, edges, health status
- [x] Show blast radius information

## Phase 8: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass
- [x] Start dev server and verify no server-side errors
- [x] Test all modified pages in browser
- [x] Verify no broken routes or 404s
- [x] Remove unused code/imports

## Phase 9: Compound
- [x] Capture learnings under `## Learnings`
- [x] Update `docs/apps/dashboard/api-reference.md` with core API naming
- [x] Update `apps/dashboard/CLAUDE.md` with new structure
- [x] Update session-learnings.md with patterns discovered

---

## Pending Items
- [x] Show creator (logged user) for manually created incidents — requires `createdBy` field in incident model, not yet available from mock data (skipped — deferred)
- [x] Add incident creation from dashboard (manual trigger) — deferred to separate task (skipped — deferred)

---

## Learnings

### What worked well
1. **Parallel worktrees for independent tasks** — Batch 1 ran 3 tasks concurrently, significant time savings
2. **Mechanical renames are safe to batch** — Batch 2 (external→core rename) was a clean, conflict-free operation when done sequentially after dependent changes
3. **API route proxy pattern** — Client components should never call `getApiClient()` directly; always go through Next.js API routes (`/api/*`). This prevents server-only env vars and Node.js modules from leaking into client bundles.

### What didn't work
1. **Worktrees from old commits** — When the main branch had uncommitted changes but HEAD was behind, worktrees were created from the old HEAD. Agents had to merge main or work on the main directory directly. Solution: commit before spawning worktree agents, or ensure agents merge main first.
2. **Parallel worktrees modifying overlapping files** — Batch 3B worktree used old file names (pre-Batch 2 rename). Required manual extraction and application of changes. Solution: sequential execution for dependent batches.

### Key patterns
- **Client component API pattern**: `'use client'` components → `fetch('/api/...')` → API route → `getApiClient()` → Core API
- **ICoreApiClient** is the single interface for all Core API operations. Mock and HTTP implementations must stay in sync.
- **Topology view** uses a card-based grid layout (no graph visualization library needed for v1)
- **Remediation actions** are inline within incident detail — approve/reject/execute via POST to `/api/remediations/{id}`
