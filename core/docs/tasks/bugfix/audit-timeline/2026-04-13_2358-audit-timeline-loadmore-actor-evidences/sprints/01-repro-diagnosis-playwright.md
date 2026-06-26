# Sprint 1 — Repro & Diagnosis via Playwright

**Executor:** main orchestrator (stays in-thread; Playwright MCP owns browser state)
**Model:** opus (orchestrator)
**Isolation:** none (main agent)
**Est. duration:** 30-45 minutes

## Goal

Reproduce the three symptoms on staging with the provided credentials and produce
a **diagnosis note** that enables Sprints 2 and 3 to make minimal, targeted fixes.

## Preconditions

- Staging is up.
- Credentials loaded: `STAGING_TEST_USER=vinicius@simuser.ai`,
  `STAGING_TEST_PASSWORD` from `/root/projects/causeflow/web/apps/dashboard/.env.staging`.
- At least one tenant has audit entries with evidences populated.

## Tasks

1. Launch Playwright, navigate to staging dashboard, log in.
2. Navigate to `/dashboard/audit`.
3. **Symptom 1 (Load More):**
   - Capture Network tab: request URL, query params, response body for the
     initial fetch and the Load More fetch.
   - Confirm whether backend returns a cursor / next token.
   - Confirm whether frontend sends it back on the next request.
   - Identify: (a) backend cursor missing, (b) frontend not forwarding cursor,
     (c) response merge logic bug, (d) ordering bug.
4. **Symptom 2 (Actor):**
   - Pick at least 3 entries that are clearly produced by a user action (e.g.
     a login or settings change triggered from the test user in the same
     session).
   - Capture the raw `actor` payload from the Network response for those
     entries.
   - Identify: (a) backend serializes `actor` as `system`, (b) backend sends
     user but frontend renders `system`, (c) event producer enqueued without
     caller context.
5. **Symptom 3 (Evidences):**
   - Pick entries known to have evidences (trigger one if none exist).
   - Capture `evidences` field of the raw response.
   - Identify: (a) backend omits field, (b) field present but empty, (c)
     frontend does not render it, (d) component has a broken conditional.
6. **Capture artifacts** in `.artifacts/playwright/screenshots/<ts>/`:
   - Screenshots of audit page (initial, post Load More, entry detail).
   - HAR or response JSON of both `/api/audit` calls.
   - Browser console log.
7. **Write diagnosis note** to
   `docs/tasks/bugfix/audit-timeline/2026-04-13_2358-audit-timeline-loadmore-actor-evidences/diagnosis.md`
   containing:
   - For each symptom: **root cause** (backend / frontend / both), **exact
     file paths**, **one-sentence fix description**, **contract change? yes/no**.
   - A "Sprint 2 scope" bulletlist and a "Sprint 3 scope" bulletlist.

## File boundaries

### Creates
- docs/tasks/bugfix/audit-timeline/2026-04-13_2358-audit-timeline-loadmore-actor-evidences/diagnosis.md
- .artifacts/playwright/screenshots/ timestamped subdirectory (artifacts only)

### Modifies
(none)

### Read-Only
- All source under core `src/modules/audit/` (glob)
- All source under web `src/contexts/audit/` (glob) — different repo
- Web BFF route `src/app/api/audit/route.ts` — different repo

### Shared Contracts
(none — diagnostic only)

## Acceptance criteria

- Diagnosis note exists and answers: for each symptom, is the fix in `core`,
  `web`, or both? cite exact files.
- At least one reproduction screenshot per symptom saved under `.artifacts/`.
- Raw response JSON (or HAR) captured for at least one Load More attempt and
  for one entry whose actor is incorrectly shown as `system`.

## Return contract

Return a structured summary with exactly these fields:
- `s1_root_cause: { backend|frontend|both, files: string[] }`
- `s2_root_cause: { backend|frontend|both, files: string[] }`
- `s3_root_cause: { backend|frontend|both, files: string[] }`
- `sprint2_in_scope: boolean`
- `sprint3_in_scope: boolean`
- `parallelizable_s2_s3: boolean`
- `contract_change: boolean`  (true if audit entry DTO shape changes)
- `diagnosis_path: string`
