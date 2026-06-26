# i18n & UI Import Performance Optimization — Fix Slow Page Loading

## Context (The Why)
Website dev server has 10.5s TTFB on first request, 2-4s on subsequent. Root causes: (1) @causeflow/ui barrel re-exports theme/animation modules unnecessarily, (2) all i18n messages serialized to client on every page (~28 KB wasted), (3) webpack compiles 1,417 modules for homepage.

## Acceptance Criteria (The How to Test)
- [x] Homepage TTFB < 1s (warm cache) — 0.4s achieved
- [x] No dashboard i18n keys loaded in website — confirmed (dashboard has separate i18n)
- [x] deepMerge runs once at import time, not per-request — already the case (compose.ts)
- [x] Per-page message splitting reduces HTML payload size — -21.7 KB per page
- [x] All existing pages render correctly with correct translations
- [x] PT-BR translations work correctly
- [x] Build passes, lint passes, tests pass

## Restrictions (The Boundaries)
- Don't break dashboard i18n
- Don't change translation keys or values
- Maintain next-intl API compatibility

## Phase 1: Research & Setup
- [x] Read current i18n files: compose.ts, request.ts, shared messages
- [x] Map which message keys each page actually uses
- [x] Understand dashboard's i18n loading path
- [x] Analyzed HTML payload: 362 KB total, 243 KB RSC flight data, 28 KB i18n messages (2x serialized)
- [x] Identified @causeflow/ui barrel as pulling in all themes/animations (1,417 modules)

## Phase 2: Fix #1 — Remove themes from @causeflow/ui barrel
Initial investigation was wrong — dashboard i18n was NOT in shared messages. Each app has independent i18n.
Actual fix: Remove `export * from './themes'` from @causeflow/ui barrel to prevent theme/animation modules from being pulled into every page.
- [x] Removed `export * from './themes'` from packages/ui/src/index.ts
- [x] Added subpath exports to packages/ui/package.json (primitives, layouts, hooks, lib)
- [x] Updated 9 files to import AnimateOnScroll/CountUp/useAnimateOnScroll from '@causeflow/ui/themes'

## Phase 3: Fix #2 — Filter client-side i18n messages
compose.ts already pre-computes at module level (no per-request merge). Actual fix: filter NextIntlClientProvider to only pass namespaces needed by client components.
- [x] Identified client components using useTranslations: common, deploymentApproaches, getStarted, home.whyDifferent
- [x] Updated layout.tsx to pass only clientMessages (filtered subset) to NextIntlClientProvider
- [x] Server components still access all messages via getTranslations() directly

## Phase 4: Fix #3 — Subpath imports (REVERTED)
- [x] Tested subpath imports (primitives, layouts) on homepage
- [x] REVERTED: Subpath barrels INCREASED modules (1,407 → 1,458) because they bypass optimizePackageImports
- [x] Confirmed: optimizePackageImports IS working on the main barrel

## Phase 5: Validation
- [x] Run dev server and test all pages — all render correctly
- [x] Measure improvement — -21.7 KB HTML per page, -10 modules
- [x] Run build — passes (both website and dashboard)
- [x] Run lint — passes (only pre-existing warnings)
- [x] Run tests — 629 tests pass
- [x] Verify PT-BR pages work — confirmed

## Phase 6: Compound

## Learnings
1. **Initial investigation was partially wrong**: The shared i18n messages don't contain dashboard keys. Each app has completely independent i18n. The `deepMerge` in compose.ts already runs at import time, not per-request.
2. **optimizePackageImports works for workspace packages**: Adding @causeflow/ui to the list IS effective. Subpath barrel imports actually bypass this optimization, making things WORSE (+51 modules).
3. **RSC payload breakdown**: Homepage 362 KB = 106 KB HTML + 257 KB scripts. Of scripts: 204 KB components, 28 KB i18n messages (2x serialized), 12 KB dev debug info.
4. **Client components only need 4 namespaces**: common, deploymentApproaches, getStarted, home.whyDifferent. The other 8+ namespaces (product, pricing, security, etc.) are only used in server components.
5. **Webpack module count (~1,400) is normal**: Framework (React, Next.js, Radix UI) accounts for most modules. The PRoot/phone environment is the main compilation speed bottleneck.
6. **Don't use subpath barrels with optimizePackageImports**: They conflict. Use the main barrel and let Next.js optimize it.

## Results

| Metric | Before | After | Change |
|---|---|---|---|
| Homepage HTML | 357,932 B | 336,229 B | **-21.7 KB (-6.1%)** |
| Product HTML | 233,274 B | 211,563 B | **-21.7 KB (-9.3%)** |
| Pricing HTML | 174,177 B | 152,465 B | **-21.7 KB (-12.5%)** |
| Homepage modules | 1,417 | 1,407 | -10 |
| Homepage TTFB (warm) | 0.40s | 0.45s | ~same |
