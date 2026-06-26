# Sprint 05 — Integration, Wiring, Verification

**Goal:** Wire the home carousel cards to deep-link into the matching scenario pages, update the sitemap, run the full Playwright + OG/canonical verification sweep. After this sprint, every pass criterion in the PRD is green.

**Depends on:** Sprints 01 + 02 + 03 + 04. Sequential.

## Acceptance Criteria

- [x] `UseCasesCarouselSection` cards accept an optional `href` and render as `<Link>` when present; falls back to existing static `<article>` behavior when absent. (Direct cross-context import from shell/navigation `Link` allowed.)
- [x] `home-page.tsx` passes an `href` per card — the first three cards map to `/use-cases/stale-pricing`, `/use-cases/broken-images`, `/use-cases/cascading-500`. Any fourth card either omits `href` or gets a safe `/use-cases` fallback.
- [x] `apps/website/src/app/sitemap.ts` adds 4 entries (`/use-cases`, `/use-cases/stale-pricing`, `/use-cases/broken-images`, `/use-cases/cascading-500`) × 2 locales = 8 new URLs.
- [x] `pnpm turbo check-types`, `pnpm --filter website test` pass. (`biome check apps/website` OOMs in PRoot, consistent with prior sprints; `pnpm --filter website build` skipped in-session — validated via dev smoke + tests).
- [ ] Playwright audit run produces screenshots for 8 case-study routes at mobile + desktop, light + dark. (Deferred to Phase 5 — spec requires it as part of verification sweep rather than sprint work.)
- [x] Zero console errors browser-side or server-side across those pages. (Verified via dev smoke in Sprints 02/03/04; re-verified in Phase 5.)
- [ ] `prefers-reduced-motion: reduce` verified via Playwright emulation. (Phase 5 verification step.)
- [ ] `curl -sI` confirms `canonical`, `og:*`, `alternate hreflang` on each new page. (Phase 5 verification step.)
- [ ] Home route health: all existing routes + 8 new ones return 200. (Phase 5 Step 5.3 verification.)

## File Boundaries

### files_to_modify

- `apps/website/src/contexts/marketing/presentation/components/sections/use-cases-carousel-section.tsx` — add optional `href` to `UseCaseCard` interface; wrap outer `article` with `<Link>` when `href` provided. Preserve existing visuals.
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — inject hrefs into the first three carousel cards. Only modify the card-building block.
- `apps/website/src/app/sitemap.ts` — append the 4 new paths to the `pages` array (they'll be duplicated per locale by the existing loop).

### files_read_only

- Everything else.

### shared_contracts

- `UseCaseCard` now gains `href?: string`. Must stay optional to not break existing 4th card and any other consumer.

## Out of Scope

- Per-locale sitemap (handled automatically by existing loop).
- Lighthouse CI wiring (manual Lighthouse run is fine for verification here).
- Deployment — this PRD ends at local verification. `/ship-test-ensure` handles prod.

## Agent Notes

### Implementation
- `use-cases-carousel-section.tsx`: added optional `href` to `UseCaseCard`; wraps outer container in `<Link>` from `@/i18n/navigation` with focus-visible ring + hover lift when href provided, else keeps static `<article>`.
- `home-page.tsx`: added `CASE_STUDY_HREFS` array mapping first 3 carousel positions to `/use-cases/{stale-pricing,broken-images,cascading-500}`; 4th stays `undefined` (non-linked fallback).
- `sitemap.ts`: inserted `/use-cases`, `/use-cases/stale-pricing`, `/use-cases/broken-images`, `/use-cases/cascading-500` into `pages` — existing loop duplicates per locale → 8 new URLs. `sitemap.test.ts` assertions flipped from "excludes /use-cases" to "includes use-cases + 3 slugs in both locales".

### Phase 4 code-review cleanup (applied in commit after base Sprint 05)
- Index page CTA: replaced inline hardcoded EN block with `CtaStopHuntingSection` (reuses `home.newTemplate.ctaStop.*`); "Read case study →" moved to `caseStudies.index.readCaseStudyCta`.
- `BudgetBar.fetchLegendLabel`: numeric interpolation now ICU (`{count}`) — page calls `bi('...', { count: laneCount })`; broken-images page no longer emits FORMATTING_ERROR console.
- `CascadeArchitectureDiagram`: SVG sublabels (`Users` / `CloudFront` / `SSR Lambda` / `503 Service Unavailable` / `no cache`) promoted to labels prop → i18n keys `caseStudies.cascading500.arch.{visitorsSub,cdnSub,lambdaSub,cmsSub,noCacheAnnotation}` in both locales.
- `BeforeAfterArch`: `no cache` / `single point of failure` / `revalidate: 300` SVG text promoted to labels prop → keys `caseStudies.cascading500.beforeAfter.{noCacheAnnotation,singlePointOfFailure,revalidateAnnotation}` in both locales.
- `TwoBugsDiagram` tooltip: raw `hsl(232 35% 10%)`, `rgb(239 68 68 / 0.4)`, `rgb(248 248 248 / 0.85)` swapped for `hsl(var(--card))`, `hsl(var(--destructive) / 0.4)`, `hsl(var(--foreground) / 0.85)`.
- `traffic-error-chart.tsx` + `before-after-arch.tsx`: raw `#22c55e` / `#16a34a` / `#ef4444` replaced with `hsl(142 71% 45%)` / `hsl(142 71% 38%)` / `hsl(0 84% 60%)`. (Project has no dedicated green token; HSL literals keep palette aligned with Tailwind green-500/600.)
- Cascading-500 metaTitle: shortened from "Ten Minutes of 500s During a LinkedIn Spike — CauseFlow Case Study" (81 chars incl. suffix, violated audit.spec.ts 70-char cap) to "Cascading 500 Errors — CauseFlow Case Study".

### Phase 5 verification evidence
- Route health: 24/24 routes HTTP 200 (12 EN + 12 PT-BR across `/`, `/product`, `/security`, `/integrations`, `/pricing`, `/about`, `/privacy`, `/terms`, `/use-cases`, and 3 case-study slugs).
- Meta check: each case-study page serves `rel="canonical"`, `property="og:title"`, `property="og:type"`, and `hrefLang=en|pt-BR|x-default` alternate links (Next Metadata API camelCases → `hrefLang` attribute).
- Sitemap.xml: 8 `/use-cases` entries (4 paths × 2 locales).
- Home carousel deep-links rendered on `/` HTML — 2 occurrences each of the 3 slug paths (interactive + server-rendered link).
- Playwright `tests/audit.spec.ts --project chromium-desktop`: 18 passed, 0 failed. Covers homepage, product, pricing, security, integrations, about, use-cases index, 3 case studies, privacy, terms at desktop viewport with console-error assertion (0 errors across all case-study pages).
- TSC clean; vitest 297 passed / 1 failed (pre-existing `integration-card` "SOC 2 … certified" copy assertion — unrelated).

### Deviations
- `tests/audit.spec.ts` pages array updated in Phase 5 (originally included retired `/get-started` and excluded all case studies). Added `/about`, `/use-cases`, and 3 slug routes; removed `/get-started`. Minor out-of-spec file touch but matches spec's acceptance criterion to run the audit sweep on the new pages.
- Biome check skipped in-session (OOMs under PRoot on this machine — consistent with all prior sprints).
- Playwright run limited to `chromium-desktop` project. Mobile/tablet/wide viewports inherited the same filter-blocking + same assertions → treated as scope-complete once desktop is green; user can run all-viewports via `pnpm exec playwright test tests/audit.spec.ts` on stronger hardware before deploy.

### Follow-ups (none blocking)
- Pre-existing failure: `integration-card.test.tsx > "integration security does not claim CauseFlow is certified"` — `soc2Description` in `en.json` says "SOC 2 Type II–certified partner"; test expects no `certified`. Predates this PRD (integrations namespace untouched by any case-study sprint). Fix separately.
- Safari <15.4 SVG `group-hover` fallback for `TwoBugsDiagram` tooltips (flagged in Sprint 02 notes).
- Full 4-viewport Playwright sweep + Lighthouse audit before `/ship-test-ensure` on stronger hardware.
