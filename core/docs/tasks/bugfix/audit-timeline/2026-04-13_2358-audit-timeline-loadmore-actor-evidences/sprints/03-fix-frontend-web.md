# Sprint 3 — Fix Frontend (web)

**Executor:** sprint-executor (sonnet) — runs in `causeflow/web` repo
**Isolation:** worktree (in web repo)
**Est. duration:** 45-60 minutes
**Conditional:** runs only if Sprint 1 diagnosis sets `sprint3_in_scope: true`.

> NOTE: This sprint operates in a **different repository** (`causeflow/web`)
> from the PRD's host repo. The orchestrator must `cd` to the web repo before
> spawning the executor, and the resulting PR lives in the web repo.

## Goal

Apply the minimum frontend changes required to satisfy AC-1, AC-2, AC-3 for
the audit timeline UI. No backend changes in this sprint. No new dependencies.

## Preconditions

- `diagnosis.md` exists (in core repo).
- If `dto_changed: true` from Sprint 2, the backend change is already deployed
  to staging OR the frontend change is feature-flagged.

## Tasks (templated — refine from diagnosis)

1. Read `diagnosis.md` (from core repo path).
2. For each item in its "Sprint 3 scope":
   - Add a failing Vitest/RTL test at the affected component or handler level.
   - Implement the fix.
   - Update i18n keys if a new label is introduced (both `pt-br.json` and
     `en.json`).
3. Ensure `audit-handler.ts` forwards the `cursor` query parameter to the
   core API and surfaces `nextCursor` back to the page.
4. Ensure `audit-list.tsx`:
   - Appends fetched pages, does not replace.
   - Hides/disables "Load More" when no cursor returned.
   - Renders `actor.email || actor.name || actor.id` for user entries; shows
     "system" **only** when `actor.type === 'system'`.
   - Renders `evidences[]` block when the array is non-empty.

## File boundaries

> Paths in this sprint resolve in the `causeflow/web` repo, not this repo.
> They are enumerated as narrative guidance; boundary validation for this
> sprint happens inside the web repo worktree at execution time.

### Creates
- New Vitest/RTL tests under web repo `src/contexts/audit/` (exact file names
  per diagnosis).

### Modifies
(Candidates in the web repo — the executor opens only those named by
diagnosis.md. Narrative list, not validated from core repo:)
- audit api handler, audit domain types, audit-list and audit-page
  components, audit i18n files (pt-br + en), Next.js BFF route for /api/audit,
  core-api-client and core-api-types (only if DTO changed).

### Read-Only
- Every context other than `audit` (investigation, billing, onboarding, etc.).

### Shared Contracts
The web `core-api-types` audit type must stay in sync with the backend DTO. If
Sprint 2 added optional fields, this sprint may type them; it must NOT type
fields the backend does not return.

## Acceptance criteria

- `pnpm typecheck` passes in web repo.
- `pnpm test:run` passes.
- Manual `pnpm dev` run against staging API shows:
  - Load More appends distinct pages; control hides when exhausted.
  - Actor column shows email for user entries, `system` only for job entries.
  - Evidences render when present.
- No new ESLint warnings introduced.

## Return contract

Return a structured summary with exactly these fields:
- `files_changed: string[]`
- `tests_added: string[]`
- `i18n_keys_added: string[]`
- `typecheck: "PASS" | "FAIL"`
- `unit_tests: "PASS" | "FAIL"`
- `notes: string` (≤5 lines)
