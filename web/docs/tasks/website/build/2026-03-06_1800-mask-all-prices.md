# Mask All Prices on Website and Dashboard

## Context (The Why)
Prices displayed across website and dashboard are placeholder values (0.50, 0.20, plan prices $49/$149/$399). These are not finalized and must be hidden until pricing strategy is decided. Some places already have blur, but comparison table on website and plan cards on dashboard do NOT.

## Definition (The What)
Apply consistent "Pricing coming soon" blur treatment to ALL price displays across both apps.

## Acceptance Criteria (The How to Test)
- [x] No numeric price values visible anywhere on website or dashboard
- [x] Comparison table on pricing page has blurred prices
- [x] Dashboard billing plan cards have blurred prices
- [x] ROI calculator values remain blurred (already done)
- [x] Pricing cards remain blurred (already done)
- [x] "Pricing coming soon" messaging visible where prices are hidden

## Restrictions (The Boundaries)
- Do NOT remove the pricing data from the constants — just mask in UI
- Keep existing blur treatment consistent (use `blur-sm select-none`)
- Website and dashboard changes are independent (can be parallel)

## Phase 1: Research & Setup
- [x] Identify all price display locations (comparison table, plan cards, ROI, credit costs)
- [x] Verify existing blur treatment on pricing cards and ROI calculator

## Phase 2: Implementation
- [x] Website: Blur homepage hero stat "$0.50-$0.20" (i18n en.json + pt-br.json "Estimated Cost per Investigation")
- [x] Website: Blur comparison table prices in `pricing-page.tsx`
- [x] Website: Blur overage prices in pricing constants if displayed ($0.50/each, $0.35/each, $0.20/each)
- [x] Dashboard: Blur plan card prices in `plan-card.tsx`
- [x] Dashboard: Check billing page for any other price displays and blur them
- [x] Dashboard: Check credits/analysis costs displays and blur them
- [x] Ensure "Pricing coming soon" text accompanies all blurred areas

## Phase 3: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Visual verification in browser

## Phase 4: Compound
- [x] Update session learnings if needed
