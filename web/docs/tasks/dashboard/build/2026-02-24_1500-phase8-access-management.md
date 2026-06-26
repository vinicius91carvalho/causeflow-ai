# Phase 8: Access Management (RBAC)

## Phase 8.1: Research & Setup
- [x] Study existing team page placeholder (`apps/dashboard/src/app/[locale]/dashboard/team/page.tsx`)
- [x] Study the team API routes (`/api/team`, `/api/team/invite`, `/api/team/[userId]/role`)
- [x] Study the invite repository and user repository methods
- [x] Study the with-auth middleware for role checking capabilities
- [x] Study the auth session types for role field

## Phase 8.2: RBAC Permission System
- [x] Create `apps/dashboard/src/lib/rbac/permissions.ts`:
  - Define permission constants: MANAGE_TEAM, MANAGE_INTEGRATIONS, MANAGE_BILLING, SUBMIT_ANALYSIS, VIEW_ANALYSES, VIEW_INTEGRATIONS
  - Role-to-permission mapping: Admin (all), Member (submit analysis, view analyses, view integrations read-only)
  - `hasPermission(role, permission)` utility function
  - `requirePermission(role, permission)` — throws if not permitted
- [x] Create `apps/dashboard/src/lib/rbac/role-guard.tsx`:
  - Client-side `RoleGuard` component: conditionally renders children based on user role
  - `usePermission(permission)` hook for checking permissions in components
  - Uses session role from auth context
- [x] Update `apps/dashboard/src/lib/api/with-auth.ts`:
  - Add `withRole(role)` option to require specific role for API routes
  - Admin-only routes: team invite, change role, manage integrations (write), company settings
  - Return 403 Forbidden if role check fails

## Phase 8.3: Team Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/team/page.tsx`:
  - Page header with title and "Invite Member" button (Admin only)
  - Responsive layout
- [x] Create `apps/dashboard/src/components/team/team-members-table.tsx`:
  - Table/list of team members: avatar, name, email, role badge, last active, joined date
  - Admin actions column: change role dropdown, remove member button
  - Member view: read-only (no action buttons)
  - Responsive: table on desktop, card list on mobile
  - Loading skeleton state
  - Fetch from `/api/team`
- [x] Create `apps/dashboard/src/components/team/role-badge.tsx`:
  - Admin: purple/branded badge
  - Member: gray/neutral badge
- [x] Create `apps/dashboard/src/components/team/change-role-dialog.tsx`:
  - Modal/dialog for changing a team member's role
  - Dropdown: Admin / Member
  - Warning when demoting self from Admin
  - Confirm button → PATCH `/api/team/[userId]/role`
  - Cannot change own role if last Admin

## Phase 8.4: Invite System
- [x] Create `apps/dashboard/src/components/team/invite-modal.tsx`:
  - Email input with validation
  - Role selector (Admin / Member, default Member)
  - "Send Invite" button → POST `/api/team/invite`
  - Loading state during submission
  - Success message with invited email
  - Error handling (duplicate email, max team size)
- [x] Create `apps/dashboard/src/components/team/pending-invites.tsx`:
  - List of pending invites: email, role, invited by, sent date, expires date
  - Admin actions: resend invite, revoke invite
  - Expired invites shown with expired badge
  - Empty state when no pending invites
- [x] Create invite email trigger in API route:
  - POST `/api/team/invite` creates invite record in DB
  - In production: would trigger SES email via Lambda (mock for now)
  - Invite link format: `/auth/sign-up?invite=<token>&email=<email>`
  - Invite expires after 7 days
- [x] Create `apps/dashboard/src/components/team/remove-member-dialog.tsx`:
  - Confirmation dialog for removing a team member
  - Warning message
  - "Remove" and "Cancel" buttons
  - Cannot remove self

## Phase 8.5: Permission Guards in UI
- [x] Update integrations page: hide "Connect" and "Disconnect" buttons for Members (read-only view)
- [x] Update team page: hide "Invite" button and action columns for Members
- [x] Update settings page: hide Company tab for Members
- [x] Add "Admin" badge or indicator where admin-only actions exist
- [x] Ensure all protected actions show appropriate message for Members ("Contact your admin to...")

## Phase 8.6: Server-Side Role Enforcement
- [x] Update `/api/team/invite` — require Admin role
- [x] Update `/api/team/[userId]/role` — require Admin role
- [x] Update `/api/integrations` POST — require Admin role
- [x] Update `/api/integrations/[type]` DELETE — require Admin role
- [x] Verify `/api/analyses` POST — allow both Admin and Member
- [x] Verify `/api/analyses` GET — allow both Admin and Member

## Phase 8.7: i18n Messages
- [x] Add team/RBAC i18n messages to EN (dashboard.team.* namespace):
  - Page title, table headers, role labels
  - Invite modal: labels, placeholders, success/error messages
  - Change role dialog: labels, warnings
  - Remove member dialog: warning, confirm
  - Permission messages ("Only admins can...", "Contact your admin")
  - Pending invites section
- [x] Add team/RBAC i18n messages to PT-BR (same namespace)

## Phase 8.8: Unit Tests
- [x] Write unit tests for permissions utility (hasPermission, requirePermission)
- [x] Write unit tests for RoleGuard component (renders/hides based on role)
- [x] Write unit tests for usePermission hook
- [x] Write unit tests for team members table (admin vs member view)
- [x] Write unit tests for invite modal (validation, submit)
- [x] Write unit tests for change role dialog (role change, self-demotion warning)
- [x] Write unit tests for pending invites (resend, revoke, expired state)

## Phase 8.9: E2E Tests
- [x] Create E2E test: team page renders members table
- [x] Create E2E test: invite button visible for admin, hidden for member view
- [x] Create E2E test: role badges display correctly
- [x] Create E2E test: pending invites section renders
- [x] Create E2E test: responsive layout (table on desktop, cards on mobile)

## Phase 8.10: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (39 pre-existing warnings)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass (475 tests, 41 files)
- [x] Verify team page renders in light and dark mode
- [x] Verify responsive layout (mobile, tablet, desktop)
- [x] Remove unused code/imports
