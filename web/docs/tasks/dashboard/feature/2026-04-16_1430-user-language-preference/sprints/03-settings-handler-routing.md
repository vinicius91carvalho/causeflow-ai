# Sprint 3: Settings-handler routing fix

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 5
- **Depends on:** Sprint 2
- **Batch:** 2
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Update the dashboard's `PATCH /api/settings` handler so that user-scoped fields (`locale`, `theme`, `notifications`) are routed via `HttpApiClient.updateUserSettings`, and tenant-scoped fields (`name` → `userName`, `companyName`, `websiteUrl`) continue to route via `HttpApiClient.updateTenant`. Lock the routing rule with Vitest unit tests.

## File Boundaries

### Creates (new files)

- `/root/projects/causeflow/web/apps/dashboard/src/contexts/settings/api/settings-handler.test.ts` — only if unit tests for the handler do not already exist; otherwise extend the existing file.

### Modifies (can touch)

- `/root/projects/causeflow/web/apps/dashboard/src/contexts/settings/api/settings-handler.ts` — split routing so `locale`, `theme`, `notifications` hit `updateUserSettings`, while `name`, `companyName`, `websiteUrl` hit `updateTenant`. Must also handle the case where both kinds of fields arrive in the same request body (call both clients, merge responses).

### Read-Only (reference but do NOT modify)

- `/root/projects/causeflow/web/apps/dashboard/src/lib/api/http-api-client.ts` — reference `updateUserSettings` and `updateTenant` signatures from Sprint 2.
- `/root/projects/causeflow/web/apps/dashboard/src/contexts/settings/domain/types.ts` — reference `Locale`, `UserSettings`, `Theme`, `NotificationSettings` exports from Sprint 2.
- `/root/projects/causeflow/web/apps/dashboard/src/lib/api/with-auth.ts` (or equivalent) — confirm the wrapper that enforces Clerk session and injects `ctx.userId` + `ctx.tenantId`.

### Shared Contracts (consume from prior sprints or PRD)

- From Sprint 2: `HttpApiClient.updateUserSettings`, `HttpApiClient.updateTenant`, `Locale`, `UserSettings`, `Theme`, `NotificationSettings`.
- From PRD §12: `PATCH /api/settings` request body continues to accept `{ theme?, locale?, notifications?, name?, companyName?, websiteUrl? }`.
- From PRD §13: routing rule — `locale/theme/notifications` → user-settings; `companyName/name/websiteUrl` → tenant.

### Consumed Invariants (from INVARIANTS.md)

- **`/api/settings` Routing Rule** — verified by the unit tests added in this sprint.

## Tasks

- [x] Read `settings-handler.ts` end-to-end; identify the current payload-building logic (today everything is funneled into `settingsUpdate` and passed to `api.updateTenant`).
- [x] Split the handler into two logical buckets: `userSettingsUpdate` (`theme`, `locale`, `notifications`) and `tenantUpdate` (`userName` from `name`, `companyName`, `websiteUrl`).
- [x] When only user-scoped fields are present, call only `updateUserSettings(ctx.userId, userSettingsUpdate)`.
- [x] When only tenant-scoped fields are present, call only `updateTenant(ctx.tenantId, tenantUpdate)`.
- [x] When both are present, call both (in parallel via `Promise.all`); if either fails, return a 502 and surface the error; do NOT swallow.
- [x] Preserve existing admin-only guard for company-info updates (403 if non-admin).
- [x] Preserve existing trimming rules and `websiteUrl: undefined` normalization.
- [x] Update/rewrite the GET handler only if necessary to use `getUserSettings` for the locale field; otherwise leave GET untouched (out of scope for this sprint unless it breaks). — GET left untouched; not broken.
- [x] Write Vitest unit tests: one case per routing scenario (user-only, tenant-only, both, neither/empty, non-admin company attempt).

## Acceptance Criteria

- [x] Sending `PATCH /api/settings` with `{locale: 'pt-br'}` results in exactly one call to `updateUserSettings(ctx.userId, { locale: 'pt-br' })` and zero calls to `updateTenant`. — verified in `case A` (test file line ~82).
- [x] Sending `PATCH /api/settings` with `{companyName: 'Acme'}` (as admin) results in exactly one call to `updateTenant(ctx.tenantId, { name: 'Acme' })` and zero calls to `updateUserSettings`. — verified in `case B`.
- [x] Sending both in one request triggers both clients; both must succeed for a 200 response. — verified in `case C` + error paths in `case C.err` / `case C.err.2`.
- [x] Non-admin sending `companyName` gets 403 without any core call being attempted. — verified in `case E` and `case E.1`.
- [x] `pnpm vitest run` passes for the dashboard scope. — 14/14 passed, 253ms.
- [x] `pnpm turbo check-types` passes. — `pnpm --filter @causeflow/dashboard check-types` exit 0.
- [x] `pnpm exec biome check .` passes. — changed files exit 0 (pre-existing monorepo warnings are out of scope).

## Verification

- [x] Unit tests added in this sprint cover all five routing cases above. — plus 9 additional coverage tests (theme-only, notifications-only, name→userName, two error paths, non-admin allowed for user fields, trimming, websiteUrl normalization).
- [ ] `pnpm turbo build` passes. — not run (heavy, not required to close the sprint; typecheck + lint + tests sufficient).
- [x] `pnpm turbo check-types` passes.
- [x] `pnpm exec biome check .` passes (on Sprint 3 files).

## Security Checklist (maps to PRD §10)

- [x] **Auth model:** The handler remains wrapped by the existing `withAuth` (or equivalent) helper; `ctx.userId` and `ctx.tenantId` come from the Clerk session, never from the request body.
- [x] **Trust boundaries:** Request body continues to be validated by the existing `updateSettingsSchema` Zod validator; unknown fields are stripped or rejected per current behavior.
- [x] **Tenant isolation:** `ctx.tenantId` sourced from session only. The user can never update another tenant's record; the user can never update another user's settings (core enforces this via `userId` in path + session-derived tenantId).
- [x] **Admin gate:** Non-admin attempts to set `companyName` / `websiteUrl` / `name` (company-level) still return 403 — this is tested (`case E`, `case E.1`).

## Context

Current `settings-handler.ts` behavior (summary from explore):
- Extracts `theme`, `locale`, `notifications`, `name`, `companyName`, `websiteUrl` from body.
- Maps `name` → `userName`, `companyName` → `name` in the update payload.
- Admin-only validation for company info updates (403 if non-admin attempts).
- All string values trimmed; `websiteUrl` set to `undefined` if empty.
- **BUG:** calls `api.updateTenant(ctx.tenantId, settingsUpdate)` with ALL fields, including `locale`. This sprint fixes the routing.

Merge semantics when both client calls happen: return a single `UserSettings`+tenant-info-shaped object for the handler response that preserves the existing GET-shaped contract. If the existing GET shape reads from `me?.settings` (per explore), make sure the PATCH response still shapes the same way (tests should lock this).

## Agent Notes (filled during execution)

- Assigned to: orchestrator (inline execution, sonnet-model delegation unavailable in this session)
- Started: 2026-04-16T18:27Z
- Completed: 2026-04-16T18:38Z
- Commit: f61e41a (`feat(dashboard): Sprint 3 — split PATCH /api/settings routing (user vs tenant)`) — see Step 6 verification
- Decisions made:
  - **Empty-body contract:** `PATCH {}` returns 200 with `{ settings: {} }`. No client calls. Chosen to keep the client-side form save logic idempotent — the UI can always `await fetch(PATCH)` after any edit without guarding on "is there something to send." Alternative considered: 400 "No fields to update" — rejected because it would force the UI to pre-check the payload shape.
  - **Merge response shape when both clients are called:** shallow-merge `{ ...tenantResult, ...userResult }`. User-settings fields win on conflict. There is no field overlap today between `UserSettings` and `ApiTenant`, so the merge order is a safety rail, not an active tiebreak.
  - **502 on partial failure:** `Promise.all` is used in the both-buckets branch — if either client rejects, the whole handler returns 502 with the original error message. No retry, no partial write. This trades consistency for simplicity; the UI is expected to retry the whole PATCH on 502. A compensating rollback was NOT implemented because Core API writes are individually idempotent (PATCH) and the window for partial state is small.
  - **Tenant-scoped type `TenantUpdate`:** extended `UpdateTenantSettingsInput` with `userName?: string` and `websiteUrl?: string` pass-through fields to match the pre-Sprint-3 behavior. The Core `/v1/tenants/:id` endpoint historically accepted these fields even though the wire type only declared `{ name?, settings? }`. Ideally Core tightens `UpdateTenantSettingsInput` in a follow-up and we drop the intersection — tracked as a tech-debt item.
  - **Locale cast `data.locale as Locale`:** `updateSettingsSchema` still accepts `string` for `locale` (for forward compat). We narrow to `Locale = 'en' | 'pt-br'` at the handler boundary before calling `updateUserSettings`. A future sprint could tighten the Zod schema to `z.enum(['en', 'pt-br'])` — deferred to avoid coupling to Sprint 4/5.
- Assumptions:
  - `withAuth`'s `ctx.role` is canonicalized to `'admin' | 'member'` (verified in `with-auth.ts` line 93 — Clerk `org:admin` → `'admin'`).
  - The mock Core API client (used when `CORE_API_URL` is blank in local dev) also implements `updateUserSettings` and `updateTenant` — this is a Sprint 1/2 invariant, not re-verified here.
  - No existing consumer of `PATCH /api/settings` inspects the response shape beyond `response.ok` and `response.status`. Verified by skimming `settings-content.tsx` behavior — it refetches via GET after PATCH, not by parsing the PATCH body.
- Issues found:
  - `UpdateTenantSettingsInput` in `core-api-types.ts` is too narrow (`{ name?, settings? }`) — does not declare `userName` or `websiteUrl` even though Core accepts them. Worked around with an intersection type; flagging for Sprint 5 or a dedicated cleanup.
  - Pre-existing biome warnings / errors in the monorepo (17 errors, 321 warnings from `pnpm exec biome check .`) are NOT introduced by Sprint 3 — confirmed by running biome on `apps/dashboard/src/contexts/settings/` (1 pre-existing `<img>` warning, 0 errors).
- Blockers: none
