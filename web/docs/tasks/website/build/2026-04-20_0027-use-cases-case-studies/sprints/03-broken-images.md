# Sprint 03 — Template B: Broken Images (Budget Clock)

**Goal:** Fully implement `/use-cases/broken-images` in EN + PT-BR with a Budget Clock layout.

**Depends on:** Sprint 01. Parallel with 02, 04.

## Source Material

`/root/projects/causeflow/test-scenarios/scenario-02-imagens-quebradas.md` — Rodrigo Lima / SimUser AI, `/from-momentic` images broken during demo. 3.098 ms cold start consumed image-optimizer Lambda's 5000 ms budget, 3 concurrent `.webp` fetches all time out. CloudFront reports no anomaly. CDN hypothesis wrong; the ceiling is the Lambda budget.

## Budget Clock Template

- **Hero** — eyebrow "Case File · INV-0052", headline like "Eight minutes of broken images, and every demo screenshot was a 504", meta strip.
- **Section 1 — The budget (`budget-bar`):** horizontal bar, 5000 ms wide, segmented:
  - `0–3098 ms` = cold start (warm gray).
  - `3098–5000 ms` = remaining fetch window (amber/red).
  - 3 small tick labels showing 3 `.webp` fetches each slamming into the 5000 ms wall.
  - Respects `prefers-reduced-motion` (static bar if reduce).
- **Section 2 — Cold-start math (`cold-start-math-svg`):** inline SVG with three concurrent lanes each 5.6 s long, colliding with a vertical 5000 ms "wall". Arithmetic caption: `INIT_DURATION 3098 ms + fetch 2500 ms ≈ 5598 ms > 5000 ms budget → Timeout`.
- **Section 3 — CloudFront hypothesis, eliminated:** small "dismissed" card — CloudFront healthy, so problem is upstream. Reinforces the investigation narrative.
- **Section 4 — Self-healing log diff (`self-heal-log-diff`):** before/after side-by-side of CloudWatch logs. "During incident" shows `INIT_START` and 504; "After warm-up" shows `status: 200` no `INIT_START`. Use `EvidenceCard` primitive for each side.
- **Section 5 — Three fix options (`fix-options`):** three cards — Provisioned Concurrency, Split optimizer, Timeout bump — each with a short tradeoff line. No call to action; CauseFlow surfaces options, humans decide.
- **Section 6 — Root cause + impact:** short statement + stat (e.g. "N demos abandoned").
- **Section 7 — Final CTA:** `<CtaStopHuntingSection />`.

## Acceptance Criteria

- [x] Page `/use-cases/broken-images` renders end-to-end in EN + PT-BR with all 7 sections.
- [x] `budget-bar` animates fill on mount (respects reduced motion). No CSS bar "jump" on reload.
- [x] `cold-start-math-svg` uses inline SVG only; numeric labels come from i18n (don't hardcode "3098" in JSX — put it in content keys so PT can reuse).
- [x] `fix-options` cards use the existing card styling (`border-border bg-card`), hover lifts if same pattern used on home.
- [x] All strings from `caseStudies.brokenImages.*`. Dark + light mode parity.
- [x] Source-guard tests colocated for all 4 custom components.
- [x] Static checks + dev curl smoke both locales, same as Sprint 02.

## Agent Notes

### Files created (8)
- `scenario-02/budget-bar.tsx` + `.test.tsx`
- `scenario-02/cold-start-math-svg.tsx` + `.test.tsx`
- `scenario-02/self-heal-log-diff.tsx` + `.test.tsx`
- `scenario-02/fix-options.tsx` + `.test.tsx`

### Files modified (3)
- `broken-images-page.tsx` — replaced placeholder with full Budget Clock layout (8 rendered sections including breadcrumb).
- `infrastructure/i18n/en.json` — expanded `caseStudies.brokenImages` from meta-only to full subtree (hero, budgetSection, coldStartSection, cdnSection, logDiffSection, fixSection, rootCauseSection, ctaSection). ~87 insertions.
- `infrastructure/i18n/pt-br.json` — mirrored the subtree with idiomatic PT-BR copy.

### Execution path (unusual)
- Initial sprint-executor worktree (a6fda504) committed components + EN i18n but was cut off before committing page body or PT-BR translations; no git commit landed on its branch.
- Finished in main branch directly after Sprints 02 + 04 merged cleanly. Copied scenario-02 components from the unfinished worktree, re-implemented broken-images-page.tsx, mirrored EN keys into pt-br.json, and converted the agent's `@testing-library/react`-based test files to source-guard pattern (matches Sprint 01/02/04 project convention — no missing dependency).

### Decisions
- **Test style:** Converted from render-based tests to source-guard contract tests (readFileSync + regex match). `@testing-library/react` is not in the website workspace deps; sprints 01/02/04 used source-guard throughout.
- **Numeric labels in i18n:** `totalMs`, `coldStartMs`, `laneCount` stored as strings under `caseStudies.brokenImages.*`; page parses with `Number.parseInt`. No hardcoded `3098`/`5000` in JSX.
- **Tick spacing:** 3 `.webp` tick marks are computed from `coldStartMs + 200` evenly spaced across the remaining budget; labels come from i18n so PT-BR can rename if needed.
- **First-request 500 on EN cold compile:** Known dev-only ECONNRESET on Next.js webpack first compilation; subsequent GETs return HTTP 200 with expected content (verified curl returns "Eight minutes", "INV-0052", "Budget Clock", "broken images").

### Verification evidence
- `pnpm --filter website exec tsc --noEmit` → exit 0 (clean).
- Vitest `--project website`: 297 passed, 1 failed (pre-existing `integration-card.test.tsx` "SOC 2 … certified" copy assertion — unrelated to any sprint). 59 test files total.
- `curl http://127.0.0.1:3000/use-cases/broken-images` → HTTP 200, body contains "Eight minutes", "Case File", "INV-0052", "Budget Clock", "broken images".
- `curl http://127.0.0.1:3000/pt-br/use-cases/broken-images` → HTTP 200, ~164 KB body, PT-BR copy present.
- All 4 new routes (/use-cases, stale-pricing, broken-images, cascading-500) + PT variant return 200 after warm-up.

### Follow-ups
- None required for Sprint 05 beyond the carousel/sitemap/Playwright work already specified there.

## File Boundaries

### files_to_create

- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-02/budget-bar.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-02/cold-start-math-svg.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-02/self-heal-log-diff.tsx`
- `apps/website/src/contexts/marketing/presentation/components/case-studies/scenario-02/fix-options.tsx`
- Colocated `.test.tsx` per component above.

### files_to_modify

- `apps/website/src/contexts/marketing/presentation/pages/case-studies/broken-images-page.tsx`
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`

### files_read_only

- Same as Sprint 02 plus `/root/projects/causeflow/test-scenarios/scenario-02-imagens-quebradas.md`.

## Out of Scope

Same as Sprint 02.

## Agent Notes
<!-- orchestrator fills -->
