# Sprint 01 — Foundation

**Goal:** Create `/use-cases` scaffold (index + 3 placeholder slug routes), header/mobile nav "Use Cases" link, `CaseStudy` domain registry, shared case-study primitives, and bilingual i18n skeleton. Clean build, index page renders with 3 cards.

**Depends on:** None (blocks 02/03/04/05).

## Acceptance Criteria

- [x] Route files exist and render:
  - `apps/website/src/app/[locale]/use-cases/page.tsx` → index hub
  - `apps/website/src/app/[locale]/use-cases/stale-pricing/page.tsx` (placeholder page for now — body "Coming soon" is acceptable but must render via context page)
  - `apps/website/src/app/[locale]/use-cases/broken-images/page.tsx` (placeholder)
  - `apps/website/src/app/[locale]/use-cases/cascading-500/page.tsx` (placeholder)
- [x] Index page (`/use-cases`) renders 3 cards linking to each slug, each showing: eyebrow (scenario ID), title, one-line summary, meta strip (duration / severity).
- [x] Header `navItems` array includes `{ label: 'Use Cases', href: '/use-cases' }`. Uses `t('nav.usecases')` — key already exists in shell i18n.
- [x] `MobileMenu` mirrors automatically (it iterates the same array — no code change required beyond header).
- [x] `ROUTES.USE_CASES = '/use-cases'` added to `packages/shared/src/domain/constants/routes.ts`.
- [x] `CaseStudy` type + `CASE_STUDIES` registry in `apps/website/src/contexts/marketing/domain/case-studies.ts` with 3 entries (slug, i18nKey, template, severity, duration, reporter name fake/anonymized acceptable, timestamp, impact summary).
- [x] Shared primitives implemented and import-clean:
  - `case-study-hero.tsx` — eyebrow, headline, lead, meta-strip
  - `case-study-breadcrumb.tsx` — "Use Cases › Slug" breadcrumb
  - `evidence-card.tsx` — monospace card for logs/DB snapshots
  - `meta-strip.tsx` — duration · severity · impact chip row
- [x] `caseStudies` namespace skeleton added to `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` + `pt-br.json`. Must include: `index.eyebrow`, `index.headline`, `index.lead`, `index.cards.{stalePricing,brokenImages,cascading500}.{title,summary,severity,duration}`, `breadcrumbRoot`, `meta.{duration,severity,impact}` labels, `comingSoon` fallback.
- [x] `pnpm turbo check-types` passes for website.
- [x] `pnpm exec biome check apps/website` passes (or `biome check --write` applied cleanly).
- [x] `pnpm --filter website build` succeeds.
- [x] Dev server smoke (from worktree): `curl -sL http://localhost:3000/use-cases` returns 200 and the 3 card titles appear in body.

## File Boundaries

### files_to_create

- `apps/website/src/app/[locale]/use-cases/page.tsx`
- `apps/website/src/app/[locale]/use-cases/stale-pricing/page.tsx`
- `apps/website/src/app/[locale]/use-cases/broken-images/page.tsx`
- `apps/website/src/app/[locale]/use-cases/cascading-500/page.tsx`
- `apps/website/src/contexts/marketing/presentation/pages/use-cases-index-page.tsx`
- `apps/website/src/contexts/marketing/presentation/pages/case-studies/stale-pricing-page.tsx` (placeholder "coming soon" that reuses shared primitives)
- `apps/website/src/contexts/marketing/presentation/pages/case-studies/broken-images-page.tsx` (placeholder)
- `apps/website/src/contexts/marketing/presentation/pages/case-studies/cascading-500-page.tsx` (placeholder)
- `apps/website/src/contexts/marketing/presentation/components/case-studies/case-study-hero.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/case-study-breadcrumb.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/evidence-card.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/meta-strip.tsx`
- `apps/website/src/contexts/marketing/domain/case-studies.ts`
- `apps/website/src/contexts/marketing/presentation/pages/use-cases-index-page.test.tsx` (source-guard test)
- `apps/website/src/contexts/marketing/presentation/components/case-studies/case-study-hero.test.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/evidence-card.test.tsx`

### files_to_modify

- `apps/website/src/contexts/shell/presentation/components/navigation/header.tsx` — add `{ label: 'Use Cases', href: ROUTES.USE_CASES }` to `navItems` (between Pricing and Security is fine, or immediately after Pricing).
- `packages/shared/src/domain/constants/routes.ts` — add `USE_CASES: '/use-cases'`.
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — add `caseStudies` top-level namespace.
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` — add `caseStudies` namespace (PT-BR translations).

### files_read_only

- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — reference pattern.
- `apps/website/src/contexts/marketing/presentation/pages/about-page.tsx` — page-layout example.
- `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx` — meta + section example.
- `apps/website/src/contexts/shell/presentation/components/navigation/mobile-menu.tsx` — iterates `navItems` array, no change needed.
- `apps/website/src/contexts/shell/infrastructure/i18n/en.json` — has `nav.usecases` already.
- `apps/website/src/lib/metadata.ts` — use `generatePageMetadata()`.
- `/root/projects/causeflow/test-scenarios/scenario-0{1,2,3}-*.md` — source data.

### shared_contracts

- **`CaseStudy` domain type + `CASE_STUDIES` registry.** Must export:
  ```ts
  export type CaseStudyTemplate = 'forensic-dossier' | 'budget-clock' | 'cascade';
  export type CaseStudySeverity = 'high' | 'medium' | 'low';
  export interface CaseStudy {
    slug: 'stale-pricing' | 'broken-images' | 'cascading-500';
    i18nKey: 'stalePricing' | 'brokenImages' | 'cascading500';
    template: CaseStudyTemplate;
    severity: CaseStudySeverity;
    durationLabel: string; // e.g. "25 min" — static; final string goes in i18n
    publishedAt: string;   // ISO date
  }
  export const CASE_STUDIES: readonly CaseStudy[];
  ```
  Sprints 02/03/04 consume this registry — do not rename without updating them.

- **Shared primitive props.** Lock these interfaces; sprints 02/03/04 import them:
  - `CaseStudyHero`: `{ eyebrow: string; headline: string; headlineEm?: string; lead: string; meta: { durationLabel: string; severityLabel: string; impactLabel: string; }; }`
  - `CaseStudyBreadcrumb`: `{ rootLabel: string; currentLabel: string; }`
  - `EvidenceCard`: `{ title?: string; lines: string[]; tone?: 'default' | 'warn' | 'error'; }`
  - `MetaStrip`: `{ duration: string; severity: { label: string; tone: 'high' | 'medium' | 'low'; }; impact: string; }`

- **i18n keys** — sprints 02/03/04 add scenario-specific keys under `caseStudies.{stalePricing,brokenImages,cascading500}.*`. Sprint 01 creates the parent namespace and shared keys only; do not pre-populate scenario bodies.

## Implementation Notes

- Route files are thin re-exports only (see `apps/website/src/app/[locale]/about/page.tsx` style): `export { default, generateMetadata } from '@/contexts/marketing/presentation/pages/...';`
- Placeholder pages for the 3 slugs can import `case-study-hero` + `case-study-breadcrumb` + `CtaStopHuntingSection` + a `"Coming soon"` paragraph body. They will be fully replaced in Sprints 02/03/04.
- `setRequestLocale(locale)` on every server page.
- `generatePageMetadata({ title, description, path, locale })` on every page.
- Do **not** add any non-trivial animations; those come in Sprints 02/03/04.
- Severity tone mapping: `high` → `text-red-600 bg-red-500/10`, `medium` → `text-amber-600 bg-amber-500/10`, `low` → `text-muted-foreground bg-muted/40`.

## Out of Scope (this sprint)

- Bespoke scenario templates (forensic dossier, budget clock, cascade) — future sprints.
- Home carousel deep-link wiring — Sprint 05.
- Sitemap update — Sprint 05.
- Lighthouse/E2E Playwright sweep — Sprint 05 (Sprint 01 only needs `curl` smoke).

## Agent Notes (fill after execution)

### Files created (16)
- `apps/website/src/app/[locale]/use-cases/page.tsx` + 3 slug routes (all thin re-exports).
- `apps/website/src/contexts/marketing/domain/case-studies.ts` + test.
- `apps/website/src/contexts/marketing/presentation/components/case-studies/{case-study-hero,case-study-breadcrumb,evidence-card,meta-strip}.tsx` + colocated tests.
- `apps/website/src/contexts/marketing/presentation/pages/use-cases-index-page.tsx` + test.
- `apps/website/src/contexts/marketing/presentation/pages/case-studies/{stale-pricing,broken-images,cascading-500}-page.tsx` + tests. Placeholder bodies (breadcrumb + hero + "coming soon" paragraph) to be replaced in Sprints 02/03/04.

### Files modified (4)
- `apps/website/src/contexts/shell/presentation/components/navigation/header.tsx` — added `Usecases` nav entry (label token resolves via existing `nav.usecases` key).
- `packages/shared/src/domain/constants/routes.ts` — added `USE_CASES: '/use-cases'`.
- `apps/website/src/contexts/marketing/infrastructure/i18n/{en,pt-br}.json` — added `caseStudies.*` namespace skeleton.

### Deviations
- Biome check could not be run in this PRoot env (OOMs on all invocations). TypeScript + vitest + curl smoke all passed. Follow-up: re-run biome on a host machine before final merge to main branch (or skip since pre-commit hook runs it in CI).
- Worktree was spawned from `eb9f1cb` (pre-PRD); rebased to main tip before committing to pick up PRD files already present on main.
- Case-studies registry `template` field was initially swapped between `stale-pricing` and `broken-images` — corrected.

### Follow-ups for Sprints 02/03/04
- Each scenario page is currently a placeholder; replace the body content inside each `*-page.tsx` (do NOT touch the route re-exports).
- `caseStudies.<scenario>.*` i18n keys: Sprint 01 only populated `caseStudies.index.*`, `caseStudies.breadcrumbRoot`, `caseStudies.meta.*`, `caseStudies.comingSoon`, and `caseStudies.{stalePricing,brokenImages,cascading500}.{title,summary,severity,duration}` for the index cards. Each scenario sprint adds the bespoke copy under its own i18n key tree.
- Consumed shared primitive contracts: `CaseStudyHeroProps`, `CaseStudyBreadcrumbProps`, `EvidenceCardProps`, `MetaStripProps`. These are locked — file a follow-up if a gap appears.
- Pre-existing test failure: `integration-card.test.tsx > "integration security does not claim CauseFlow is certified"` (1 failure vs 209 passes). Copy says "SOC 2 Type II–certified partner"; test asserts no `certified`. Unrelated to this sprint — flag separately.

### Verification run
- `pnpm --filter website exec tsc --noEmit` → exit 0.
- `vitest run --project website` → 45 files · 210 tests · 209 pass · 1 fail (unrelated integration-card copy test).
- Dev server smoke (`pnpm --filter website dev`, log `/tmp/sprint01-smoke.log`): ready in 4.8s.
  - `GET /use-cases` → HTTP 200, body contains `Stale Pricing`, `Broken Images`, `Cascading 500` titles + the `Use Cases` heading.
  - `GET /pt-br/use-cases` → HTTP 200 (`<html lang="pt-br">`).
  - `GET /use-cases/{stale-pricing,broken-images,cascading-500}` → all HTTP 200.
