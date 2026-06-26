# PRD — Three Case Study Pages (`/use-cases/<slug>`)

**Status:** Build Candidate
**Owner:** Website marketing
**Source plan:** `/root/.claude/plans/you-are-a-story-snappy-kernighan.md`
**Source material:** `/root/projects/causeflow/test-scenarios/scenario-0{1,2,3}-*.md`

## Context

CauseFlow needs three storytelling pages on the marketing site, each showing a concrete incident CauseFlow diagnosed. Source material lives in `/root/projects/causeflow/test-scenarios/scenario-0{1,2,3}-*.md` (Portuguese). Goal: prospects see *how* CauseFlow solves real problems, not just *what* it is. Must match the home page's design language (clean, lots of whitespace, tasteful SVG diagrams, `bg-background`/`text-foreground` tokens, `font-display` headlines, `AnimateOnScroll` reveal on scroll) while each scenario gets a **visually distinct template** — the variety itself is the showcase.

Why distinct layouts: user explicitly asked for "3 different templates show casing the power of CauseFlow AI." A repeatable CaseStudyPage shell would be the cheap move; bespoke templates let each incident's *shape* drive its page.

Note: `apps/website/CLAUDE.md` lists `/use-cases` as an existing route, but filesystem has no `src/app/[locale]/use-cases/` directory. Doc is stale. Sprint 1 verifies and creates.

## Decisions (confirmed with user)

| Question | Decision |
|---|---|
| URL path | `/use-cases/<slug>` (EN) + `/pt-br/use-cases/<slug>` (PT) |
| i18n | Bilingual EN + PT-BR. Translate PT source → idiomatic EN. |
| Templates | 3 visually distinct layouts |
| Nav entry | Header nav "Use Cases" link + wire home carousel cards to deep-link |

## Slugs + Template Concepts

| Scenario | Slug | Template Concept |
|---|---|---|
| 01 Stale Pricing | `/use-cases/stale-pricing` | **The Forensic Dossier** — evidence-board 2×2 grid of data points, data-flow diagram with two red Xs for the two bugs, affected-routes pill strip, symptom→root-cause timeline |
| 02 Broken Images | `/use-cases/broken-images` | **The Budget Clock** — animated 5000ms budget bar, cold-start math SVG (3× concurrent fetches fighting 1902ms remaining), before/after log diff, fix-options cards |
| 03 Cascading 500 | `/use-cases/cascading-500` | **The Cascade** — full-width architecture flow diagram with pulsing failure nodes, synchronized traffic-vs-errors chart, "80 cache records all useless" visual, before/after architecture, big-number business impact card |

## Design Guardrails

- **No new color tokens.** Use `text-foreground`, `text-foreground/70`, `text-accent`, `bg-background`, `bg-muted/40`, `bg-card`, `border-border`. Failure/red accents only via `text-red-500/600` and `bg-red-500/10`.
- **SVG is inline JSX, not exported assets.** Matches existing hero visuals. No new files under `public/`.
- **Respect `prefers-reduced-motion`** for all animations (pulses, bar fills, line draws). Check via CSS media query (`@media (prefers-reduced-motion: reduce)`) on animated elements.
- **Mobile-first.** Every diagram must degrade to a stacked/simplified version under 640px. 2×2 grids collapse to 1-col. Architecture diagrams flow vertical on mobile.
- **No new dependencies.** Everything buildable with existing Tailwind + Next + react-markdown stack.
- **Dark mode parity.** Every page verified light + dark via Playwright.

## Reusable Patterns (do not reinvent)

| Need | Existing pattern to reuse | Source |
|---|---|---|
| Page metadata + canonical + hreflang | `generatePageMetadata()` | `apps/website/src/lib/metadata.ts` |
| Scroll-in reveal | `<AnimateOnScroll>` | `@causeflow/ui/themes` |
| Section padding | `bg-background px-4 py-[110px] sm:px-6 sm:py-28 lg:px-8 lg:py-32` | any home section |
| Headline type ramp | `text-balance font-display tracking-[-0.035em]` + `clamp(2.6rem, 4.5vw + 0.8rem, 5.3rem)` | `hero-main-header.tsx` |
| Final CTA card | `<CtaStopHuntingSection />` | keep as the closing CTA on all 3 pages for consistency |
| Eyebrow label | `font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent` | home |
| i18n server component | `await getTranslations(locale, 'caseStudies.stalePrice...')` | any marketing page |
| Page layout wrapper | `<PageLayout header={<Header />} footer={<Footer />}>` | home, product |

## Sprint Summary

| # | Title | Dep | Parallel with |
|---|---|---|---|
| 01 | Foundation — index, shared primitives, nav, domain registry, i18n skeleton | None | (sequential) |
| 02 | Template A: Stale Pricing (Forensic Dossier) | 01 | 03, 04 |
| 03 | Template B: Broken Images (Budget Clock) | 01 | 02, 04 |
| 04 | Template C: Cascading 500 (Cascade) | 01 | 02, 03 |
| 05 | Integration — home carousel wiring, sitemap, full Playwright + Lighthouse | 01,02,03,04 | (sequential) |

Batch plan in `progress.json`:
- Batch 1: Sprint 01
- Batch 2: Sprints 02 + 03 + 04 (parallel worktrees)
- Batch 3: Sprint 05

## Verification (end-to-end)

```bash
pnpm turbo check-types
pnpm turbo build --filter=website
pnpm exec biome check apps/website
pnpm --filter website test
pkill -f "next-server|next start|next dev" 2>/dev/null
pnpm --filter website dev &
# Visit:
#   http://localhost:3000/use-cases
#   http://localhost:3000/use-cases/stale-pricing
#   http://localhost:3000/use-cases/broken-images
#   http://localhost:3000/use-cases/cascading-500
#   http://localhost:3000/pt-br/use-cases (× 3 slugs)
pnpm exec playwright test tests/audit.spec.ts
curl -sI http://localhost:3000/use-cases/stale-pricing | grep -i 'canonical\|og:'
```

**Pass criteria:**
- TSC clean, Biome clean, Vitest green.
- 4 new routes (index + 3) render in EN + PT-BR, exit 200.
- No console errors browser-side or server-side.
- Header "Use Cases" link works, mobile menu mirrors.
- Home carousel cards deep-link to matching scenarios.
- Playwright screenshots captured for all 3 scenario pages, light + dark, mobile + desktop, no visible layout breakage.
- `prefers-reduced-motion: reduce` disables animations — verified via Playwright emulation.
- Sitemap.xml includes 8 new URLs.
- OG image + canonical + hreflang present on all new pages.

## Out of Scope

- New theme tokens, new `public/` assets.
- Backend/Core API changes.
- Testimonial quotes from real customers (these are demo scenarios).
- Analytics events beyond default GA4 pageview.
- A/B testing the templates.
- Case study search/filter on index page (just a simple 3-card grid).
