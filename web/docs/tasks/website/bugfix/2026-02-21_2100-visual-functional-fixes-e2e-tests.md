# Fix Visual/Functional Issues & Create Comprehensive E2E Tests

## Context

9 screenshots taken on Samsung Dex Chrome revealed multiple visual/functional issues on the CauseFlow AI website: washed-out architecture diagram colors, invisible CTA buttons on dark backgrounds, hero text overflow on mobile, poor slider/button styling, and weak animations. This task creates a comprehensive E2E test suite to catch these issues, then fixes them all.

## Root Causes Identified

1. **CTA buttons invisible on dark sections**: `variant="outline"` base includes `bg-background` (white in light mode). On `bg-slate-950` sections, custom classes partially override but buttons appear ghost/invisible.
2. **Architecture diagram washed out**: Uses Tailwind light-mode pastels (`bg-blue-50`, `bg-purple-50`, etc.) that are barely visible on white backgrounds. `dark:` variants never activate because site runs in light mode.
3. **Hero text overflow**: Long title text + `text-3xl` on mobile causes overflow/truncation on small viewports.
4. **Compare/VS page buttons**: Dark pill buttons with low contrast against dark backgrounds.
5. **Pricing slider**: Small dark rectangles, hard to interact with on touch devices.

---

## Phase 1: Create Comprehensive E2E Test Suite

**New file:** `tests/visual-functional.spec.ts`

### Navigation & Links
- [x] Test every desktop nav link navigates correctly (URL + `<main>` visible)
- [x] Test mobile hamburger opens Sheet, each link navigates, menu closes
- [x] Test header "Get Started Free" button navigates to `/get-started`
- [x] Test footer links navigate correctly
- [x] Test all CTA buttons on homepage navigate correctly

### Component Interactions
- [x] Test FAQ accordion on pricing page (click expands content)
- [x] Test ROI Calculator sliders and select update displayed values
- [x] Test language selector switches to PT-BR and back

### Visual Correctness
- [x] Verify hero CTA buttons have visible background (not transparent)
- [x] Verify architecture diagram layers have visible background colors
- [x] Verify CTA section buttons are visible on dark backgrounds
- [x] Take full-page screenshots of every page at every viewport

### Animations
- [x] Verify AnimateOnScroll elements get animation classes after scroll
- [x] Verify TypingAnimation text changes over time

---

## Phase 2: Fix Visual Issues

### 2.1 CTA Buttons on Dark Backgrounds (HIGH)
**Files:** `hero-section.tsx`, `cta-section.tsx`, `page.tsx` (homepage cross-tool section)
- [x] Replace `variant="outline"` on dark sections with explicit dark-compatible styling
- [x] Use `bg-transparent` class to override `bg-background` on outline buttons in dark sections
- [x] Verify all CTA buttons across all pages are visible

### 2.2 Architecture Diagram Colors (HIGH)
**File:** `apps/website/src/app/[locale]/product/page.tsx` (lines 338-519)
- [x] Strengthen layer background colors: `bg-blue-50` → `bg-blue-100`, borders `200` → `400`
- [x] Increase arrow opacity from `text-muted-foreground/50` → `text-muted-foreground`
- [x] Verify all 4 layers (blue, purple, amber, green) are visually distinct

### 2.3 Hero Text Overflow (MEDIUM)
**File:** `apps/website/src/components/sections/hero-section.tsx`
- [x] Reduce mobile font size from `text-3xl` to `text-2xl`
- [x] Add `break-words` safety class
- [x] Verify title renders fully on 375px viewport

### 2.4 Compare/VS Page Buttons (MEDIUM)
**Files:** `compare/page.tsx`, `vs/[competitor]/page.tsx`
- [x] Fix button contrast on dark backgrounds
- [x] Reduce excessive whitespace gaps

### 2.5 Pricing Calculator Slider (LOW)
**File:** `packages/ui/src/presentation/primitives/slider.tsx`
- [x] Increase slider thumb size from h-5 w-5 to h-6 w-6 for mobile touch targets
- [x] Verify slider interaction works in E2E test

---

## Phase 3: Run & Verify

- [x] Run `pnpm exec playwright test tests/visual-functional.spec.ts` — 47 passed, 5 skipped (viewport-appropriate), 0 failed
- [x] Run `pnpm exec playwright test tests/audit.spec.ts` — 80 passed, 0 failed
- [x] Review screenshots across all 4 viewports
- [x] Run `pnpm exec biome check .` — no lint errors
- [x] Run `pnpm turbo build` — build succeeds (33 static pages)

---

## Critical Files

| File | Action |
|------|--------|
| `tests/visual-functional.spec.ts` | CREATE |
| `apps/website/src/components/sections/hero-section.tsx` | EDIT |
| `apps/website/src/components/sections/cta-section.tsx` | EDIT |
| `apps/website/src/app/[locale]/product/page.tsx` | EDIT |
| `apps/website/src/app/[locale]/page.tsx` | EDIT |
| `apps/website/src/app/[locale]/compare/page.tsx` | EDIT |
| `apps/website/src/app/[locale]/vs/[competitor]/page.tsx` | EDIT |
| `packages/ui/src/presentation/primitives/slider.tsx` | EDIT |
