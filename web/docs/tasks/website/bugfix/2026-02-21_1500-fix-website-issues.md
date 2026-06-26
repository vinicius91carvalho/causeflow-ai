# Fix 8 Website Issues — Beautiful & Functional

## Phase 0: Create Task File
- [x] Create task file at `docs/tasks/website/bugfix/2026-02-21_1500-fix-website-issues.md`
- [x] Ask user for execution mode — **Autonomous** selected

## Phase 1: Research & Setup
- [x] Start dev server and browser-test all 8 issues to confirm reproduction
- [x] Diagnose PT-BR button runtime error via browser console

## Phase 2: Fix Critical CSS Animation System (Issues 4 + 5)
**Root cause**: `tailwindcss-animate` v1.0.7 uses Tailwind v3 JS plugin API, silently fails with Tailwind v4.
- [x] Replace `tailwindcss-animate` with `tw-animate-css` in `packages/ui/package.json`
- [x] Update `packages/ui/src/themes/entry.css`: change `@plugin "tailwindcss-animate"` to `@import "tw-animate-css"`
- [x] Run `pnpm install`
- [x] Verify ROI calculator sliders + select work (fixed by tw-animate-css migration)
- [x] Verify FAQ accordion expands/collapses (fixed by tw-animate-css migration)

**Files**: `packages/ui/package.json`, `packages/ui/src/themes/entry.css`

## Phase 3: Fix PT-BR Language Button (Issue 1)
- [x] Fix based on browser diagnosis — Button wasn't rendering due to tailwindcss-animate failure; fixed by Phase 2 tw-animate-css migration

**Files**: `apps/website/src/components/navigation/language-selector.tsx`, `apps/website/src/middleware.ts`, `apps/website/src/i18n/routing.ts`

## Phase 4: Fix Product Architecture Section — Dark Background (Issue 3)
**Must follow themes architecture** at `packages/ui/src/themes/original/`. All colors come from theme tokens, NOT hardcoded Tailwind colors.

- [x] Change architecture `SectionLayout` to `variant="dark"` in product page
- [x] Replace hardcoded light colors with theme token classes
- [x] If new semantic tokens are needed, add them to light.css, dark.css, and base.css
- [x] Update borders, badges, connecting line colors using theme tokens

**Files**: `apps/website/src/app/[locale]/product/page.tsx`, `packages/ui/src/themes/original/tokens/light.css`, `packages/ui/src/themes/original/tokens/dark.css`, `packages/ui/src/themes/shared/base.css`

## Phase 5: Fix "---" Separators (Issue 6)
- [x] Replace `---` with em-dash `—` in `packages/shared/src/domain/constants/integrations.ts` line 42
- [x] Replace `---` with em-dash `—` in `apps/website/src/app/[locale]/product/page.tsx` line 27

## Phase 6: Add Integration Icons (Issue 7)
- [x] Add icon prop to `IntegrationCard` component
- [x] Replace generic icons with colorful brand SVGs (devicon + SVGPorn sources, 17 SVGs in `public/icons/integrations/`)
- [x] Update integrations page and homepage carousel to use brand SVG icons

**Files**: `apps/website/src/components/sections/integration-card.tsx`, `apps/website/src/app/[locale]/integrations/page.tsx`, `packages/shared/src/domain/constants/integrations.ts`

## Phase 7: Design & Theme Overhaul (Issues 2 + 8) — `frontend-design` skill
**Goal**: Transform the site from generic AI-look to a distinctive, futuristic tech aesthetic.

### 7a: Typography — Replace Generic Fonts
- [x] Choose a bold display font + refined body font (Syne headings + Lexend body)
- [x] Update `packages/ui/src/themes/original/fonts/font-stacks.css` with new font declarations
- [x] Add font imports for chosen fonts (Google Fonts in entry.css)
- [x] Update theme definition fonts in `packages/ui/src/themes/index.ts`

### 7b: Color & Theme Tokens — Bold Palette
- [x] Redesign color tokens in `packages/ui/src/themes/original/tokens/light.css` (Deep Indigo + Electric Teal)
- [x] Redesign color tokens in `packages/ui/src/themes/original/tokens/dark.css`
- [x] Keep semantic variable names unchanged
- [x] Ensure all chart colors, accent, success, destructive colors are cohesive

### 7c: Animations — Rich Motion System
- [x] Add new keyframes to `packages/ui/src/themes/original/animations/keyframes.css` (9 new)
- [x] Add new `@utility` directives to `packages/ui/src/themes/original/animations/utilities.css` (9 new)
- [x] Update animation components if needed
- [x] Wrap key sections site-wide with `AnimateOnScroll` (homepage metrics, titles)
- [x] Add `CountUp` to metrics/numbers
- [x] Add hover micro-interactions to cards and buttons (MetricCard, SecurityCard, IntegrationCard, StepCard)

### 7d: Backgrounds & Visual Effects
- [x] Add gradient mesh / noise texture / geometric pattern backgrounds via theme CSS (atmospheric radial gradients)
- [x] Glass-morphism effects for cards
- [x] Gradient borders, subtle shadows, depth layers
- [x] Hero section: gradient text, atmospheric background effects (radial gradient blobs)
- [x] CTA section: atmospheric gradient background

### 7e: Homepage Fixes (Issue 2)
- [x] Fix dark/invisible icons above "Investigation Dashboard Preview" (primary → accent)
- [x] Enhance tech logo carousel (icons + gradient edge masks)
- [x] Overall futuristic, app-like feel (atmospheric gradients, hover effects, distinct typography)

### 7f: Site-Wide Polish
- [x] Review every page for generic/AI aesthetics and replace with distinctive design
- [x] Ensure cohesive theme across all pages (replaced all hardcoded colors with theme tokens across security, vs/, get-started pages)

## Phase 8: Update CLAUDE.md
- [x] Add themes structure documentation to CLAUDE.md

## Phase 9: Tests
- [x] Write unit tests for ROI calculator (11 tests)
- [x] Write unit tests for FAQ accordion (5 tests)
- [x] Write integration tests for language selector (5 tests)
- [x] Write E2E tests covering all 8 fixes across viewports — 47/47 passed + 24/24 audit passed
- [x] Run full test suite — 56/56 passing

## Phase 10: Final Validation
- [x] Run `pnpm turbo build` — clean build
- [x] Run `pnpm turbo check-types` — no type errors
- [x] Run `pnpm exec biome check .` — no lint errors
- [x] Run all tests (Vitest) — 56/56 passing
- [x] Browser test all 8 issues — 8/8 PASS via production server
- [x] Remove unused code/imports — Biome clean (153 files, 0 issues)
- [x] Security + performance check — SSG build, no exposed secrets, JS bundle ~102KB shared
