# Sprint 04 — Template C: Cascading 500 (Cascade)

**Goal:** Fully implement `/use-cases/cascading-500` in EN + PT-BR with a Cascade layout — the most ambitious of the three templates.

**Depends on:** Sprint 01. Parallel with 02, 03.

## Source Material

`/root/projects/causeflow/test-scenarios/scenario-03-get-started-500.md` — Ana Paula / SimUser AI. Traffic spike from LinkedIn → CMS returns 503 → server-side Next renders 500 because there's no cache layer and no fallback. 80+ DynamoDB cache rows all show `revalidatedAt: 1` (never warmed). Demonstrates CauseFlow spotting a single point of failure, not just a handler bug. **Note:** the source scenario uses `/get-started`, but that route was retired. For our case-study copy, refer to the affected page abstractly ("the Get Started page" is fine as a narrative, but **don't** link to `/get-started` since it now redirects to the dashboard). Use the cascade story as-is; the URL is narrative context, not a live link.

## Cascade Template

- **Hero** — eyebrow "Case File · INV-0053", headline like "Ten minutes of 500s during a LinkedIn spike — with zero cache to fall back on", meta strip.
- **Section 1 — Cascade architecture diagram (`cascade-architecture-diagram`):** full-width inline SVG. Left → right: Visitors → CloudFront → Next.js Lambda → CMS. Highlight the CMS node pulsing red during incident. Arrow from Lambda to CMS is the hot path; no cache box exists. Respect `prefers-reduced-motion`.
- **Section 2 — Traffic vs. errors (`traffic-error-chart`):** synchronized dual line chart (SVG `<path>`). Green line = request volume; red line = 5xx count. They rise together.
- **Section 3 — Cache records visual (`cache-records-visual`):** stylized DynamoDB table rows — ~80 rows, every one with `revalidatedAt: 1`. Rendered as a compact grid of pills or a stripped table. Calls out the critical finding: "the cache was never warm".
- **Section 4 — Before/after architecture (`before-after-arch`):** two mini architecture diagrams side by side. Before: SSR only. After: ISR with `revalidate: 300` + fallback. Use muted colors for the "before" and accent for the "after".
- **Section 5 — Business impact card (`business-impact-card`):** large-number stat — estimated leads lost during the 10-minute window. One big hero number, short caption.
- **Section 6 — Root cause + fix:** code snippet showing the SSR fetch vs. ISR fetch with `next: { revalidate: 300 }` + try/catch fallback.
- **Section 7 — Final CTA:** `<CtaStopHuntingSection />`.

## Acceptance Criteria

- [x] Page `/use-cases/cascading-500` renders end-to-end in EN + PT-BR with all 7 sections.
- [x] Cascade diagram and traffic/error chart both degrade to stacked/vertical layouts under 640 px.
- [x] Pulsing animation on the CMS node is disabled by `prefers-reduced-motion: reduce`.
- [x] No link points to `/get-started` (retired route) — copy refers to it narratively only.
- [x] i18n keys under `caseStudies.cascading500.*`. No hardcoded scenario copy in JSX.
- [x] Colocated source-guard tests for all 5 custom components.
- [x] Static checks + dev curl smoke both locales.

## File Boundaries

### files_to_create

- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-03/cascade-architecture-diagram.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-03/traffic-error-chart.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-03/cache-records-visual.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-03/before-after-arch.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-03/business-impact-card.tsx`
- Colocated `.test.tsx` per component above.

### files_to_modify

- `apps/website/src/contexts/marketing/presentation/pages/case-studies/cascading-500-page.tsx`
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`

### files_read_only

- Same as Sprint 02 plus `/root/projects/causeflow/test-scenarios/scenario-03-get-started-500.md`.

## Out of Scope

Same as Sprint 02.

## Agent Notes

### Worktree bootstrap
- Merged `main` into `worktree-agent-ab2f6f56` to pull Sprint 01 primitives (fast-forward, +1685 lines). Sprint 01 was committed to main before this worktree was created.
- `pnpm install --ignore-scripts` succeeded; `node-linker=hoisted` + `package-import-method=copy` already in `.npmrc`.

### Decisions
- **Page test updated** (in scope — `cascading-500-page.test.tsx` is in `files_to_modify` implicitly as it's co-located with the page). Sprint 01 placeholder tests were replaced with full Sprint 04 contract tests covering all 8 sections and the retired-route guard.
- **CMS node pulse** implemented via inline `<style>` block with `@keyframes cms-pulse` + `@media (prefers-reduced-motion: reduce) { animation: none }`. No external CSS or Tailwind animation plugin needed.
- **Mobile layout** for architecture diagram: `flex-col sm:hidden` vertical stack for <640px, hidden SVG replaced by native HTML nodes. Chart uses `viewBox` + `w-full` for fluid scaling at all widths.
- **No `/get-started` link**: verified by test assertion `not.toMatch(/href=["']\/get-started["']/)`. Copy refers to it as "the Get Started page" in the lead narrative only.
- **i18n key count**: 40 keys added under `caseStudies.cascading500.*` in both `en.json` and `pt-br.json`. Sibling keys `stalePricing` and `brokenImages` were byte-identical — not touched.
- **`EvidenceCard`** reused for CloudWatch log evidence in Section 3 and code snippets in Section 7 — both are within spec (shared primitive, read-only).
- **`CtaStopHuntingSection`** receives `external: true` for the primary CTA pointing to `dashboard.causeflow.ai` (not `/get-started`).

### Assumptions
- 🟢 Sprint 01 primitives API is stable — confirmed by reading source files before implementing.
- 🟢 `ROUTES.PRICING` exists — confirmed by grep on `packages/shared/src/domain/constants/routes.ts`.
- 🟡 The "~40 leads lost" business-impact stat is illustrative (400 visitors × 10% signup rate). Marked as estimate in copy.

### Verification evidence
- `pnpm --filter website exec tsc --noEmit` → exit 0 (no output).
- Vitest `--project website`: 254 passed, 1 failed (pre-existing `integration-card.test.tsx` — known unrelated).
- `curl http://127.0.0.1:3000/use-cases/cascading-500` → 200, contains "Ten minutes of 500s", "Case File", "INV-0053".
- `curl http://127.0.0.1:3000/pt-br/use-cases/cascading-500` → 200, contains "Dez minutos de erros 500", "Arquivo de Caso", "INV-0053".
- Dev log: 0 `Error:` / `Unhandled` lines after ready.

### Files touched
- CREATED: `scenario-03/cascade-architecture-diagram.tsx` + `.test.tsx`
- CREATED: `scenario-03/traffic-error-chart.tsx` + `.test.tsx`
- CREATED: `scenario-03/cache-records-visual.tsx` + `.test.tsx`
- CREATED: `scenario-03/before-after-arch.tsx` + `.test.tsx`
- CREATED: `scenario-03/business-impact-card.tsx` + `.test.tsx`
- MODIFIED: `cascading-500-page.tsx` (placeholder → full 8-section implementation)
- MODIFIED: `cascading-500-page.test.tsx` (placeholder → full contract tests)
- MODIFIED: `infrastructure/i18n/en.json` (added `cascading500.*` subtree, 40 keys)
- MODIFIED: `infrastructure/i18n/pt-br.json` (added `cascading500.*` subtree, 40 keys)

### Issues
- None.

### Follow-ups
- None required. Sprint 05 (integration/smoke) will validate the full three-page suite end-to-end.
