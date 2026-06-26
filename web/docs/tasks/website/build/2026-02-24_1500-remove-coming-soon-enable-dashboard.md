# Remove "Coming Soon" States & Enable Dashboard Access

The Dashboard is now fully built. Remove all "Coming Soon" overlays, badges, and disabled states from the website. Update CTAs to point to the live Dashboard.

## Phase 1: Research & Discovery
- [x] Read the get-started page (`apps/website/src/app/[locale]/get-started/page.tsx`) to understand the overlay structure
- [x] Read the ComingSoonOverlay component (`apps/website/src/components/sections/coming-soon-overlay.tsx`)
- [x] Read the product page to find the "Coming Soon" badge on Phase 3
- [x] Read EN i18n messages to find all "Coming Soon" references
- [x] Read PT-BR i18n messages to find all "Em Breve" references
- [x] Identify all CTA buttons across the website that should link to Dashboard/get-started

## Phase 2: Implementation — Remove "Coming Soon" States
- [x] Remove the blur overlay layer from the get-started page (remove `pointer-events-none`, `select-none`, `blur-[2px]`, and the absolute overlay div)
- [x] Remove or repurpose the `ComingSoonOverlay` component (remove the overlay wrapping the form)
- [x] Update the get-started page to show a functional sign-up form pointing to `dashboard.causeflow.ai`
- [x] Update the Product page Phase 3 "Coming Soon" badge to show an active/available state
- [x] Update EN i18n messages — remove/update "Coming Soon" text where applicable
- [x] Update PT-BR i18n messages — remove/update "Em Breve" text where applicable

## Phase 3: Update CTA Buttons & Links
- [x] Audit all "Get Started" / "Start Free Trial" buttons across the website for correct hrefs
- [x] Ensure all CTAs point to the Dashboard sign-up flow (`https://dashboard.causeflow.ai/auth/sign-up` or `/get-started`)
- [x] Verify the header/nav CTA button links are correct
- [x] Verify the footer CTA links are correct

## Phase 4: Tests
- [x] Update any existing unit tests affected by the overlay removal
- [x] Update E2E tests in `tests/audit.spec.ts` and `tests/visual-functional.spec.ts` that reference "Coming Soon"
- [x] Run `pnpm turbo build` — fix any build errors
- [x] Run `pnpm exec biome check .` — fix any lint issues
- [x] Run `pnpm turbo check-types` — fix any type errors
- [x] Run Vitest tests — fix any failures

## Phase 5: Visual Verification
- [x] Start the website dev server and take Playwright screenshots of the get-started page (mobile + desktop)
- [x] Take Playwright screenshots of the product page Phase 3 section
- [x] Take Playwright screenshots of the homepage hero CTA
- [x] Verify no visual regressions on other pages
- [x] Clean up unused code/imports from the overlay removal
