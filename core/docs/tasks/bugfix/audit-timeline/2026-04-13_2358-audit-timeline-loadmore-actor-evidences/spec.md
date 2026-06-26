# PRD: Audit Timeline Fixes — Load More, Actor Attribution, Evidences

**ID:** 2026-04-13_2358-audit-timeline-loadmore-actor-evidences
**Mode:** PRD + Sprint
**Area:** bugfix
**Category:** audit / observability
**Owner:** Vinicius
**Status:** Build Candidate
**Repos affected:** `causeflow/core` (backend), `causeflow/web` (dashboard)

---

## 1. Problem Statement

Three defects observed by admins/owners on the **Audit page** of the staging
dashboard (`/dashboard/audit`):

1. **Load More broken** — the "Load More" control either does not fetch the next
   page, returns a duplicate page, or produces a blank list.
2. **Actor misattribution** — entries produced by authenticated users are being
   displayed as `system` instead of the user's email/name. `system` should only
   appear for background jobs / schedulers.
3. **Evidences missing** — audit entries that carry evidences (links, artifacts,
   screenshots, references) render with an empty evidences section.

These defects degrade the audit product for the primary audience (admins/owners
performing compliance reviews). The most severe symptom is (1) which can render
the audit surface unusable; (2) is a tolerable-but-urgent correctness issue; (3)
reduces forensic value of the log.

---

## 2. Audience & Decision

- **Primary audience:** Account admins / owners auditing actions taken in their
  tenant (compliance, incident post-mortem, user-activity review).
- **Decision they make:** "Did user X take action Y at time T, and what was the
  evidence?" — used to verify SOC-style trails, investigate suspected misuse,
  and reconstruct incident timelines.

---

## 3. Verification (Acceptance Criteria)

A fix is correct **if and only if** all three criteria hold on staging, for a
non-admin tenant user logged in with the provided credentials:

- **AC-1 — Pagination:** Clicking "Load More" fetches a new, **distinct** page
  of entries appended to the list, ordered by `timestamp DESC` with no
  duplicates and no gaps. When there are no more entries, the control is hidden
  or disabled with a "no more entries" affordance.
- **AC-2 — Actor attribution:** For every entry whose underlying action was
  produced by an authenticated user, the `actor` column shows the user's
  `email` (or `name` when available). The literal string `system` is shown
  **only** when the originating action was executed by a background job,
  scheduler, or webhook with no user context.
- **AC-3 — Evidences:** When an audit entry carries evidences (non-empty
  `evidences[]` in the backend payload), the UI renders them in an
  expandable/inline evidences block. When none exist the block is absent — not
  an empty placeholder.
- **AC-4 — Tenant isolation (non-negotiable security):** No user of tenant A
  may observe any audit entry belonging to tenant B, in any response, at any
  page depth. Verified by E2E with two distinct tenants and by a backend
  contract test.

---

## 4. Failure & Danger Definitions

- **Catastrophic (rollback immediately):** blank audit page, any cross-tenant
  leak of audit entries, authentication bypass on `/api/audit`, loss of
  existing audit data.
- **Tolerable (fix forward):** brief window where actor appears as `system`
  while frontend cache refreshes, cosmetic evidence layout issues, pagination
  fetching in the wrong PageSize within ±5 of the declared default.

---

## 5. Risk & Uncertainty Policy

- **Security/privacy** — non-negotiable. Any fix that touches the audit query
  must preserve `tenantId` scoping in the repository layer. A failing
  cross-tenant contract test blocks merge.
- **Uncertainty** — root cause is not yet known for any of the 3 symptoms. The
  PRD defers root-cause identification to **Sprint 1 (Playwright diagnosis)**
  which will feed conditional requirements into Sprints 2 and 3.
- **Risk tolerance / rollout** — **separate PRs per repo** (`core` and `web`).
  Backend PR merges first and deploys to staging; frontend PR follows. This
  keeps blast radius small and lets us roll back either side independently.

---

## 6. Context Loaded

### Backend (`causeflow/core`)
- Audit module: `src/modules/audit/{domain,application,infra}` — follows
  Clean Architecture conventions documented in project `CLAUDE.md` (Dependency
  Rule, entity/repository/usecase/routes naming).
- Tenant scoping pattern: ElectroDB Single Table, `tenantId` as partition key
  prefix on audit entities.
- Event source: audit entries are produced from events on the in-process
  EventBus and persisted via an ElectroDB entity under
  `src/shared/infra/db/entities/`.

### Frontend (`causeflow/web/apps/dashboard`)
- Audit context: `src/contexts/audit/{api,domain,infrastructure,presentation}`.
- Entry points:
  - Page: `src/app/[locale]/dashboard/audit/page.tsx`
  - Next.js route handler (BFF): `src/app/api/audit/route.ts`
  - API handler (pure function): `src/contexts/audit/api/audit-handler.ts`
  - View components: `src/contexts/audit/presentation/pages/audit-page.tsx`,
    `.../components/audit-list.tsx`
  - Types: `src/contexts/audit/domain/types.ts`
  - i18n: `.../infrastructure/i18n/{pt-br,en}.json`
- HTTP client wrappers: `src/lib/api/{http-api-client,core-api-client,core-api-types}.ts`.

### Known good patterns
- Pagination is typically cursor-based in this codebase (ElectroDB `cursor`).
- Actor resolution normally happens at use-case construction time using the
  authenticated caller from the Hono context.

---

## 7. Architecture Decisions

1. **Do not change the DynamoDB key schema.** Fixes must operate within the
   existing Single Table layout.
2. **Cursor-based pagination** is the source of truth. If the frontend is
   currently using offset/limit, the fix is to switch the frontend to cursor —
   not to add offset support to the backend.
3. **Actor resolution lives in the Application layer** (use case), not in the
   presenter. The DTO returned from `/api/audit` must already contain the
   correct `actor` payload (`{ type: 'user' | 'system', email?, name?, id? }`).
4. **Evidences are part of the audit entry DTO**, not a separate fetch. If the
   backend already returns them, fix is frontend-only; if the backend strips
   them, fix is backend-first then frontend.
5. **Separate PRs per repo.** No shared monorepo merge commit.

---

## 8. Security Boundaries

- `/api/audit` (BFF) and core `/audit` routes MUST require an authenticated
  session and resolve `tenantId` from the session — never from a query string
  or body.
- The repository layer MUST reject queries that do not include a `tenantId`
  filter (enforced by a contract test in Sprint 2).
- Evidences payloads MUST NOT embed raw secrets; existing masking rules in
  the audit module apply unchanged.
- Logs MUST NOT print evidence payloads at `info` or above.

---

## 9. Data Model (current, not changed by this PRD)

`AuditEntry`:
- `tenantId: string` (partition)
- `entryId: string` (sort / ULID)
- `timestamp: ISO8601`
- `action: string`
- `actor: { type: 'user' | 'system'; id?: string; email?: string; name?: string }`
- `target?: { type: string; id: string }`
- `evidences?: Evidence[]`
- `metadata?: Record<string, unknown>`

No migrations required.

---

## 10. Access Patterns

- List latest entries by tenant, cursor-paginated, ordered by `timestamp DESC`.
- (Future / out of scope) Filter by actor, by action, by target.

These fit the existing Single Table layout using `pk = TENANT#<id>`,
`sk = AUDIT#<ulid>` with `ScanIndexForward=false`.

---

## 11. Out of Scope

- Filters (by actor/action/target) — not shipping in this PRD.
- New audit entry types.
- Bulk export.
- Retention policy changes.

---

## 12. Sprint Decomposition

Four sprints, max (rule: ≤5). Sprints 2 and 3 are **conditional** — their
concrete tasks are refined from Sprint 1's diagnosis output before execution.

| # | Title | Scope | Size |
|---|-------|-------|------|
| 1 | Repro & Diagnosis via Playwright | Stays in main orchestrator; produces diagnosis note | 30-45m |
| 2 | Fix backend (core) | Conditional on S1 findings; audit module only | 45-60m |
| 3 | Fix frontend (web) | Conditional on S1 findings; audit context only | 45-60m |
| 4 | E2E tests covering the three scenarios | Playwright specs + contract test | 45-60m |

Parallelism: S2 and S3 MAY run in parallel **only if** S1 diagnosis shows the
issues are genuinely independent across the repo boundary. Default is
sequential (S2 → S3) because frontend changes may depend on DTO shape.

---

## 13. Rollout & Rollback

- **Rollout:** Backend PR → staging → smoke → Frontend PR → staging → E2E →
  production (via `/ship-test-ensure` with manual prod approval).
- **Rollback:** Revert the offending PR. No data migrations to undo. Audit log
  is append-only; no data at risk.

---

## 14. Credentials (staging)

- `STAGING_TEST_USER=vinicius@simuser.ai`
- `STAGING_TEST_PASSWORD` stored in `/root/projects/causeflow/web/apps/dashboard/.env.staging`.
- A **second tenant** credential is required for AC-4 cross-tenant isolation
  testing. If not available at Sprint 4 start, Sprint 4 will ask the user.

---

## 15. Open Questions

- Is there an existing second-tenant staging account for AC-4? If not,
  `/plan-build-test` should ask before starting Sprint 4.
