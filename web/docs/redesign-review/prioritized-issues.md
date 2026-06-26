# Prioritized Issues — Cleric Redesign Final Review

**Consolidated from:** [`ux-designer.md`](./ux-designer.md) + [`tech-manager.md`](./tech-manager.md)
**Date:** 2026-04-19
**Audit scope:** Sprints 01–04 output (`/`, `/product`, `/use-cases`, `/integrations`, `/pricing`, `/security`, EN + PT-BR, 4 viewports).
**Evidence:** 48 screenshots at `screenshots/sprint-05/` + source review.

---

## Severity Summary

| Severity | Count | Theme |
|---|---|---|
| **P0** | 3 (deduped from 4 CTO + 6 UX raw) | Rendering failure + compliance misrepresentation — block buyer evaluation |
| **P1** | 5 | Pricing/SLA/breadth gaps — block POC or procurement |
| **P2** | 4 | Copy polish + dead-code cleanup |

---

## P0 — Ship-blockers

### P0-1 — Compliance claim contradiction: `/integrations` says "Certified", `/security` says "In Progress"

- **Buyer impact:** Legal/compliance in any >50-engineer buyer reads this as misrepresentation. Contractual blocker.
- **Files:**
  - `apps/website/src/contexts/marketing/infrastructure/i18n/en.json:351-354` — `integrations.security.soc2Title = "SOC 2 Certified"`, `iso27001Title = "ISO 27001:2022 Certified"`
  - `apps/website/src/contexts/marketing/infrastructure/i18n/en.json:350` — subtitle "independently audited and certified"
  - `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx:93-106` — correct `isCompliant: false` for both
- **Fix:** Change integrations i18n to match security page: `"SOC 2 Type II (In Progress — audit initiated)"` + `"ISO 27001 (On Roadmap)"`. Rewrite subtitle to: "LGPD and GDPR compliant at launch. SOC 2 Type II in progress, ISO 27001 on roadmap." Apply same changes to `pt-br.json`.
- **Source:** CTO P0 + P2 (reinforced).

### P0-2 — Systemic rendering failure: 5 pages render only hero, body blank below the fold

- **Buyer impact:** /integrations, /use-cases, /product, /pricing (plan cards), /security (architecture block) all present a blank body on SSG/first-paint capture. Evaluation ends at "See How It Works" click.
- **Affected pages + files:**
  - `/integrations` — `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx` (IntegrationFilter)
  - `/use-cases` — `apps/website/src/contexts/marketing/presentation/pages/use-cases-page.tsx` (UseCaseStorySection loop)
  - `/product` — `apps/website/src/contexts/marketing/presentation/pages/product-page.tsx` (phases/timeline)
  - `/pricing` — `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx:26-34` (PricingInteractive dynamic, invisible skeleton)
  - `/security` — `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx:320` (architecture SectionLayout variant="dark")
  - Homepage body — `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx:47-81` (NarrativeFeaturesSection, CrossReferenceVisualization, WhyNow, WhyDifferent all `next/dynamic`)
- **Root causes (combined):**
  1. `next/dynamic(...)` imports without `ssr: true`/static fallback — sections render invisible `<div>` skeletons (no bg, no text) pre-hydration.
  2. `AnimateOnScroll` wraps below-fold content with `opacity-0 translate-y-8` as SSR initial state; hook sets `prefersReducedMotion` only in `useLayoutEffect` — first paint is hidden even with Playwright `reducedMotion: 'reduce'` because the hook reads `matchMedia` client-side after render.
- **Fix:**
  1. Convert above-fold/critical sections to static imports (`NarrativeFeaturesSection`, `CallToActionSection`, integration cards grid, use-case stories, product phases). Keep `next/dynamic` only for heavy interactive viz (`CrossReferenceVisualization`).
  2. Give skeletons a visible background (`bg-card border border-border`) so dynamic slots never read as "blank".
  3. Patch `packages/ui/src/themes/original/animations/components/animate-on-scroll.tsx` + `use-animate-on-scroll.ts`: make SSR initial state `opacity: 1` (no hidden class) and apply the hidden state only after `useIsomorphicLayoutEffect` confirms JS is running AND user does not prefer reduced motion. This flips the default from "hidden until JS proves otherwise" to "visible unless JS adds animation".
- **Verification:** Add Playwright smoke assertions: `await expect(page.locator('[data-testid="use-case-story"]').first()).toBeVisible()` on all five pages. `smoke-personas.spec.ts` already captures evidence; extend with locator checks.
- **Source:** CTO P0 (×3) + UX P0 (×6).

### P0-3 — Homepage hero product preview renders empty box

- **Buyer impact:** The single most impactful conversion element (dashboard preview with "Root Cause Identified / 97% confidence") shows only a small centered icon. Site reads as pre-launch landing page.
- **File:** `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — `InvestigationDashboardPreview` dynamic import with `VizSkeleton` (bg-card/60 only)
- **Fix:** Static import the preview OR replace with a high-fidelity SSG screenshot of the real dashboard. Eliminates JS dependency for the highest-stakes element.
- **Source:** CTO P1 promoted (overlaps P0-2 but has standalone buyer-conversion weight).

---

## P1 — POC / procurement blockers

### P1-1 — No free plan or structured trial in /pricing

- **File:** `packages/shared/src/domain/constants/pricing.ts:3-88` — smallest paid tier is $99/mo Starter.
- **Buyer impact:** Rootly (14-day trial), incident.io (freemium) both offer self-serve POC. "Contact us for Early Access" adds weeks to the decision cycle.
- **Fix:** Define a 14-day trial (5 investigations, no card) OR make POC path explicit: "Book a 30-min technical demo — live investigation on your stack." Remove orphaned `plans.free` i18n key (see P2-4).

### P1-2 — "Event" pricing unit undefined; Starter 500-events quota unrealistic vs 847-log example

- **File:** `packages/shared/src/domain/constants/pricing.ts:9` + `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (pricing.faq.q1)
- **Buyer impact:** Procurement won't approve contracts with undefined variable cost. Hero example (847 log lines) would blow Starter quota on first incident.
- **Fix:** Define "event" inline on pricing page (not only FAQ): "1 event = 1 data source consulted (1 log query, 1 metric read, 1 ticket read)." Re-model Starter quota against hero example. Consider renaming to "data sources consulted".

### P1-3 — Privacy-Preserving Mode (Docker agent) lacks lifecycle/SLA

- **File:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (deploymentApproaches.privacyPreserving)
- **Buyer impact:** Strongest competitive moat, but silent on patch cadence, CVE response, SLA. 72h mandatory-patch policies treat unpatched containers as security risk.
- **Fix:** Add "Agent Lifecycle" subsection to `/security`: release cadence, distribution channel (pull vs push), patch policy, digest/SHA verification. Differentiate Privacy vs Connected Mode SLA.

### P1-4 — /integrations catalog lacks `status: ga | beta | coming-soon`

- **File:** `packages/shared/src/domain/constants/integrations.ts:3-375`
- **Buyer impact:** 40+ entries with no availability signal. Post-onboarding discovery that Salesforce/ServiceNow/Argo CD are roadmap items is classic infra-tooling churn trigger.
- **Fix:** Add `status: 'ga' | 'beta' | 'coming-soon'` to `Integration` type. Badge non-GA entries. Prefer "8 GA + clear roadmap" to "40 unknown".

### P1-5 — Mobile home shows only one CTA; pricing tablet misaligns plan cards with ROI calculator

- **File:** `apps/website/src/contexts/marketing/presentation/components/sections/hero-section-v2.tsx` + `pricing-page.tsx`
- **Buyer impact:** Mobile hero missing secondary "See how it works" button collapses conversion options. Tablet pricing shows ROI Calculator floating without plan-card context above.
- **Fix:** Verify mobile CTA row `flex-wrap` + min-width. Review tablet (768px) breakpoint for pricing layout — plan cards must precede ROI calculator without overflow.
- **Source:** UX follow-up observations.

---

## P2 — Polish / cleanup

### P2-1 — Badge hierarchy mixes active vs in-progress certifications linearly

- **File:** `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx:189-195` + `SecurityFirstSection` + footer
- **Fix:** Two badge styles: solid teal for active (LGPD, GDPR), outlined gray + clock icon for in-progress. Qualifier must be visually evident, not only textual.

### P2-2 — ROI Calculator default values produce $0 savings on first impression

- **File:** `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx:179-213`
- **Fix:** Calibrate defaults to ICP median: 15 incidents/mo, 4h avg investigation, 8 engineers @ $150/h. First impression must be a positive number.

### P2-3 — /integrations "independently audited and certified" subtitle un-qualified

- **File:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json:350`
- **Fix:** Rewrite to match P0-1 accuracy.

### P2-4 — `pricing.plans.free` i18n key orphaned (no matching plan in `PRICING_PLANS`)

- **Files:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` + `pt-br.json` + `packages/shared/src/domain/constants/pricing.ts`
- **Fix:** Remove orphan key OR introduce matching free plan (see P1-1).

---

## Fix Sequencing Recommendation

1. **P0-1 (compliance copy)** — 30 min, zero-risk text change. Ship first.
2. **P0-2 (rendering failure)** — requires `AnimateOnScroll` refactor + dynamic-import audit. 2–4h. High-impact, moderate risk (regressions on all pages). Protect with Playwright `toBeVisible` locators per section.
3. **P0-3 (hero preview)** — can fold into P0-2 fix OR swap to static asset immediately.
4. **P1-1 through P1-5** — separate sprint. Pricing P1s require product decision input.
5. **P2 batch** — clean up in same sprint as P0-1 or after P1s.

---

## Follow-Up Sprint Proposal

- **Sprint 06 — Cleric Remediation P0:** Fix P0-1, P0-2, P0-3. Add per-section visibility Playwright assertions.
- **Sprint 07 — Pricing + SLA Clarifications (P1):** Requires product decision; out-of-scope for redesign.
