# Batch 1: Quick Fixes (Settings Padding, Remove Nav Items, Fix Health Check)

These 3 tasks are independent and can run in parallel worktrees or sequentially.

## Context
- Task file: `docs/tasks/dashboard/build/2026-03-04_2100-dashboard-core-api-refactor.md`
- All changes are in the dashboard app under `apps/dashboard/`
- DDD structure: `src/contexts/<name>/presentation/components/`
- i18n: EN at `infrastructure/i18n/en.json`, PT-BR at `infrastructure/i18n/pt-br.json`
- Sidebar uses `useTranslations('dashboard')` → `t('sidebar.<key>')`

---

## Task A: Settings Page Padding Fix

### Problem
The settings page tab bar has no padding/gap separating it from the tab content below. The outer wrapper uses `space-y-6` but the `-mb-px` on the tab bar eats into the spacing.

### File
`apps/dashboard/src/contexts/settings/presentation/components/settings-page.tsx`

### Current Code (tab bar + content)
```tsx
return (
  <div className="space-y-6">
    {/* Tab navigation */}
    <div
      role="tablist"
      aria-label={t('title')}
      className="flex border-b border-border overflow-x-auto scrollbar-none -mb-px"
    >
      {/* tab buttons */}
    </div>

    {/* Tab panels rendered here - one per tab with conditional rendering */}
```

### Fix
Add `pt-6` (or `mt-6`) to the tab panel containers, OR wrap all tab panels in a `<div className="pt-6">`. The simplest approach: add a wrapper div around all the tab panels with padding-top.

### Implementation
1. Read the file
2. Find the closing `</div>` of the tablist div
3. After it, wrap all tab panels in `<div className="pt-6">...</div>`
4. OR alternatively, just change `space-y-6` to `space-y-8` and remove `-mb-px` if the border overlap isn't needed

### Verification
- Open `/dashboard/settings` in browser
- Switch between all tabs (Profile, Company, Notifications, Appearance, API Keys)
- Confirm visible spacing between tab bar underline and content

---

## Task B: Remove Remediations & Approvals from Sidebar

### Problem
"Remediations" and "Approvals" are standalone sidebar nav items with their own pages, but they should be part of incidents — not standalone screens.

### Files to Modify

**1. Sidebar navigation:**
`apps/dashboard/src/contexts/shared/presentation/components/layout/sidebar.tsx`

Current NAV_ITEMS (lines 37-47):
```ts
const navItems: NavItem[] = [
  { key: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'incidents', href: '/dashboard/incidents', icon: ShieldAlert },
  { key: 'remediations', href: '/dashboard/remediations', icon: Wrench },    // REMOVE
  { key: 'approvals', href: '/dashboard/approvals', icon: CheckCircle },      // REMOVE
  { key: 'audit', href: '/dashboard/audit', icon: ScrollText },
  { key: 'integrations', href: '/dashboard/integrations', icon: Plug },
  { key: 'team', href: '/dashboard/team', icon: Users },
  { key: 'billing', href: '/dashboard/billing', icon: CreditCard },
  { key: 'settings', href: '/dashboard/settings', icon: Settings },
];
```

Action: Remove the `remediations` and `approvals` entries. Also remove the `Wrench` and `CheckCircle` icon imports if they become unused.

**2. i18n keys — remove unused sidebar labels:**
- `apps/dashboard/src/contexts/shared/infrastructure/i18n/en.json` — remove `dashboard.sidebar.remediations` and `dashboard.sidebar.approvals` keys
- `apps/dashboard/src/contexts/shared/infrastructure/i18n/pt-br.json` — same

**3. Page routes — add redirects or remove:**
Check if these page files exist and handle them:
- `apps/dashboard/src/app/[locale]/dashboard/remediations/` — If standalone page exists, either delete it or redirect to `/dashboard/incidents`
- `apps/dashboard/src/app/[locale]/dashboard/approvals/` — Same

**4. DO NOT remove API routes:**
Keep these API routes intact (they're used by incident detail):
- `apps/dashboard/src/app/api/remediations/` — KEEP
- `apps/dashboard/src/app/api/approvals/` — KEEP

### Verification
- Sidebar should show: Overview, Incidents, Audit, Integrations, Team, Billing, Settings
- Navigating to `/dashboard/remediations` should redirect to `/dashboard/incidents` (or 404 if deleted)
- Incident detail page at `/dashboard/incidents/[id]` should still load remediations inline

---

## Task C: Fix Health Check Component Disappearing

### Problem
The dashboard overview loads a SystemStatus component with health check info that disappears when the screen finishes loading.

### Files

**Main overview:** `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx`

SystemStatus is rendered unconditionally (lines 65-68):
```tsx
<section aria-label="System status">
  <SystemStatus />
</section>
```

**SystemStatus component:** `apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx`
- Uses `getApiClient().healthDetailed()` on mount + every 60s interval
- Three states: loading (skeleton), error, success
- Should never fully disappear — always shows one of the three states

### Investigation Steps
1. Read `system-status.tsx` fully — check for any conditional return that could cause disappearing
2. Read `dashboard-overview.tsx` fully — check if the `<section>` wrapper has any conditional logic
3. Check if the issue is a client-side hydration mismatch (server renders nothing, client renders component)
4. Check if `getApiClient()` throws on the client side (it uses `process.env.EXTERNAL_API_URL` which is server-only)
5. Look for `'use client'` directive — if the overview is a server component but SystemStatus is a client component, there might be a hydration issue

### Likely Root Cause
The `getApiClient()` function reads `process.env.EXTERNAL_API_URL` which is a server-side env var. If `SystemStatus` is a client component that calls `getApiClient()` directly, the env var won't be available on the client, potentially causing an error that makes the component disappear or show error state briefly before unmounting.

Another possibility: The component uses `useState` for loading/data/error states. On initial server render it might render the skeleton, then on client hydration it re-runs and the health check fails (no API on client), showing an error state that looks like "disappearing."

### Fix Strategy
After investigation, likely fix is one of:
- Make the health check call go through a Next.js API route instead of calling getApiClient() directly from client
- OR add proper error/empty state that's clearly visible (not collapsing to 0 height)
- OR ensure the component has a minimum height so it doesn't visually disappear

### Verification
- Load `/dashboard` — SystemStatus should be visible during AND after loading
- Refresh the page — component should persist
- Check browser console for errors during load
