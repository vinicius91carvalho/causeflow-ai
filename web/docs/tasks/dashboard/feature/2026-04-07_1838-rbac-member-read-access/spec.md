# PRD A — Dashboard RBAC: Member Read Access + Stripe Portal Surfacing

**Created:** 2026-04-07 18:38
**Mode:** PRD + Sprint
**Status:** Build Candidate (pending tag)
**Owner:** Vinicius

---

## 1. Intent

Today, members of an organization in the CauseFlow Dashboard cannot see Billing, Settings, Team, or Integrations at all — these pages are fully gated behind `MANAGE_*` permissions which only admins hold. This creates a poor experience: a member can't even see who's on their team, what plan they're on, or what integrations are connected.

We are introducing **read access** for members across these four areas, while keeping all mutations (invite, change role, disconnect integration, change plan, edit settings) admin-only. We are also surfacing the **Stripe Customer Portal** redirect from the Billing page so members (and admins) can view their invoices, payment history, and billing details directly via Stripe — Stripe owns the canonical billing UI, we just link to it.

## 2. Why now

- Members report feeling "locked out" of basic organizational visibility.
- A member needs to know which integrations are connected to interpret the data they're seeing in analyses.
- Finance owners (often non-admin members) need invoice access for accounting; today they must ask an admin.
- The current `permissions.ts` semantically conflates "view" and "manage" under a single `MANAGE_*` flag, which is wrong and blocks this feature cleanly.

## 3. Scope

### In scope
- Add three new permission constants: `VIEW_BILLING`, `VIEW_SETTINGS`, `VIEW_TEAM` (alongside the already-existing `VIEW_INTEGRATIONS`).
- Grant all four `VIEW_*` perms to **both** admin and member roles.
- Keep all `MANAGE_*` perms admin-only.
- Update page-level guards on `/dashboard/billing`, `/dashboard/settings`, `/dashboard/team`, `/dashboard/integrations` to check `VIEW_*` instead of `MANAGE_*`.
- Update **action-level** controls (buttons, forms, role dropdowns, invite modals, plan-change buttons, integration connect/disconnect) to check `MANAGE_*` and render disabled / hidden for members.
- Server-side API route guards: keep `MANAGE_*` checks on all mutating endpoints (already correct), add `VIEW_*` checks on read endpoints that currently require `MANAGE_*`.
- **Billing page** (read view for members + new for admins): show current plan, status, renewal date, credits used/remaining (read-only), and a "Manage billing in Stripe" button that calls `POST /api/billing/portal` to redirect to the Stripe Customer Portal. Stripe handles invoice list, payment methods, billing history.
- The "Manage billing in Stripe" button itself is shown for **both** roles (the user explicitly asked for members to see invoices). The underlying `/api/billing/portal` route currently requires admin — we'll relax it to allow any authenticated member of the tenant. Stripe Portal is per-customer (the tenant's Stripe customer), so any member of that tenant rightly should be able to access it.
- Update tests for `permissions.ts`, page guards, and API route guards.
- Update `apps/dashboard/CLAUDE.md` RBAC table.
- Update i18n strings (en + pt-br) for any new UI labels (e.g., "View only", "Manage billing in Stripe").

### Out of scope
- Audit/Approvals access changes (members already have appropriate access; admin-only for sensitive actions stays).
- New role types (no "billing-only" role, no "viewer" role — just admin and member).
- Stripe-side configuration (Customer Portal must already be enabled in Stripe Dashboard for the live mode account; if not, that's a separate ops task — this PRD assumes it's enabled).
- Email notifications for permission changes.
- A separate "Invoices" page in the dashboard — we redirect to Stripe instead.
- Granular per-resource permissions (e.g., "view this specific integration"). All-or-nothing per category.

## 4. Audience & Decisions (Correctness Discovery)

1. **Audience:** Members of CauseFlow tenants who are not admins. They use the dashboard to submit and view analyses. The decision they make with this output: "What integrations do we have? Who's on my team? What plan are we on? Where's our last invoice?"
2. **Failure definition:** A member sees a page they shouldn't (admin-only mutation form), OR a member gets a 403 on a page they should be able to view, OR an action button is enabled for a member and lets them mutate.
3. **Danger definition:** A member can mutate state via a UI control that wasn't properly gated (privilege escalation). Or a member sees PII / payment details they shouldn't via the Stripe Portal — but Stripe Portal scopes access correctly per customer, so this is mitigated by Stripe.
4. **Uncertainty policy:** Stop and ask. Permissions are security-relevant.
5. **Risk tolerance:** Refusal > confidently wrong. Better to deny access than to wrongly grant it.
6. **Verification:** Unit tests on `hasPermission`. Integration tests on each affected API route with both `admin` and `member` session fixtures. Playwright E2E test that signs in as a member and visits all four pages, asserting page renders + mutation controls are absent/disabled. Manual verification with two test accounts.

## 5. Acceptance Criteria

- [ ] `permissions.ts` exports `VIEW_BILLING`, `VIEW_SETTINGS`, `VIEW_TEAM` constants.
- [ ] Both `admin` and `member` roles include all four `VIEW_*` permissions in `ROLE_PERMISSIONS`.
- [ ] Unit tests in `permissions.test.ts` cover the new permissions for both roles (admin has all, member has VIEW_* only, member does NOT have any MANAGE_*).
- [ ] `/dashboard/billing` page renders for members with: current plan, credits, "Manage billing in Stripe" button. NO "Change plan" / "Cancel subscription" / "Add payment method" buttons (those stay admin-only inside Stripe Portal anyway, plus we hide the inline upgrade buttons for members).
- [ ] `/dashboard/settings` page renders for members with all settings fields visible but read-only (disabled inputs, no save button).
- [ ] `/dashboard/team` page renders for members with the team members list visible. NO "Invite member" button. NO role-change dropdowns. NO "Remove member" buttons.
- [ ] `/dashboard/integrations` page renders for members with the integration list and per-integration health visible. NO "Connect" / "Disconnect" / "Edit credentials" buttons.
- [ ] `POST /api/billing/portal` accepts requests from members (not just admins). Stripe Customer Portal session is created with the tenant's Stripe customer ID.
- [ ] All `MANAGE_*` mutation endpoints (`POST /api/team/invite`, `PATCH /api/team/users/:id/role`, `POST /api/integrations/:type`, `DELETE /api/integrations/:type`, `PATCH /api/settings`, `POST /api/billing/checkout`) still return 403 for member sessions.
- [ ] Playwright E2E: `tests/dashboard/rbac-member-read.spec.ts` signs in as a member (fixture), visits all four pages, asserts page loads + key view elements visible + key mutation controls absent.
- [ ] `apps/dashboard/CLAUDE.md` RBAC table updated.
- [ ] i18n keys added to en.json and pt-br.json for: `manageBillingInStripe`, `viewOnly`, `adminOnlyAction`.
- [ ] Build passes: `pnpm turbo build`. Lint passes: `pnpm exec biome check .`. Types pass: `pnpm turbo check-types`. Tests pass: `pnpm turbo test`.

## 6. Sprint Plan

| # | Sprint | Files | Independence |
|---|---|---|---|
| 1 | RBAC permissions + tests | `permissions.ts`, `permissions.test.ts`, CLAUDE.md RBAC table | Foundation — must run first |
| 2 | Page guards + UI control gating | billing-page, settings-page, team-page, integrations-page (+ their child components for action buttons), i18n en/pt-br | Depends on Sprint 1 |
| 3 | API route relaxation + Stripe Portal access | `portal-handler.ts`, `team-handler.ts` (read), `integrations-handler.ts` (read), `settings-handler.ts` (read), `subscription-handler.ts` (read), tests | Can run parallel with Sprint 2 (different files) |
| 4 | E2E + verification | `tests/dashboard/rbac-member-read.spec.ts` | Depends on Sprints 1-3 |

## 7. Risks & Mitigations

- **Risk:** A control we forget to gate becomes a privilege escalation. **Mitigation:** Sprint 2 explicitly enumerates every mutation control per page in the sprint spec; code review (Phase 5) re-enumerates.
- **Risk:** Stripe Customer Portal not enabled in the live account. **Mitigation:** Sprint 3 dev verification step: hit the portal endpoint locally, document the Stripe Dashboard setting needed if it errors.
- **Risk:** Existing admin-only API tests break when guards loosen. **Mitigation:** Tests run in CI; Sprint 3 updates assertions to match new contract.
- **Risk:** Stripe Portal returns invoice data the user shouldn't see (cross-tenant). **Mitigation:** Customer Portal sessions are scoped per Stripe customer; we look up the customer by `tenantId` from the session, never accept it from the client. Already correct in `portal-handler.ts`.

## 8. Files Touched (estimated)

- `apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts`
- `apps/dashboard/src/contexts/identity/domain/rbac/permissions.test.ts`
- `apps/dashboard/src/contexts/billing/presentation/pages/billing-page.tsx`
- `apps/dashboard/src/contexts/settings/presentation/pages/settings-page.tsx`
- `apps/dashboard/src/contexts/team/presentation/pages/team-page.tsx`
- `apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx`
- Action-level components inside team/, integrations/, billing/, settings/ presentation/components/
- `apps/dashboard/src/contexts/billing/api/portal-handler.ts`
- `apps/dashboard/src/contexts/team/api/team-handler.ts` (read endpoints only)
- `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` (read only)
- `apps/dashboard/src/contexts/settings/api/settings-handler.ts` (GET only)
- `apps/dashboard/src/contexts/billing/api/subscription-handler.ts` (GET only)
- `apps/dashboard/src/contexts/{billing,settings,team,integrations}/infrastructure/i18n/en.json`
- `apps/dashboard/src/contexts/{billing,settings,team,integrations}/infrastructure/i18n/pt-br.json`
- `tests/dashboard/rbac-member-read.spec.ts` (new)
- `apps/dashboard/CLAUDE.md` (RBAC table)

Estimated: ~18 files touched.

## 9. Verification Plan

1. `pnpm turbo test` — green
2. `pnpm exec biome check .` — green
3. `pnpm turbo check-types` — green
4. `pnpm turbo build` — green
5. `pnpm exec playwright test tests/dashboard/rbac-member-read.spec.ts` — green
6. Manual: dev server, sign in as member fixture, click through all four pages, attempt to find any mutation control — none should be present.
7. Manual: click "Manage billing in Stripe" as both admin and member — both should land in the Stripe Customer Portal scoped to the tenant.
