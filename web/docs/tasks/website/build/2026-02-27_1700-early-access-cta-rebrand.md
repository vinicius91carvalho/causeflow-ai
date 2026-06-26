# Early Access CTA Rebrand — Pre-Launch Messaging

## Summary
Update all CTAs, subtexts, modal copy, and metrics across the website to reflect pre-launch/beta status. The product launches March 2026, so messaging should set expectations accordingly.

## Changes Overview

| Area | Current | New |
|---|---|---|
| Main CTA | "Get Started Free" | "Get Early Access" |
| Hero subtext | "Setup in 10 minutes · 5 free investigations/month · No credit card" | "Be among the first to investigate incidents with AI. Launching March 2026." |
| Contact modal title | "Get in Touch" | "Get Early Access" |
| Contact modal description | Generic | "We're launching in March. Join the early access list and be the first to try CauseFlow." |
| 5 free investigations | Present tense | "Early access members get 5 free investigations/month at launch" |
| Metrics labels | "MTTR Reduction", "Cost per Investigation", "Downtime Cost Avoided" | Prefix with "Estimated" |

## Phase 1: Research & Setup
- [x] Map all files containing CTAs, metrics, modal, and free tier text
- [x] Identify i18n keys vs hardcoded strings

## Phase 2: Implementation — i18n EN
- [x] Update `common.nav.getStartedFree` → "Get Early Access"
- [x] Update `common.cta.getStartedFree` → "Get Early Access"
- [x] Update `homepage.hero.ctaPrimary` → "Get Early Access"
- [x] Update `homepage.hero.trustText` → early access subtext
- [x] Update `homepage.metrics` labels → add "Estimated" prefix
- [x] Update `homepage.ctaFinal` → early access messaging
- [x] Update `product.hero.ctaPrimary` → "Get Early Access"
- [x] Update `security.cta.ctaPrimary` → "Get Early Access"
- [x] Update `compare.cta.button` → early access variant
- [x] Update `vs.template.ctaButton` → early access variant
- [x] Update `getStarted.*` — free tier as future promise
- [x] Update `pricing.hero.subtitle` → pre-launch framing

## Phase 3: Implementation — i18n PT-BR
- [x] Update PT-BR equivalents for all changed keys (18 values updated)

## Phase 4: Implementation — Hardcoded strings
- [x] `apps/website/src/app/[locale]/product/page.tsx:572` — hardcoded subtitle
- [x] `apps/website/src/app/[locale]/pricing/page.tsx:187` — hardcoded subtitle
- [x] `apps/website/src/components/contact-modal.tsx` — modal title, description, success message, submit button

## Phase 5: Validation
- [x] Run biome check — passed (auto-fixed formatting in contact-modal.tsx)
- [x] Build website — passed (32 pages, no errors)
- [x] Visual check with Playwright

## Phase 6: Compound
- [x] Document changes

## Learnings

- **i18n-first approach was efficient** — all CTAs used i18n keys, so the rebrand was a pure content change (no component code modified). Validated the decision to use i18n keys even for English-only text.
- **Consistent key naming** — `ctaPrimary`, `ctaButton`, `button` keys across namespaces made it easy to find all CTAs. Future pages should follow this pattern.
- **Hardcoded strings still existed** — Product and Pricing subtitles and contact modal had hardcoded copy that needed manual updates.
- **Five pages verified via Playwright** — Homepage, Product, Security, Compare, VS/resolve-ai all show "Get Early Access" consistently.
