# UI Fixes: Margins, Founder Cards, Animation Scale, Impact Metrics

## Context
Multiple UI issues to fix across several pages:
1. Excessive margin below header on /pricing and /compare pages
2. Founder cards on /about should appear in hover state by default
3. CauseFlow AI center animation should end at a bigger scale
4. Impact Metrics cards on homepage should have equal height

## Files to Modify
- `apps/website/src/app/[locale]/pricing/page.tsx` — reduce hero spacing
- `apps/website/src/app/[locale]/compare/page.tsx` — reduce hero spacing
- `apps/website/src/components/sections/founder-card.tsx` — default hover state
- `packages/ui/src/themes/original/animations/keyframes.css` — center-receive end scale
- `packages/ui/src/themes/original/animations/utilities.css` — animation fill mode
- `apps/website/src/components/sections/metric-card.tsx` — equal height cards

## Phase 1: Fix excessive margins below header on /pricing
- [x] Override HeroSection padding on pricing page to reduce gap below header
- [x] Verify visually

## Phase 2: Fix excessive margins below header on /compare
- [x] Override HeroSection padding on compare page to reduce gap below header
- [x] Verify visually

## Phase 3: Founder cards default hover state on /about
- [x] Modify FounderCard to apply hover styles as default (bg-accent, border-accent, shadow, white text, -translate-y-1)
- [x] Keep transition classes for smooth appearance with AnimateOnScroll
- [x] Verify visually

## Phase 4: CauseFlow AI animation ends bigger
- [x] Add scale-125 class to CauseFlow AI node at phase >= 5 in both visualization components
- [x] Add transition-transform duration-700 for smooth scale-up when animation ends
- [x] Verify visually

## Phase 5: Impact Metrics equal card height
- [x] Add h-full to MetricCard component so grid stretches all cards equally
- [x] Verify visually

## Phase 6: Build & Validation
- [x] Run pnpm turbo build — zero errors
- [x] Run pnpm exec biome check . — zero lint issues (changed files clean)
- [x] Visual check across all affected pages
