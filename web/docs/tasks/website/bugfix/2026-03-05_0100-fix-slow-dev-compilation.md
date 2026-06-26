# Fix Slow Dev Compilation After DDD Refactoring

## Context (The Why)
After refactoring the website to use DDD bounded contexts, `pnpm dev` page compilation became very slow. Each page takes significantly longer to compile because Webpack must parse entire context trees through barrel file imports.

## Acceptance Criteria (The How to Test)
- [ ] Dev server page compilation is noticeably faster
- [ ] No cross-context barrel imports remain (all imports use direct deep paths)
- [ ] `optimizePackageImports` covers internal packages
- [ ] All pages still render correctly after import changes

## Restrictions (The Boundaries)
- Do NOT change any component logic or functionality
- Do NOT restructure the context directories
- Only change import paths and next.config optimization settings

## Bug Report
- **Symptom:** `pnpm dev` page compilation is very slow after DDD refactoring
- **Expected:** Pages should compile in reasonable time
- **Root cause:** Barrel file imports (`index.ts`) cause Webpack to parse entire context trees. Components used on every page (Header, Footer, ContactCTA) import through top-level barrels, triggering full tree resolution on every single route.

## Phase 1: Reproduce & Isolate
- [x] Root cause identified: barrel file import explosions across bounded contexts
- [x] Worst offenders mapped (see below)

### Offenders (by impact)

**Every-page impact (Header/Footer/CTA on all routes):**
1. `shell/presentation/components/navigation/header.tsx` → `@/contexts/engagement` (for `DashboardDemoModal`)
2. `shell/presentation/components/navigation/mobile-menu.tsx` → `@/contexts/engagement` (for `DashboardDemoModal`)
3. `engagement/presentation/components/contact-cta-section.tsx` → `@/contexts/marketing` (for `CTASection`)
4. `marketing/presentation/components/sections/cta-section.tsx` → `@/contexts/shell` (for `CTAButtonClient`)
5. `marketing/presentation/components/sections/hero-section.tsx` → `@/contexts/shell` (for `CTAButtonClient`)

**Per-page impact (sections barrel in page files):**
6. All 6 marketing page files import from `marketing/presentation/components/sections/index.ts` (22 exports)

**Cross-context ContactModal imports:**
7. `deployment-approaches-section.tsx`, `pricing-interactive.tsx`, `security-hero-section.tsx`, `zero-knowledge-callout.tsx` → `@/contexts/engagement` (for `ContactModal`)

## Phase 2: Fix & Verify
- [x] Replace cross-context barrel imports with direct deep paths (items 1-5, 7)
- [x] Replace sections barrel imports with direct paths in page files (item 6)
- [x] Add `@causeflow/ui` and `@causeflow/shared` to `optimizePackageImports` in `next.config.mjs`

## Phase 4: Validation
- [x] Run `pnpm turbo build` — no build errors
- [x] Run `pnpm turbo lint` — 18 pre-existing warnings, no new issues
- [x] Start dev server and verify pages compile faster
- [x] Spot-check 3 pages render correctly (homepage, product, pricing)

## Phase 6: Compound
- [x] Document barrel import anti-pattern in session learnings
- [x] Update CLAUDE.md with import rule

## Learnings

1. **Barrel imports are dev compilation killers in Webpack.** Each `import { X } from '@/contexts/foo'` forces Webpack to parse every module in `foo/index.ts`'s re-export tree — even if only one symbol is used. In PRoot/arm64 with slow filesystem I/O, this compounds painfully.

2. **The worst offenders are components on every page.** Header and Footer components importing through barrel files multiply the cost by the number of routes — every page compilation re-parses the entire engagement/marketing context tree.

3. **`optimizePackageImports` helps for internal packages too.** Adding `@causeflow/ui` and `@causeflow/shared` to this Next.js experimental option prevents full barrel resolution for workspace packages.

4. **Initial DDD rule was wrong.** The "Cross-context imports MUST go through index.ts barrel" rule (from the DDD refactoring session) traded API cleanliness for dev performance. Direct deep paths are the correct approach — barrels are fine for production tree-shaking but kill dev DX.
