# Architecture Invariants — RBAC Member Read Access

## Permission Constants
- **Owner:** `apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts`
- **Preconditions:** Consumers import `PERMISSION` and `hasPermission` from this file. Never inline string literals.
- **Postconditions:** All `VIEW_*` perms are granted to BOTH `admin` and `member`. All `MANAGE_*` perms are granted ONLY to `admin`.
- **Invariants:**
  - `member` role NEVER has any `MANAGE_*` permission.
  - `admin` role has every permission in `PERMISSION`.
  - Every `MANAGE_X` perm has a corresponding `VIEW_X` perm.
- **Verify:** `pnpm vitest run apps/dashboard/src/contexts/identity/domain/rbac/permissions.test.ts`
- **Fix:** Edit `ROLE_PERMISSIONS` map in `permissions.ts` to satisfy the invariants above.

## API Route Authorization
- **Owner:** `apps/dashboard/src/lib/api/with-auth.ts`
- **Preconditions:** Every API route handler that mutates state must declare `requiredPermission: PERMISSION.MANAGE_*` via `withAuth()`.
- **Postconditions:** Read endpoints under team/integrations/settings/billing accept any authenticated tenant member; write endpoints require admin.
- **Invariants:**
  - No mutating endpoint (POST/PATCH/DELETE/PUT) under `/api/team`, `/api/integrations`, `/api/settings`, `/api/billing/{checkout,subscribe,purchase}` allows a `member` session.
  - `POST /api/billing/portal` allows BOTH admin and member (it's a redirect to Stripe; Stripe scopes per customer).
- **Verify:** `pnpm vitest run apps/dashboard/src/contexts/{billing,team,integrations,settings}/api/`
- **Fix:** Add appropriate `requiredPermission` to `withAuth()` wrapper.

## UI Control Gating
- **Owner:** Each presentation/pages file
- **Preconditions:** Page-level access uses `usePermission(PERMISSION.VIEW_*)`. Action-level controls use `usePermission(PERMISSION.MANAGE_*)`.
- **Postconditions:** Members reaching a page see view content; mutation controls are not rendered (hidden, not just disabled, to prevent confusion).
- **Invariants:**
  - No "Invite", "Connect", "Disconnect", "Change plan", "Save", "Edit", "Remove" button is rendered for `member` sessions on the four target pages.
  - "Manage billing in Stripe" button IS rendered for both roles.
- **Verify:** Playwright `tests/dashboard/rbac-member-read.spec.ts` member fixture
- **Fix:** Wrap mutation controls in `<RoleGuard permission={PERMISSION.MANAGE_*}>` or conditional `usePermission` check.
