# Website Codebase Simplification

## Context (The Why)
`apps/website` (~9,000 lines, 97 files) has accumulated code duplication, oversized files, dead code, unnecessary client bundles, and missed reuse opportunities. Full three-dimensional review (reuse, quality, efficiency) identified 30+ actionable findings.

## Definition (The What)
Systematically simplify the website codebase: remove dead code, extract shared utilities, reduce file sizes, fix quality issues, remove unnecessary `'use client'` directives, and consolidate duplicated patterns.

## Acceptance Criteria (The How to Test)
- [ ] All tests pass (`pnpm turbo test --filter=website`)
- [ ] Build succeeds (`pnpm turbo build --filter=website`)
- [ ] Lint passes (`pnpm exec biome check apps/website/`)
- [ ] Type check passes (`pnpm turbo check-types --filter=website`)
- [ ] Dev server starts without errors
- [ ] No regression in existing functionality
- [ ] No new `'use client'` directives added; several removed

## Restrictions (The Boundaries)
- No new features — simplification and deduplication only
- No changes to external APIs or user-facing behavior
- Preserve all existing test coverage
- Don't consolidate utilities to packages unless they're already duplicated cross-app

---

## Phase 1: Dead Code & Trivial Cleanup

- [x] **Delete `apps/website/src/app/staging-auth/staging-auth-form.tsx`** — exact duplicate of `contexts/shell/presentation/components/staging-auth-form.tsx`, never imported by anything
- [x] **Delete `IntegrationItem` type** from `contexts/marketing/domain/types.ts` (line 24) — dead code, website imports `Integration` from `@causeflow/shared` instead
- [x] **Delete duplicate `FAQItem` type** from `contexts/marketing/domain/types.ts` — identical to `@causeflow/shared` version, re-export from `@causeflow/shared` instead
- [x] **Remove unused SEO utils** from `packages/shared/src/application/utils/seo.ts` (`generateCanonicalUrl`, `generatePageTitle`) — website uses its own `metadata.ts`; verify zero imports then delete

---

## Phase 2: Extract Shared Utilities to Packages

### `deepMerge` → `@causeflow/shared` (duplicated in both apps)
- [x] Create `packages/shared/src/domain/utils/deep-merge.ts` with the `deepMerge` function and `DeepPartial` type
- [x] Export from `packages/shared` index
- [x] Update `apps/website/src/lib/i18n/compose.ts` to import from `@causeflow/shared`
- [x] Delete local `deepMerge` implementation from compose.ts

### Navigation Constants — Use `@causeflow/shared`
- [x] Audit `HEADER_NAV_ITEMS` and `FOOTER_PRODUCT_LINKS` — SKIPPED: i18n structural mismatch (shared uses plain strings, website uses `t()` key derivation with `.toLowerCase()`, footer uses `labelKey` i18n paths). Forcing shared constants would create a worse abstraction than the current duplication.
- [x] ~~Update header.tsx~~ — skipped (see above)
- [x] ~~Update footer.tsx~~ — skipped (see above)
- [x] ~~Verify i18n compatibility~~ — analyzed, incompatible

---

## Phase 3: Code Reuse — Internal Deduplication

### Batch 3A: `fireConfetti` Hook Extraction (3 files → 1 hook)
- [x] Create `contexts/engagement/presentation/hooks/use-confetti.ts` extracting the shared `useCallback` + confetti logic
- [x] Update `contact-modal.tsx` to use `useConfetti()` hook
- [x] Update `dashboard-demo-modal.tsx` to use `useConfetti()` hook
- [x] Update `coming-soon-overlay.tsx` to use `useConfetti()` hook
- [x] Delete inline `fireConfetti` implementations from all three files

### Batch 3B: Form Validation & State Deduplication (2 files → 1 hook)
- [x] Create `contexts/engagement/presentation/hooks/use-notify-form.ts` extracting shared `validateForm`, `INITIAL_DATA`, `FormStatus` type, form state, and submission logic
- [x] Update `contact-modal.tsx` to use `useNotifyForm()` hook
- [x] Update `dashboard-demo-modal.tsx` to use `useNotifyForm()` hook
- [x] Ensure both modals use `submitNotifyForm()` from `infrastructure/api-client.ts` instead of raw `fetch('/api/notify')`

### Batch 3C: `TOOLS` Array Consolidation (2 files → 1 constant)
- [x] Move `TOOLS` constant to `contexts/marketing/domain/constants.ts`
- [x] Update `investigation-dashboard-preview.tsx` to import shared `TOOLS`
- [x] Update `cross-reference-visualization.tsx` to import shared `TOOLS` (subset via `.slice(0, 6)`)

---

## Phase 4: Code Quality Fixes

### Stringly-Typed: Security Page Status Badge
- [x] Fix `security-page.tsx` — replaced `.includes('compliant')` string check with `isCompliant: boolean` field on each compliance item

### Legal Pages i18n Inconsistency
- [x] Audit `privacy-page.tsx` and `terms-page.tsx` — kept as-is. `useTranslations` provides real value (translated headers, metadata, section titles for PT-BR). Hardcoded English prose is intentional partial i18n for legal content. No change needed.

### Staging Auth Cross-Layer Violation
- [x] Moved server action to `contexts/shell/api/actions.ts`. Updated import in staging-auth-form.tsx. `app/staging-auth/actions.ts` now re-exports from context.

---

## Phase 5: Efficiency — Bundle Size Reduction

### Remove unnecessary `'use client'` directives (7+ components)
These are pure display components with no hooks, no event handlers, no browser APIs — only CSS-based hover effects:
- [x] Remove `'use client'` from `metric-card.tsx`
- [x] Remove `'use client'` from `feature-card.tsx`
- [x] Remove `'use client'` from `step-card.tsx`
- [x] Remove `'use client'` from `founder-card.tsx`
- [x] Remove `'use client'` from `security-commitment-card.tsx`
- [x] Remove `'use client'` from `usage-mode-card.tsx`
- [x] Remove `'use client'` from `timeline-item.tsx`
- [x] Remove `'use client'` from `comparison-table.tsx` — verified pure display, no interactivity

### Split Header into Server + Client Components
- [x] SKIPPED — Header uses `useTranslations('common')` from next-intl (sync client hook) + `useState` for mobile toggle. Cannot split without async `getTranslations` refactor. Not worth the complexity for this task.

---

## Phase 6: File Size Reduction

### `home-page.tsx` Simplification (767 → 452 lines, -41%)
- [x] **Dynamic imports**: Streamlined — `lazySection()` helper rejected by Next.js SWC (options must be object literal), kept typed inline calls (~30 lines saved)
- [x] **Logo data**: Converted `PRODUCT_LOGOS` and `TECH_LOGOS` to `LogoItem[]` data arrays + `buildLogoIcon()` mapper (~196 lines saved)
- [x] **SecurityCommitmentCards**: Converted to `SECURITY_COMMITMENT_KEYS` array + `.map()` with computed delays (~40 lines saved)
- [x] **Inline SVG icons**: Extracted to `USAGE_MODE_ICON_PATHS` record + `UsageModeIcon` component + `.map()` loop (~90 lines saved)

### `security-page.tsx` (608 → 347, -43%) & `product-page.tsx` (598 → 398, -33%)
- [x] Extracted `ArchitectureLayerBox` + `ArchitectureArrow` to shared `architecture-layer-box.tsx` (2 variants: security/product)
- [x] Converted product-page card grids to data arrays + `.map()` (phase1Steps, phase2Cards, phase3Cards)
- [x] Converted 6 `SecurityCommitmentCard` blocks to pillar groups × `.map()` with computed delays
- [x] Hover card classes — SKIPPED: pattern appears across 5 files but each has different card layout; abstraction cost exceeds benefit

---

## Phase 7: Validation & Compound

### Validation
- [x] Run `pnpm turbo build` — 7/7 tasks pass
- [x] Run `pnpm turbo test` — 718 tests pass (0 failures)
- [x] Run `pnpm exec biome check apps/website/` — 0 errors, 4 pre-existing warnings
- [x] Run `pnpm turbo check-types` — 14/14 tasks pass
- [x] Start website dev server — no errors, compiled successfully
- [x] Spot-check pages: /, /product, /security, /pricing, /about — all 200 OK

### Compound
- [x] Document learnings under `## Learnings` below
- [x] Update `session-learnings.md` with new rules
- [x] No new solution doc needed — patterns are specific to this codebase, not broadly reusable

---

## Parallelism Plan

```
Phase 1: Dead code cleanup (sequential — small, quick)
Phase 2: Package extractions (sequential — foundation)
Phase 3: Batches 3A, 3B, 3C can run in parallel (different files)
Phase 4: Quality fixes can run in parallel (different files)
Phase 5: Bundle size — card removals in parallel; Header split sequential
Phase 6: home-page.tsx and security/product pages can run in parallel
Phase 7: Validation (sequential — must be last)
```

---

## Summary of Impact

| Metric | Before | After (Estimated) |
|---|---|---|
| Duplicated functions | 5+ | 0 |
| Dead code files/types | 3 | 0 |
| Files > 600 lines | 3 | 0 |
| `home-page.tsx` | 767 lines | ~400 lines |
| `security-page.tsx` | 603 lines | ~350 lines |
| `product-page.tsx` | 598 lines | ~350 lines |
| Unnecessary `'use client'` | 8-9 components | 0 |
| Client JS bundle | current | reduced (pure display → server components) |

---

## Learnings

### What Worked
- **Parallel subagents** for independent batches (Phase 3C with 3A+3B, Phase 6A with 6B) cut wall-clock time significantly
- **Data array + `.map()` pattern** is the single highest-impact simplification: home-page -41%, security-page -43%, product-page -33%
- **Hook extraction** (useConfetti, useNotifyForm) effectively deduplicated form/interaction logic across modals
- **`'use client'` audit** found 8 pure-display components that were unnecessarily client-bundled

### What Didn't Work / Was Skipped
- **`lazySection()` dynamic import helper** — Next.js SWC requires `dynamic()` options to be object literals, not variable references. Cannot abstract this pattern.
- **Navigation constants from `@causeflow/shared`** — i18n structural mismatch (shared uses plain strings, website uses `t()` key derivation). Bad abstraction avoided.
- **Header server/client split** — `useTranslations` (next-intl sync hook) requires client context. Would need async `getTranslations` refactor, not worth complexity.
- **Hover card Tailwind preset** — Pattern appears across 5 files but each has different card layout; abstraction cost exceeds benefit.

### Rules Confirmed
- Next.js `dynamic()` options must be **object literals** — SWC static analysis rejects variable references
- `useTranslations` from next-intl locks a component tree as client — server alternative is async `getTranslations`
- Legal pages with partial i18n (translated headers + English prose) is intentional — don't remove the i18n, it provides real value for PT-BR metadata/headers

### Stats
- Files deleted: 3 (duplicate staging-auth-form, seo.ts, seo.test.ts)
- Files created: 7 (2 hooks, 1 constants, 1 deep-merge util, 1 shell action, 1 architecture-layer-box, 1 page-icons)
- `'use client'` removed from: 8 components
- Total line reduction: ~1,000+ lines across modified files
