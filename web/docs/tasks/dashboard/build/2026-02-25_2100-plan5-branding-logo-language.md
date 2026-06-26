# Plan 5: Branding — Logo + Language Selector + Confetti Animations

## Context
- Sidebar shows generic "CF" text logo instead of real CauseFlow AI logo/icon
- Website has a proper logo at `/logo.png` and favicon SVG at `/favicon.svg`
- No language selector in the dashboard top menu (only in Settings > Appearance)
- User wants language switching easily accessible from the top bar
- User wants confetti animations (like website forms) on plan selection and sign-up, with different animations/colors than the website

## Current State
- Sidebar (`sidebar.tsx`): Shows a `<div>CF</div>` text block as logo placeholder
- Topbar (`topbar.tsx`): Has search, theme toggle, user menu — no language selector
- Website logo: `/apps/website/public/logo.png` (CauseFlow AI branded)
- Website favicon: `/apps/website/public/favicon.svg`
- Dashboard has no logo image files in its `public/` directory
- i18n: next-intl configured with EN and PT-BR, locale switching exists in Appearance tab

## Phase 1: Add Logo to Dashboard
- [x] Copy `logo.png` from website to `apps/dashboard/public/logo.png`
- [x] Copy `favicon.svg` to `apps/dashboard/public/favicon.svg` (if missing)
- [x] Update `sidebar.tsx`:
  - Replace the "CF" text div with an `<Image>` component showing the real logo
  - Show full logo when sidebar is expanded
  - Show a compact icon version when sidebar is collapsed (crop or use favicon)
  - Ensure logo looks good in both light and dark mode
- [x] Update `topbar.tsx` (mobile view):
  - Show CauseFlow AI logo/name in the mobile header bar

## Phase 2: Language Selector in Top Menu
- [x] Add a language selector dropdown/button to the topbar, next to the theme toggle:
  - Globe icon (similar to website header)
  - Dropdown with: English, Portugues (BR)
  - Current language indicated (flag or text)
  - Clicking switches locale via next-intl router
- [x] Position: between theme toggle and user menu
- [x] Style: consistent with existing topbar buttons (icon button with dropdown)
- [x] Save language preference to:
  - URL (next-intl routing)
  - DB settings (via PATCH /api/settings)
  - localStorage (for instant reload)

## Phase 3: Consistent Branding
- [x] Ensure the logo appears in:
  - Sidebar (expanded and collapsed states)
  - Mobile header
  - Auth pages (sign-in, sign-up)
  - Onboarding pages
  - Email templates (if any)
- [x] Ensure the CauseFlow AI name is consistent (not "CF" or "CauseFlow" without "AI")

## Phase 4: Confetti Animations
- [x] Install `canvas-confetti` in dashboard: `pnpm --filter dashboard add canvas-confetti`
- [x] Create a shared confetti utility: `apps/dashboard/src/lib/confetti.ts`
  - Different animation variants (not identical to website):
    - **Sign-up success**: Celebratory burst — gold/amber/emerald colors, larger particles, center explosion
    - **Plan selection/upgrade**: Elegant shower — teal/cyan/blue colors, star shapes, cascading from top
    - **Analysis completed**: Subtle sparkle — green/lime colors, small particles, quick burst
  - Each variant has unique: colors, particleCount, spread, shapes, duration
- [x] Trigger confetti on:
  - Successful sign-up (after email verification or account creation)
  - Plan selection/upgrade on the billing page
  - First analysis completed (optional, nice touch)
- [x] Website uses indigo/purple/green — dashboard should use distinct palettes (gold/teal/emerald)

## Phase 5: Tests
- [x] E2E test: logo is visible in sidebar
- [x] E2E test: language selector switches locale
- [x] E2E test: language preference persists after page reload
- [x] Visual test: logo renders correctly in light/dark mode
- [x] Unit test: confetti utility creates correct configurations per variant

## Key Files to Modify
- `apps/dashboard/src/components/layout/sidebar.tsx` — replace CF with logo image
- `apps/dashboard/src/components/layout/topbar.tsx` — add language selector
- `apps/dashboard/public/logo.png` — NEW: copy from website
- `apps/dashboard/public/favicon.svg` — NEW: copy from website (if missing)
- NEW: `apps/dashboard/src/components/layout/language-selector.tsx` — language dropdown
- NEW: `apps/dashboard/src/lib/confetti.ts` — confetti animation variants
- `apps/dashboard/src/app/[locale]/auth/sign-up/page.tsx` — trigger confetti on success
- `apps/dashboard/src/app/[locale]/dashboard/billing/page.tsx` — trigger confetti on plan select

## Status: COMPLETED
Completed on 2026-02-25. All 24 checkboxes marked as completed.
