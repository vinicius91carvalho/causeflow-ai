# Sprint 04 — API Surface + Dashboard Inconclusive UX

**Repo:** core + web (cross-repo)
**Estimated work:** 75–90 min total (45 min core, 30–45 min web)
**Depends on:** Sprint 02
**Blocks:** none (parallel with Sprint 03)
**Branch:** `sprint/04-api-and-dashboard-inconclusive-ux-core` and `sprint/04-api-and-dashboard-inconclusive-ux-web`

## Goal

Surface the new `inconclusive` outcome to dashboard users with a distinct, actionable UX. The API exposes the new status; the dashboard renders an amber/yellow "Inconclusive — Insufficient Evidence" badge with explanation text and suggested next steps, visually distinct from `failed` (red) and `completed` (green).

## Background

Sprint 02 introduces `IncidentStatus = '... | inconclusive'` in the core repo. The dashboard currently does not handle this status — the incident detail page would render an unknown-status fallback, defeating the purpose of the new state.

This sprint splits into two PRs (one per repo) per the project's monorepo policy. Deploy core first; then web.

---

## Part A — Core (API Surface)

### A.1 Tasks

#### 1. Confirm incident GET response shape

**File:** locate via `grep -rn "GET\b.*incidents\b\|/incidents/:" src/modules/ingestion/infra/ src/modules/investigation/infra/`. Likely `src/modules/ingestion/infra/incident.routes.ts` or similar.

Confirm the response DTO for `GET /v1/incidents/:incidentId` already serializes `status` and `resolution` fields from the entity. If yes, no API change is needed — the new `'inconclusive'` enum value flows through automatically.

If the route uses a Zod response schema with the status enum hardcoded, extend it to include `'inconclusive'` (mirror the change to `IncidentStatus`).

#### 2. Contract test

**File:** `src/modules/ingestion/infra/incident.routes.test.ts` (existing colocated route test file)

Add a test:
```ts
it('returns status=inconclusive in GET response when incident is inconclusive', async () => {
    // seed an incident with status='inconclusive', resolution='inconclusive: agent_failed_to_cite_evidence_after_reinvocation'
    // GET /v1/incidents/:id
    // expect res.body.status === 'inconclusive' && res.body.resolution.startsWith('inconclusive:')
});
```

#### 3. (Optional) Add a queryable filter

If the existing list-incidents endpoint supports `?status=...` filters, add `inconclusive` as a permitted value. Skip if not already supported — this is not a blocker.

### A.2 Core Files

**files_to_create:** none (test added to existing file)

**files_to_modify:**
- `src/modules/ingestion/infra/incident.routes.ts` (only if the response schema explicitly enumerates status values)
- `src/modules/ingestion/infra/incident.routes.test.ts` (existing colocated test file)

**files_read_only:**
- `src/modules/ingestion/domain/incident.entity.ts`
- `src/shared/domain/types.ts`

### A.3 Core Acceptance

- `pnpm test:integration` green; new test passes.
- Manual: `curl https://api-staging.causeflow.ai/v1/incidents/<inconclusive-incident-id>` (with proper auth) returns `status: "inconclusive"` and a `resolution` starting with `"inconclusive:"`.

---

## Part B — Web (Dashboard Inconclusive UX)

Switch directory: `cd /root/projects/causeflow/web`.

### B.1 Tasks

#### 1. Locate the incident detail page

```bash
find apps/dashboard/src -path '*incidents*' -name 'page.tsx' -o -path '*incidents*\[id\]*'
# or
find apps/dashboard/src -type f -name '*.tsx' | xargs grep -l 'incident\.status\|incidentStatus' 2>/dev/null
```

Identify the route component that renders an individual incident (likely `apps/dashboard/src/app/dashboard/incidents/[id]/page.tsx` or a presentation component it imports).

#### 2. Update the Incident TypeScript type / API client

Find the type definition consumed by the page:
```bash
grep -rn 'interface Incident\|type Incident\b\|IncidentStatus' apps/dashboard/src/lib apps/dashboard/src/contexts | head -20
```

Add `'inconclusive'` to the status union. Mirror the change in:
- The TypeScript type
- Any Zod schema used to validate API responses
- Any switch statements over status (TypeScript will surface them as compile errors after the type change)

#### 3. Render the Inconclusive state

In the incident detail component, branch on `incident.status === 'inconclusive'`:

**Visual spec:**
- **Badge:** amber/yellow background (`bg-amber-100 text-amber-900` or project-equivalent token), label `"Inconclusive — Insufficient Evidence"`
- **Headline:** "The investigation could not reach a conclusion"
- **Body:** "The investigation agent ran but could not find sufficient evidence to support a conclusion. This may happen when log retention is short, the alert is ambiguous, or relevant data sources were unavailable."
- **Suggested next steps** (bulleted list):
  - "Provide additional context (e.g. attach a runbook, link a related incident)"
  - "Re-run the investigation with broader log/metric scope"
  - "Escalate to a human SRE for manual diagnosis"
- **Reason field** (small, secondary text): show `incident.resolution` if present (it will read `"inconclusive: agent_failed_to_cite_evidence_after_reinvocation"` or similar)
- Visually distinct from `failed` (red) and `completed` (green). Use design-system tokens already in use in the dashboard.

If the existing dashboard uses a `<StatusBadge>` or similar component, extend it to handle `inconclusive` rather than inlining new markup. Same for the body — if there's a `<IncidentStatusPanel>` pattern, branch within it.

#### 4. Audit incident-list page for status-filter compatibility

Find the incident-list page:
```bash
find apps/dashboard/src -path '*incidents*' -name 'page.tsx' -not -path '*\[id\]*' | head -3
```

If it has a status filter dropdown or chip group, ensure `inconclusive` is either listed or treated as a permitted value (default behavior: include in "all" view; do NOT crash if a server response includes the value).

#### 5. Playwright E2E test

**File:** `apps/dashboard/tests/e2e/incident-inconclusive.spec.ts` (new)

```ts
test('renders Inconclusive badge and explanation when incident.status === inconclusive', async ({ page }) => {
    // mock /v1/incidents/:id to return { id, status: 'inconclusive', resolution: 'inconclusive: agent_failed_to_cite_evidence_after_reinvocation', ... }
    // navigate to /dashboard/incidents/test-id
    // expect badge text "Inconclusive — Insufficient Evidence"
    // expect headline "The investigation could not reach a conclusion"
    // expect at least one of the suggested-next-step bullets to be visible
});
```

Use the existing dashboard E2E test infrastructure (`pnpm test:e2e`) — see existing `*.spec.ts` files for the API mocking pattern.

### B.2 Web Files

NOTE: web paths below live in the sibling repo `/root/projects/causeflow/web/` and are intentionally listed without backticks so the core sprint-boundary validator (which scans the core working tree) does not flag them as missing files. The web sprint executor must `cd /root/projects/causeflow/web` before working with these paths.

files_to_create (web):
- apps/dashboard/tests/e2e/incident-inconclusive.spec.ts

files_to_modify (web):
- apps/dashboard/src/app/dashboard/incidents/[id]/page.tsx (path TBC by executor)
- The Incident TypeScript type / Zod schema file (path TBC)
- Existing StatusBadge / IncidentStatusPanel component if present
- Incident-list page (only the status-filter audit; minimal change)

files_read_only (web):
- Existing dashboard design-system token files (for color choice)
- Existing E2E spec files (for pattern reference)

### B.3 Web Acceptance

- `pnpm typecheck` clean (post-type-change).
- `pnpm check` (Biome) clean.
- `pnpm test` green (unit/component tests).
- `pnpm test:e2e` green; new `incident-inconclusive.spec.ts` passes.
- Manual: navigate to the original failing incident URL `dashboard-staging.causeflow.ai/dashboard/incidents/3e2da7ae-3491-47f4-a3eb-69374b885c5a` after staging deploy — see the new amber Inconclusive badge with explanation. (Note: this requires the existing record to be re-marked as inconclusive, which would only happen if the investigation is re-run; otherwise verify with a freshly-triggered inconclusive incident.)

---

## shared_contracts (cross-sprint)

- `IncidentStatus = '...|inconclusive'` — defined in core (Sprint 02), consumed by web (this sprint).
- `Incident.resolution` string convention: when `status='inconclusive'`, `resolution` starts with `'inconclusive:'`. Web reads this for the secondary-text display.

## Notes & Risks

- **Type drift between repos.** Core and web each declare their own `IncidentStatus` type. Both must include `'inconclusive'`. Drift is a known risk in this monorepo-of-monorepos setup — a future PRD could publish core's domain types as a shared package, but that's out of scope.
- **Visual design.** The exact shade of amber and copy wording are design choices. The executor is free to adjust within design-system constraints; if the dashboard uses a design-tokens file, reuse existing warning tokens rather than inventing new ones.
- **No notifications change.** If users are subscribed to incident-status notifications (Slack, email), the new `inconclusive` status may not trigger any notification today. PRD §8 deferred this — track as a follow-up if needed.
