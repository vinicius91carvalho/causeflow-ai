# Website: Blur Prices, Highlight MVP Integrations & Homepage Carousel

## Context (The Why)
CauseFlow is pre-MVP. Pricing is not finalized and showing specific prices creates commitment. We want to show that pricing exists (social proof) but blur the actual numbers. The integrations page and homepage carousel should visually highlight which integrations will be available at MVP launch.

## Definition (The What)
1. **Pricing page**: Apply CSS blur filter to all price values ($0, $49, $149, $399, Custom) across:
   - PricingCard price displays
   - ROI Calculator cost outputs
   - ComparisonTable if prices appear there
2. **Integrations page**: Update MVP integration list to match actual MVP scope:
   - **MVP integrations (9)**: AWS CloudWatch, Slack, JIRA, Trello, Notion, Shortcut, GitHub, HubSpot, Sentry
   - **Add to codebase**: Notion, Shortcut (not currently in INTEGRATIONS constant)
   - **Move Sentry to MVP**: currently v2 in code
   - Style MVP integrations with colorful, prominent cards (brand colors, larger icons, gradient borders)
   - Non-MVP integrations remain with "Coming Soon" badge and muted styling
3. **Homepage carousel**: Show MVP integrations in the existing integration carousel/showcase on the homepage

## Acceptance Criteria (The How to Test)
- [x] Prices on pricing page are visually blurred but layout is preserved
- [x] Hovering/clicking on blurred prices does NOT reveal the actual price
- [x] ROI calculator cost outputs are blurred
- [x] MVP integrations (AWS, Slack, JIRA, Trello, Notion, Shortcut, GitHub, HubSpot, Sentry) have prominent, colorful styling on integrations page
- [x] Non-MVP integrations (PostgreSQL, Linear, MongoDB, etc.) show "Coming Soon" with muted style
- [x] Notion and Shortcut are added to the integrations constant with correct metadata
- [x] Sentry is moved to MVP phase in the integrations constant
- [x] Homepage carousel displays MVP integrations prominently
- [x] All pages render correctly on mobile, tablet, desktop
- [x] i18n works for both EN and PT-BR
- [x] No console errors

## Restrictions (The Boundaries)
- Do NOT remove pricing data from constants — only blur the display
- Do NOT change the pricing page layout or structure
- Keep integration filter functionality working
- Maintain all existing accessibility features
- No breaking changes to shared package types

## Phase 1: Research & Setup
- [x] Read current pricing-card.tsx to understand price rendering
- [x] Read ROI calculator to understand cost output rendering
- [x] Read integration-filter.tsx to understand card rendering
- [x] Read integrations.ts constant to understand data structure
- [x] Read homepage to find integration carousel/showcase component
- [x] Check if Notion, Shortcut, Sentry SVG icons exist in /public/icons/integrations/

## Phase 2: Implementation — Pricing Blur
- [x] Add CSS blur class to price display in pricing-card.tsx (blur-sm + select-none + pointer-events-none)
- [x] Add blur to ROI calculator cost outputs
- [x] Add blur to comparison table prices (if they exist)
- [x] Add a subtle "Pricing coming soon" overlay or tooltip on blurred prices
- [x] Ensure blur works in dark mode

## Phase 3: Implementation — Integrations MVP Highlight
- [x] Add Notion to INTEGRATIONS constant (category: Knowledge, phase: mvp)
- [x] Add Shortcut to INTEGRATIONS constant (category: Management, phase: mvp)
- [x] Move Sentry from v2 to mvp phase in INTEGRATIONS constant
- [x] Create SVG icons for Notion and Shortcut in /public/icons/integrations/
- [x] Update integration-filter.tsx to style MVP cards with colorful treatment (brand color borders, gradient backgrounds, larger display)
- [x] Style non-MVP cards with muted/greyed appearance
- [x] Update i18n strings for Notion and Shortcut (en.json + pt-br.json)

## Phase 3.5: Implementation — Homepage Carousel
- [x] Find and update homepage integration carousel/showcase component
- [x] Ensure MVP integrations are shown prominently in the carousel
- [x] Non-MVP integrations in carousel show "Coming Soon" styling
- [x] Carousel works on all viewports (mobile-first)

## Phase 4: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Start dev server and verify pricing page renders with blurred prices
- [x] Verify integrations page shows MVP tools prominently
- [x] Verify homepage carousel shows MVP integrations
- [x] Test mobile, tablet, desktop viewports
- [x] Remove unused code/imports

## Phase 6: Compound
- [x] Document blur pattern in session-learnings.md
- [x] Update integration list in relevant docs if needed

## Learnings
- Tailwind `blur-sm` + `select-none` is the simplest way to blur pricing content while preserving layout
- `aria-hidden="true"` on blurred elements + `sr-only` text for screen readers maintains accessibility
- Integration card MVP/non-MVP styling is cleanly done via the `phase` field from the INTEGRATIONS constant
- The TechLogoCarousel component accepts an `isMvp` flag per logo item to style non-MVP items as muted/greyscale
- Integration names/descriptions come from the constant, not i18n, so adding new integrations only requires constant + icon + icon mapping in integration-filter.tsx
