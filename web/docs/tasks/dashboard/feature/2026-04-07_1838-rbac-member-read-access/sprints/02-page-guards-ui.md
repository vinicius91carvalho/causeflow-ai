# Sprint 02 — Page Guards & UI Control Gating

**Depends on:** 01 (must be merged first — consumes new permission constants)
**Blocks:** 04
**Est. effort:** 60-75 min
**Parallel:** yes, with Sprint 03 (no file overlap)

## Goal
Gate the four target pages (`billing`, `settings`, `team`, `integrations`) at the **page level** using `VIEW_*` perms (so members can access) and at the **action level** using `MANAGE_*` perms (so mutation controls are hidden for members). Add i18n strings. Add the "Manage billing in Stripe" button on the billing page (visible to both roles).

## Context
Today these pages either redirect members away or show `<RoleGuard permission={MANAGE_*}>` wrappers that hide the entire page for non-admins. We need to flip that: page-level access uses `VIEW_*`, mutation buttons/forms wrap in `MANAGE_*` guards.

## File Boundaries
- **Create:** none
- **Modify:**
  - `apps/dashboard/src/contexts/billing/presentation/pages/billing-page.tsx`
  - `apps/dashboard/src/contexts/settings/presentation/pages/settings-page.tsx`
  - `apps/dashboard/src/contexts/team/presentation/pages/team-page.tsx`
  - `apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx`
  - Mutation child components inside `contexts/{billing,settings,team,integrations}/presentation/components/` — only the ones containing invite/connect/disconnect/save/change-plan buttons
  - `apps/dashboard/src/contexts/billing/infrastructure/i18n/{en,pt-br}.json`
  - `apps/dashboard/src/contexts/settings/infrastructure/i18n/{en,pt-br}.json`
  - `apps/dashboard/src/contexts/team/infrastructure/i18n/{en,pt-br}.json`
  - `apps/dashboard/src/contexts/integrations/infrastructure/i18n/{en,pt-br}.json`
- **Read-only:**
  - `apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts`
  - `apps/dashboard/src/contexts/identity/presentation/components/role-guard.tsx` (or wherever `RoleGuard` / `usePermission` live)

## Tasks

### Per-page guard flip
For each of the four pages:
1. Find the current page-level check. Replace `MANAGE_*` with the corresponding `VIEW_*`.
2. Identify every mutation control on the page. Wrap each in `<RoleGuard permission={PERMISSION.MANAGE_*}>` OR conditionally render via `usePermission(MANAGE_*)`.

### Billing page specifics
3. Render plan info, status, credits, renewal date as read-only for everyone.
4. Add a primary button: **"Manage billing in Stripe"** (i18n key `manageBillingInStripe`). OnClick: POST to `/api/billing/portal`, take `{ url }` from response, `window.location.href = url`.
5. Hide the inline "Change plan" / "Cancel" / "Upgrade" buttons for members (gate with MANAGE_BILLING).
6. The "Manage billing in Stripe" button is visible to BOTH roles (no permission gate on this one).

### Team page specifics
7. Show the member list to everyone.
8. Hide "Invite member" button for members.
9. Hide role-change dropdown (render role as plain text) for members.
10. Hide "Remove member" action for members.
11. Hide "Resend invite" / "Cancel invite" on the pending invites list for members (members can still see pending invites).

### Integrations page specifics
12. Show integration catalog and per-integration health status to everyone.
13. Hide "Connect" button + connection modal trigger for members.
14. Hide "Disconnect" / "Edit credentials" / "Test connection" buttons for members.
15. Show integration list as read-only cards for members.

### Settings page specifics
16. Show all settings fields to everyone.
17. For members: render inputs with `disabled` attribute AND hide the "Save" button.
18. Hide the "Delete account" / "Danger zone" section entirely for members.
19. Hide API key management for members (creating/revoking API keys is MANAGE_SETTINGS).

### i18n keys to add
Add these keys to all four contexts' en.json and pt-br.json (choose the context that owns the string):
- `billing.manageBillingInStripe` — EN: "Manage billing in Stripe" — PT-BR: "Gerenciar cobrança no Stripe"
- `common.viewOnly` — EN: "View only" — PT-BR: "Somente visualização"
- `common.adminOnlyAction` — EN: "Admin only" — PT-BR: "Somente administrador"

(`common.*` goes into the `shared` context i18n; if that context doesn't have an i18n file, add to each of the four individually under a local namespace.)

## Acceptance Criteria
- [ ] All four pages render successfully for a member session (no 403, no redirect)
- [ ] Zero mutation controls visible on any of the four pages when rendered as member
- [ ] "Manage billing in Stripe" button renders for both roles on `/dashboard/billing`
- [ ] Settings inputs are `disabled` for members; no Save button
- [ ] i18n keys present in en.json and pt-br.json with matching structure
- [ ] No hardcoded English strings in the touched files (use `useTranslations`)
- [ ] `pnpm exec biome check apps/dashboard/src/contexts/{billing,settings,team,integrations}/` — green
- [ ] `pnpm turbo check-types` — green

## Return Summary
- Files changed with line counts
- List of mutation controls gated per page (name them explicitly so reviewer can verify)
- i18n keys added
- Any components you could not locate / deviations
