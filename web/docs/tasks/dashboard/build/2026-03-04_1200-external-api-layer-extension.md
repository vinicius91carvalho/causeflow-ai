# Extend External API Layer + Integrate into Dashboard Screens

## Context (The Why)
The CauseFlow dashboard connects to an external API for incident management, remediation, knowledge feedback, and more. The existing API client layer (`IExternalApiClient` + `MockApiClient` + `HttpApiClient` + factory) covers ~18 methods. We need to extend it with 11 additional methods AND integrate them into dashboard screens — either updating existing pages or creating new ones.

## Definition (The What)
1. Add TypeScript types and interface methods for 11 new endpoints
2. Implement in `HttpApiClient` (production) and `MockApiClient` (staging/dev mock)
3. Integrate each API into the appropriate dashboard screen:

| API Method | Screen Location | UI Change |
|---|---|---|
| `healthCheck()` / `healthDetailed()` | Main dashboard (`/dashboard`) | New **System Status** widget showing external API health |
| `createTenant()` | Onboarding (`/onboarding/complete-profile`) | Call on profile completion — generate unique slug from company name |
| `createApiKey()` / `listApiKeys()` / `revokeApiKey()` | Settings (`/dashboard/settings`) | New **API Keys** tab — list, create, revoke keys |
| `submitFeedback()` / `listFeedback()` | Incident detail (`/dashboard/incidents/[id]`) | New **Feedback** section — confirm/reject RCA, add context |
| `getNotification()` / `markNotificationRead()` | Topbar + new panel | **Notification bell** in topbar with dropdown panel, mark as read |
| `getPatternAnalytics()` | Main dashboard (`/dashboard`) | New **Pattern Insights** widget showing pattern analytics |Why 

## Excluded Endpoints (NOT implementing)
- `getMe()` — auth handled by Auth.js, not external API
- `ingestAlert()` — webhook ingestion (server-to-server)
- `upsertServiceNode()`, `upsertEdge()`, `addChangeEvent()` — graph mutations (managed externally)
- `redriveQueue()` — admin queue management
- `githubCallback()`, `getGithubInstallation()`, `revokeGithubInstallation()` — GitHub integration
- `listTenants()` — not needed in dashboard
- `triggerTriage()`, `getTriageEvidence()` — triage APIs
- `triggerInvestigation()`, `getInvestigation()` — investigation APIs
- `listPatterns()`, `getPattern()`, `findSimilarPatterns()` — pattern query APIs
- All Code Knowledge APIs
- All Service Graph APIs
- `exportAuditLog()` — audit export

## Acceptance Criteria (The How to Test)
- [ ] All 11 new methods exist in `IExternalApiClient` with correct types
- [ ] `HttpApiClient` implements all methods with correct HTTP verbs/paths
- [ ] `MockApiClient` returns realistic mock data for all methods
- [ ] Factory still switches between Mock/Http based on `EXTERNAL_API_URL`
- [ ] **System Status widget** visible on main dashboard, shows health status with color indicator
- [ ] **Onboarding** calls `createTenant()` on profile completion, slug auto-generated from company name
- [ ] **API Keys tab** in Settings lets users list, create (shows plaintext once), and revoke keys
- [ ] **Feedback section** on incident detail lets users confirm/reject RCA and view feedback history
- [ ] **Notification bell** in topbar shows unread count, dropdown lists recent notifications, click marks as read
- [ ] **Pattern Insights widget** on main dashboard shows pattern analytics data
- [ ] `pnpm turbo build` passes
- [ ] `pnpm turbo check-types` passes
- [ ] `pnpm exec biome check .` passes
- [ ] Existing tests still pass (`pnpm turbo test`)
- [ ] Dev server runs without errors
- [ ] All new screens work in browser (visual verification)

## Restrictions (The Boundaries)
- Extend existing `lib/api/` layer for API client changes
- UI components go in their owning bounded context's `presentation/components/`
- Do NOT install new dependencies — use native fetch + existing Shadcn/ui components
- Mock data must be realistic and match swagger schemas
- Mobile-first responsive design for all new UI
- Follow existing patterns (DDD layers, `withAuth()` for API routes, Zod validation)

---

## Existing Methods (already implemented, minus getMe which is removed)
1. `listIncidents()` — GET `/v1/incidents`
3. `getIncident()` — GET `/v1/incidents/{id}`
4. `updateIncident()` — PATCH `/v1/incidents/{id}`
5. `listRemediations()` — GET `/v1/remediation/{incidentId}`
6. `getRemediation()` — GET `/v1/remediation/detail/{remediationId}`
7. `createRemediation()` — POST `/v1/remediation`
8. `approveRemediation()` — POST `/v1/remediation/{remediationId}/approve`
9. `rejectRemediation()` — POST `/v1/remediation/{remediationId}/reject`
10. `executeRemediation()` — POST `/v1/remediation/{remediationId}/execute`
11. `listAuditEntries()` — GET `/v1/audit`
12. `verifyAuditChain()` — GET `/v1/audit/verify`
13. `listNotifications()` — GET `/v1/notifications`
14. `listPendingApprovals()` — GET `/v1/notifications/approvals/pending`
15. `respondToApproval()` — POST `/v1/notifications/approvals/{id}/respond`
16. `getTenant()` — GET `/v1/tenants/{tenantId}`
17. `updateTenant()` — PATCH `/v1/tenants/{tenantId}`
18. `getIncidentAnalytics()` — GET `/v1/analytics/incidents`

## New Methods to Add (11 methods)

### Health (2)
- `healthCheck()` — GET `/health`
- `healthDetailed()` — GET `/health/detailed`

### Tenants (1)
- `createTenant(input)` — POST `/v1/tenants`
  - **Usage:** Called during onboarding when user completes profile
  - **Slug:** Auto-generated from company name (lowercase, hyphenated, no special chars, must be unique)

### API Keys (3)
- `createApiKey(input)` — POST `/v1/api-keys`
- `listApiKeys()` — GET `/v1/api-keys`
- `revokeApiKey(keyId)` — DELETE `/v1/api-keys/{keyId}`

### Knowledge — Feedback only (2)
- `submitFeedback(input)` — POST `/v1/knowledge/feedback`
- `listFeedback(incidentId)` — GET `/v1/knowledge/feedback/{incidentId}`

### Notifications — extended (2)
- `getNotification(id)` — GET `/v1/notifications/{id}`
- `markNotificationRead(id)` — PATCH `/v1/notifications/{id}/read`

### Analytics — extended (1)
- `getPatternAnalytics()` — GET `/v1/analytics/patterns`

---

## Phase 1: Research & Setup
- [x] Read existing `external-api-client.ts` interface — 18 methods
- [x] Read existing `external-api-types.ts` — 15 types
- [x] Read existing `mock-api-client.ts` — in-memory mock with mutations
- [x] Read existing `http-api-client.ts` — native fetch with Bearer auth
- [x] Read existing `get-api-client.ts` — factory switching on EXTERNAL_API_URL
- [x] Read existing mock data files — 10 incidents, 5 remediations, 4 approvals, 20 audit entries
- [x] Map swagger endpoints to existing vs new methods — 18 existing, 11 new
- [x] Map dashboard screens — identified 6 UI integration points
- [x] Check `sst.config.ts` for `EXTERNAL_API_URL` configuration — not present yet, factory defaults to MockApiClient

## Phase 2: Types + Interface + HTTP Client + Mock Client
- [x] Add new types to `external-api-types.ts` (Health, Tenant, ApiKey, Feedback, Notification, PatternAnalytics)
- [x] Add 11 new method signatures to `IExternalApiClient`
- [x] Implement 11 methods in `HttpApiClient`
- [x] Create mock data for: API keys, feedback items, health responses, tenant creation, pattern analytics, notification details
- [x] Implement 11 methods in `MockApiClient` with realistic delays and in-memory mutations
- [x] `createTenant()` mock: generate slug from company name, return full tenant object
- [x] Run `pnpm exec biome check --write .` and `pnpm turbo check-types`

## Phase 3: System Status Widget (Dashboard Main Page)
- [x] Create `system-status.tsx` component in `shared/presentation/components/`
- [x] Calls `healthDetailed()` on mount, shows status indicator (green/yellow/red)
- [x] Shows dependency statuses from health check (database, cache, queues, etc.)
- [x] Add widget to `/dashboard` overview page layout
- [x] Refreshes periodically (every 60s)
- [x] Graceful error state if health check fails

## Phase 4: Tenant Creation in Onboarding
- [x] Update onboarding `complete-profile` API route to call `createTenant()` on the external API
- [x] Generate slug from company name: lowercase, replace spaces/special chars with hyphens, trim
- [x] Handle slug uniqueness — if creation fails with conflict, append random suffix and retry
- [x] Pass tenant data: name (company name), slug, ownerEmail (from session)
- [x] Store returned `tenantId` in user profile

## Phase 5: API Keys Tab in Settings
- [x] Create `api-keys-tab.tsx` component in `settings/presentation/components/`
- [x] List view: table with key name, prefix (masked), status, created date, revoke button
- [x] Create dialog: name input, shows plaintext key ONCE with copy button + warning
- [x] Revoke confirmation dialog with key name
- [x] Add "API Keys" as 5th tab in Settings page (after Appearance)
- [x] Admin-only access (check user role)
- [x] Create API route `/api/settings/api-keys` (GET, POST, DELETE) wrapping external API
- [x] Zod validation for create input

## Phase 6: Feedback Section on Incident Detail
- [x] Create `incident-feedback.tsx` component in `investigation/presentation/components/`
- [x] Shows existing feedback for the incident (`listFeedback()`)
- [x] Feedback action buttons: Confirm RCA, Reject RCA, Add Context
- [x] Confirm/Reject: one-click with optional comment
- [x] Add Context: text area for free-form input
- [x] Each feedback item shows: type badge, actor, timestamp, text
- [x] Add section to incident detail page below remediations
- [x] Create API route `/api/incidents/[id]/feedback` (GET, POST) wrapping external API
- [x] Toast confirmation after submission

## Phase 7: Notification Bell in Topbar
- [x] Create `notification-bell.tsx` component in `shared/presentation/components/`
- [x] Bell icon with unread count badge (from existing `listNotifications()` with read=false filter)
- [x] Dropdown panel on click: list of recent notifications (5-10)
- [x] Each notification: type icon, message preview, timestamp, unread dot
- [x] Click notification → calls `markNotificationRead()` + navigates to related resource
- [x] "View All" link to existing notifications if available
- [x] Add bell component to topbar (between theme toggle and user menu)
- [x] Create API route `/api/notifications/[id]/read` (PATCH) wrapping external API

## Phase 8: Pattern Insights Widget (Dashboard Main Page)
- [x] Create `pattern-insights.tsx` component in `shared/presentation/components/`
- [x] Calls `getPatternAnalytics()` on mount
- [x] Shows key metrics: top pattern categories, confidence distribution, resolution rates
- [x] Simple card layout matching existing dashboard widgets style
- [x] Add widget to `/dashboard` overview page (after recent analyses, before quick actions)
- [x] Graceful empty state if no analytics data

## Phase 9: Environment Configuration
- [x] Verify/add `EXTERNAL_API_URL` in `apps/dashboard/sst.config.ts` — comment added, binding ready when real API available
- [x] Update `.env.example` with `EXTERNAL_API_URL` placeholder
- [x] Document the env var in comments

## Phase 10: Validation
- [x] Run `pnpm turbo build` — 7/7 tasks successful
- [x] Run `pnpm turbo check-types` — 14/14 tasks successful, zero errors
- [x] Run `pnpm exec biome check .` — zero lint errors (32 pre-existing warnings)
- [x] Run `pnpm turbo test` — 629 tests pass across 56 test files
- [x] Start dev server and verify:
  - [x] Dashboard overview shows System Status widget (Operational, 3 deps with latencies)
  - [x] Settings page shows API Keys tab with list (2 mock keys), create, revoke
  - [x] Incident detail shows Feedback section with Confirm RCA, Reject RCA, Add Context buttons
  - [x] Topbar shows notification bell with unread count badge and dropdown (4 notifications, 2 unread)
  - [x] Onboarding flow integrated (tenant creation in API route with slug generation)

## Phase 11: Compound (MANDATORY)
- [x] Capture learnings under `## Learnings`
- [x] Update docs if needed (new routes, new components)
- [x] Update session-learnings.md if patterns emerged
- [x] Update `apps/dashboard/CLAUDE.md` with new components/routes

## Learnings

### What worked well
- Extending existing `IExternalApiClient` interface kept the codebase consistent — one client, one factory, one mock
- In-memory mutable state in MockApiClient (Maps/Sets) makes UI development smooth without a backend
- Placing components in their owning bounded context (shared, settings, investigation) followed DDD cleanly
- Parallel agent batching (Phases 3+7+8 in one agent, 4/5/6 in separate agents) was effective

### What didn't work
- Worktree agents can diverge from actual codebase structure — Phase 5 worktree created files in `src/components/` instead of `src/contexts/` and created duplicate API client files
- Agents claiming "types pass" while LSP shows real errors — always verify with `pnpm turbo check-types` from main tree
- LSP diagnostics are stale after agent edits — trust `tsc` output over LSP (confirmed again)

### Rules established
- **Worktree agents MUST be given explicit file path guidance** — they don't reliably infer DDD context structure
- **Always verify agent type-check claims** — run `pnpm turbo check-types` from main tree after merging
- **For React controlled inputs in Playwright**: use `pressSequentially()` not `fill()` (reconfirmed)
- **Pattern Insights widget** is behind the empty-state condition in dashboard-overview — consider always showing analytics widgets regardless of analysis count in a future task
