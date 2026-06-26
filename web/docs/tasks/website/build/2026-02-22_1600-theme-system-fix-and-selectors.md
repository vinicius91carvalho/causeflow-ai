# Fix Theme System & Add Theme/Dark Mode Selectors

## Root Cause Analysis

The theme system is broken because:
1. **ThemeProvider is not integrated** in the website layout (`apps/website/src/app/[locale]/layout.tsx`) — `data-theme` attribute never gets set on `<html>`
2. **Original theme uses `:root`/`.dark`** instead of `[data-theme="original"]` selectors — causes specificity conflicts where `:root` always wins over `[data-theme="other-theme"]`
3. **No UI** to switch themes or toggle dark/light mode
4. **`config.json` is unused** — nothing reads it at runtime

## Phase 1: Fix the Theme Foundation
- [x] Fix `original/tokens/light.css` — change `:root` to `[data-theme="original"]` (keep `:root` as fallback too)
- [x] Fix `original/tokens/dark.css` — change `.dark` to `[data-theme="original"].dark` (keep `.dark` as fallback too)
- [x] Fix `original/fonts/font-stacks.css` — scope selectors under `[data-theme="original"]`
- [x] Integrate `ThemeProvider` into `apps/website/src/app/[locale]/layout.tsx`
- [x] Add hydration-safe inline script to prevent FOUC (flash of unstyled content)

## Phase 2: Build Theme Selector (dev-only)
- [x] Create `DevThemeSwitcher` component in `packages/ui/src/themes/`
- [x] Theme dropdown: lists all 5 themes from the registry
- [x] Dark/Light/System toggle
- [x] Only renders when `NODE_ENV === 'development'`
- [x] Positioned in navbar, visually distinct as a dev tool
- [x] Integrate into website header component

## Phase 3: Build & Verify
- [x] Run `pnpm turbo build` — ensure no build errors
- [x] Start dev server and manually verify theme switching works
- [x] Verify dark mode toggle works
- [x] Verify theme persistence across page reloads (localStorage)

## Phase 4: Playwright Testing
- [x] Write Playwright tests for theme switching
- [x] Write Playwright tests for dark/light mode toggle
- [x] Run Playwright tests — fix any failures (68/68 passing on all 4 viewports)
