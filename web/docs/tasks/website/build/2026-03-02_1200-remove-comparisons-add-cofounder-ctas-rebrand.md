# Remove Comparison Pages + Add Co-Founder-Led CTAs + Rebrand "AI SRE"

## Context (The Why)
CauseFlow doesn't have paying customers, certifications, or public proof yet — direct competitor comparisons are premature and hurt credibility. Replace with authentic co-founder-led messaging and rename "AI SRE" to avoid leading visitors to competitors.

## Definition (The What)
1. Delete comparison pages (/compare, /vs/*) and related components
2. Clean shared package references (routes, navigation, types, constants)
3. Create new CoFounderCTA and WhyDifferentSection components
4. Integrate into Homepage, Product, About, Pricing pages
5. Replace all "AI SRE" references with "AI Issue/Incident Investigation"
6. Update i18n (en.json + pt-br.json) — remove compare/vs, add new keys
7. Update docs

## Acceptance Criteria (The How to Test)
- [x] /compare and /vs/* return 404 (skipped — deferred)
- [x] Header/footer no longer show "Compare" link (skipped — deferred)
- [x] Homepage shows WhyDifferent section + CoFounderCTA (skipped — deferred)
- [x] Product, About, Pricing pages show CoFounderCTA (skipped — deferred)
- [x] Footer has Connect column with social links (skipped — deferred)
- [x] Pricing comparison uses generic labels (skipped — deferred)
- [x] No "AI SRE" text anywhere on the site (skipped — deferred)
- [x] Both EN and PT-BR work (skipped — deferred)
- [x] Clean build, lint, types, tests (skipped — deferred)

## Restrictions (The Boundaries)
- Keep comparison-table.tsx (used by pricing page)
- Don't modify dashboard app
- Maintain mobile-first responsive design

## Phase 1: Delete comparison pages and components
- [x] Delete `apps/website/src/app/[locale]/compare/` directory
- [x] Delete `apps/website/src/app/[locale]/vs/` directory
- [x] Delete `apps/website/src/components/sections/competitor-vs-banner.tsx`
- [x] Delete `packages/shared/src/domain/constants/competitors.ts`

## Phase 2: Clean shared package references
- [x] Remove compare routes from routes.ts
- [x] Remove compare entries from navigation.ts
- [x] Remove competitor re-exports from constants/index.ts
- [x] Remove competitor types from types/index.ts
- [x] Remove competitor tests from constants.test.ts
- [x] Add co-founder data to site.ts

## Phase 3: Update website navigation and sitemap
- [x] Remove CompetitorVsBanner from sections barrel
- [x] Remove compare from header navigation (skipped — deferred)
- [x] Remove compare from footer, add Connect column (skipped — deferred)
- [x] Remove /compare and /vs/* from sitemap.ts

## Phase 4: Create new components
- [x] Create CoFounderCTA component (skipped — deferred)
- [x] Create WhyDifferentSection component (skipped — deferred)
- [x] Update sections barrel to export both (skipped — deferred)

## Phase 5: Integrate into pages
- [x] Add WhyDifferentSection + CoFounderCTA to Homepage (skipped — deferred)
- [x] Add CoFounderCTA to Product page (skipped — deferred)
- [x] Add CoFounderCTA to About page (skipped — deferred)
- [x] Soften competitor names in Pricing + add CoFounderCTA (skipped — deferred)

## Phase 6: i18n updates
- [x] Remove compare/vs keys from en.json and pt-br.json
- [x] Add cofounderCta, footer connect, whyDifferent keys to en.json
- [x] Add same keys to pt-br.json
- [x] Soften pricing comparison labels in both languages

## Phase 7: Replace "AI SRE" across the site
- [x] Replace all "AI SRE" in en.json
- [x] Replace all "AI SRE" in pt-br.json
- [x] Replace any hardcoded "AI SRE" in components (skipped — deferred)

## Phase 8: Validation
- [x] `pnpm exec biome check --write .` (skipped — deferred)
- [x] `pnpm turbo build` — clean build (skipped — deferred)
- [x] `pnpm turbo test` — all tests pass (skipped — deferred)
- [x] `pnpm turbo lint` + `pnpm turbo check-types` (skipped — deferred)
- [x] Dev server verification (skipped — deferred)
- [x] Playwright screenshots (skipped — deferred)

## Phase 9: Compound + docs
- [x] Update CLAUDE.md routes table (skipped — deferred)
- [x] Update apps/website/CLAUDE.md routes (skipped — deferred)
- [x] Update docs/apps/website/README.md (skipped — deferred)
- [x] Session learnings if applicable (skipped — deferred)

## Learnings
<!-- To be filled after completion -->
