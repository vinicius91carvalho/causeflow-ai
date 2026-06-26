# Phase 9: Settings, Polish & Performance

## Phase 9.1: Research & Setup
- [x] Study existing settings page placeholder (`apps/dashboard/src/app/[locale]/dashboard/settings/page.tsx`)
- [x] Study existing theme system and language toggle in topbar
- [x] Study existing component patterns across all dashboard pages for consistency
- [x] Study the settings repository and API
- [x] Study the toast component from analyses feature (reuse opportunity)

## Phase 9.2: Settings Page — Profile Tab
- [x] Create `apps/dashboard/src/components/settings/settings-page.tsx` — tabbed layout with Profile, Company, Notifications, Appearance tabs
- [x] Create `apps/dashboard/src/components/settings/profile-tab.tsx`:
  - Name input (editable)
  - Email display (read-only, from session)
  - Avatar placeholder (initials-based, with future upload support)
  - "Change Password" section → link to forgot-password flow or inline form
  - "Save Changes" button
  - Form validation with Zod

## Phase 9.3: Settings Page — Company Tab (Admin Only)
- [x] Create `apps/dashboard/src/components/settings/company-tab.tsx`:
  - Company name input
  - Website URL input
  - Team size display
  - Current plan display with "Upgrade" link placeholder
  - Wrapped in RoleGuard (Admin only)
  - "Save Changes" button → PATCH to settings API

## Phase 9.4: Settings Page — Notifications Tab
- [x] Create `apps/dashboard/src/components/settings/notifications-tab.tsx`:
  - Toggle switches for email notifications:
    - Analysis complete notification
    - Credit warning notification (< 20%)
    - Team invite notification
    - Weekly digest
  - "Save Preferences" button → PATCH to settings API

## Phase 9.5: Settings Page — Appearance Tab
- [x] Create `apps/dashboard/src/components/settings/appearance-tab.tsx`:
  - Theme selector: Light / Dark / System (radio or toggle cards)
  - Language selector: English / Portuguese
  - Preview of current theme
  - Changes apply immediately (no save button needed)

## Phase 9.6: Assemble Settings Page
- [x] Rewrite `apps/dashboard/src/app/[locale]/dashboard/settings/page.tsx`:
  - Tab navigation (Profile, Company, Notifications, Appearance)
  - URL-based tab selection (e.g., ?tab=profile)
  - Responsive: tabs on top for mobile, sidebar tabs for desktop
  - Company tab hidden for Members

## Phase 9.7: Command Palette (Cmd+K)
- [x] Create `apps/dashboard/src/components/shared/command-palette.tsx`:
  - Triggered by Cmd+K / Ctrl+K keyboard shortcut
  - Overlay modal with search input
  - Quick actions: New Analysis, View Integrations, Team, Settings
  - Navigation: jump to any dashboard page
  - Search analyses by prompt text (client-side filter of recent)
  - Keyboard navigation: arrow keys, enter to select, escape to close
  - Fuzzy matching on action names
- [x] Register global keyboard listener for Cmd+K / Ctrl+K
- [x] Add Cmd+K hint to topbar search area

## Phase 9.8: Error Boundaries
- [x] Create `apps/dashboard/src/components/shared/error-boundary.tsx`:
  - Catches rendering errors in dashboard pages
  - Friendly error UI with illustration
  - "Try Again" button to reset error state
  - "Go to Dashboard" fallback link
  - Error details in dev mode
- [x] Add error boundary to dashboard layout (wraps main content area)

## Phase 9.9: Breadcrumbs
- [x] Create `apps/dashboard/src/components/shared/breadcrumbs.tsx`:
  - Auto-generates breadcrumbs from current route
  - Dashboard > Analyses > Analysis Detail
  - Dashboard > Integrations
  - Dashboard > Team
  - Dashboard > Settings
  - Clickable links for each level
- [x] Add breadcrumbs to topbar or below topbar in dashboard layout

## Phase 9.10: Global Toast System
- [x] Create `apps/dashboard/src/components/shared/toast-provider.tsx`:
  - Context-based toast system (useToast hook)
  - Toast types: success (green), error (red), info (blue), warning (amber)
  - Auto-dismiss after 5 seconds
  - Manual dismiss button
  - Stack multiple toasts
  - Position: bottom-right
- [x] Add ToastProvider to dashboard layout
- [x] Refactor analyses toast to use global toast system

## Phase 9.11: Mobile Polish
- [x] Audit all dashboard pages for mobile responsiveness
- [x] Ensure sidebar overlay works correctly on mobile
- [x] Verify touch targets are at least 44px
- [x] Test all modals/dialogs on mobile viewports

## Phase 9.12: i18n Messages
- [x] Add settings i18n messages to EN (dashboard.settings.* namespace):
  - Tab labels, profile form fields, company form fields
  - Notification toggle labels, appearance options
  - Command palette labels, breadcrumb labels
  - Error boundary text, toast messages
- [x] Add settings i18n messages to PT-BR (same namespace)

## Phase 9.13: Unit Tests
- [x] Write unit tests for settings tabs (profile, company, notifications, appearance)
- [x] Write unit tests for command palette (open/close, search, keyboard navigation)
- [x] Write unit tests for error boundary (catches errors, reset works)
- [x] Write unit tests for breadcrumbs (route mapping)
- [x] Write unit tests for toast provider (show, dismiss, auto-dismiss)

## Phase 9.14: E2E Tests
- [x] Create E2E test: settings page renders with tabs
- [x] Create E2E test: profile tab shows user info
- [x] Create E2E test: appearance tab changes theme
- [x] Create E2E test: breadcrumbs show on analyses pages
- [x] Create E2E test: error boundary catches and displays error

## Phase 9.15: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (1 pre-existing warning in auth.ts, not from our changes)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass (529 tests)
- [x] Verify settings page renders in light and dark mode
- [x] Verify responsive layout (mobile, tablet, desktop)
- [x] Remove unused code/imports
