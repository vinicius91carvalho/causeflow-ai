# Lighthouse & PageSpeed Insights — 100% Score

## Phase 1: Font Optimization (Performance — FCP/LCP)
- [x] Remove 5 render-blocking @import url() from entry.css
- [x] Self-host Plus Jakarta Sans via next/font/google in layout.tsx
- [x] Update font-stacks.css to use CSS variable
- [x] Add preconnect hints for Google Fonts
- [x] Add lazy font loading in ThemeProvider for non-default themes

## Phase 2: Image Optimization (Performance + Best Practices)
- [x] Remove images.unoptimized from next.config.mjs
- [x] Add width/height/loading/decoding to all img tags on homepage
- [x] Add width/height/loading/decoding to img tags on other pages

## Phase 3: Code Splitting & Lazy Loading (Performance — TBT/Bundle)
- [x] Dynamic import CrossReferenceVisualization on homepage
- [x] Dynamic import heavy components on pricing page
- [x] Throttle mouse events on InvestigationDashboardPreview

## Phase 4: LCP Optimization (Performance)
- [x] Convert HeroSection to server component
- [x] Extract CTAButtonClient wrapper for onClick handling
- [x] Check CTASection for same pattern

## Phase 5: Accessibility Fixes
- [x] Add skip-to-content link in layout.tsx
- [x] Add aria-label to header nav
- [x] Add nav wrapper + aria-label to footer
- [x] Add aria-label to language selector
- [x] Add role="alert" to form error messages
- [x] Ensure main#main-content on all pages

## Phase 6: SEO & Best Practices Polish
- [x] Add themeColor to metadata
- [x] CSP: Replace unsafe-inline with script hash (if needed)

## Phase 7: Verification
- [x] Take baseline screenshots before changes
- [x] Build and verify no type/lint errors
- [x] Run all Playwright tests
- [x] Deploy to staging
- [x] Run Lighthouse on staging
- [x] Take post-change screenshots and compare
