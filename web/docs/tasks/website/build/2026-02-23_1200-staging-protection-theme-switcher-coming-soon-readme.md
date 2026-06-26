# Staging Protection, Theme Switcher, Coming Soon & README

## Feature 1: Block Robots on Staging
- [x] Add `NEXT_PUBLIC_DEPLOYMENT_STAGE` and `NEXT_PUBLIC_SITE_URL` env vars to `sst.config.ts`
- [x] Update `robots.ts` — conditional `Disallow: /` on staging, `Allow: /` on production
- [x] Update `[locale]/layout.tsx` — add `robots: { index: false, follow: false }` metadata on staging
- [x] Update `metadata.ts` — use `NEXT_PUBLIC_SITE_URL` for canonical URLs
- [x] Update `sitemap.ts` — use `NEXT_PUBLIC_SITE_URL` for sitemap base URL

## Feature 2: Staging Password Protection
- [x] Add `STAGING_PASSWORD` server-side env var to `sst.config.ts`
- [x] Create `/staging-login` page (outside `[locale]`, no i18n)
- [x] Create `/staging-login/layout.tsx` — minimal HTML layout
- [x] Create `/api/staging-auth/route.ts` — POST endpoint: validates password, sets httpOnly cookie
- [x] Update `middleware.ts` — add auth check before i18n routing

## Feature 3: Update README.md
- [x] Add deployment section with SST install, env vars, deploy commands, staging notes

## Feature 4: Production Theme Switcher in Header
- [x] Create `packages/ui/src/themes/theme-switcher.tsx` — production-quality component
- [x] Update `packages/ui/src/themes/index.ts` — export `ThemeSwitcher`
- [x] Update `header.tsx` — replace `DevThemeSwitcher` with `ThemeSwitcher`

## Feature 5: Coming Soon Overlay on Get-Started
- [x] Add `getStarted.comingSoon.*` i18n keys (EN + PT-BR)
- [x] Create `coming-soon-overlay.tsx` component
- [x] Update `get-started/page.tsx` — wrap form section with overlay
- [x] Update `sections/index.ts` — export overlay component

## Verification
- [x] `pnpm turbo build` passes
- [x] Production server test: robots.txt, theme switcher, coming soon overlay
