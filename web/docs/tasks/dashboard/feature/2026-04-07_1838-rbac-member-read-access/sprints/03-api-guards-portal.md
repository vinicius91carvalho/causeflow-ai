# Sprint 03 — API Route Guard Relaxation + Stripe Portal Member Access

**Depends on:** 01 (needs new permission constants)
**Blocks:** 04
**Est. effort:** 45-60 min
**Parallel:** yes, with Sprint 02 (no file overlap)

## Goal
Loosen **read** endpoints under team/integrations/settings/billing to accept any authenticated tenant member, while keeping **all mutating endpoints** admin-only. Relax `POST /api/billing/portal` to allow member access (Stripe Portal is per-customer and safely scoped by tenant lookup).

## Context
`withAuth()` HOC takes a `requiredPermission` option. Today, many GET endpoints under `/api/team`, `/api/integrations`, `/api/settings`, `/api/billing/subscription` require `MANAGE_*`. We need to switch these to `VIEW_*`. Mutation endpoints (POST/PATCH/DELETE) stay on `MANAGE_*`.

## File Boundaries
- **Create:** none (unless test files missing; check first)
- **Modify:**
  - `apps/dashboard/src/contexts/billing/api/portal-handler.ts`
  - `apps/dashboard/src/contexts/billing/api/subscription-handler.ts`
  - `apps/dashboard/src/contexts/team/api/team-handler.ts` — GET only
  - `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` — GET only
  - `apps/dashboard/src/contexts/settings/api/settings-handler.ts` — GET only
- **Read-only:**
  - `apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts`
  - `apps/dashboard/src/lib/api/with-auth.ts`
  - Any existing `.test.ts` siblings of the above handlers (read to understand fixture patterns)

## Tasks

1. **Portal handler (`billing/api/portal-handler.ts`):**
   - Change `requiredPermission` from `MANAGE_BILLING` to none, OR introduce a new lenient permission check. Simplest: use `VIEW_BILLING` (both roles have it).
   - Confirm the handler reads `tenantId` from session (NEVER from request body). It looks up the Stripe customer by tenantId.
   - Return the portal session `url` for redirect.

2. **Subscription handler GET (`billing/api/subscription-handler.ts`):**
   - Change read endpoint `requiredPermission` to `VIEW_BILLING`.
   - Any POST/mutating branches in the same file stay on `MANAGE_BILLING`.

3. **Team handler (`team/api/team-handler.ts`):**
   - Identify the GET branch. Change it to require `VIEW_TEAM`.
   - POST (invite), PATCH (role change), DELETE (remove) stay on `MANAGE_TEAM`.
   - If team-invite/team-user-role handlers are separate files, leave them alone (already `MANAGE_TEAM`).

4. **Integrations handler (`integrations/api/integrations-handler.ts`):**
   - GET branch → `VIEW_INTEGRATIONS` (already exists, just confirm).
   - POST/DELETE stay on `MANAGE_INTEGRATIONS`.

5. **Settings handler (`settings/api/settings-handler.ts`):**
   - GET → `VIEW_SETTINGS`.
   - PATCH stays on `MANAGE_SETTINGS`.
   - API keys handler (`api-keys-handler.ts`) is OUT OF SCOPE — stays MANAGE_SETTINGS (API keys are admin-only).

6. **Update/write tests** for each modified handler:
   - Member session can GET (200)
   - Member session cannot mutate (403)
   - Admin session can do both
   - Portal endpoint: member session gets valid `{ url }` response, Stripe client is called with the correct tenant's customer ID.
   - Mock the Stripe SDK; do not hit live Stripe.

## Acceptance Criteria
- [ ] Each GET endpoint in the five handlers allows member sessions
- [ ] Every mutating endpoint in the same files still returns 403 for member
- [ ] Portal handler allows member and admin; passes tenantId lookup test
- [ ] No handler accepts `tenantId` from request body (sanity audit)
- [ ] `pnpm vitest run apps/dashboard/src/contexts/{billing,team,integrations,settings}/api/` — green
- [ ] `pnpm exec biome check apps/dashboard/src/contexts/{billing,team,integrations,settings}/api/` — green

## Security checklist
- [ ] `tenantId` always from session, never from client
- [ ] Stripe customer lookup is scoped to the session's tenant
- [ ] Rate limits still applied (withAuth handles this)

## Return Summary
- Handlers modified with before/after permission
- Test count and pass status
- Confirmation that mutation endpoints still 403 for members
- Any handler where the GET/mutation split was unclear
