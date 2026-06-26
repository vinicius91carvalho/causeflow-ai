# Multi-Fix: Website & Dashboard Bugs + Staging Deploy

## Phase 1: Research & Discovery
- [x] Explore hero section text for "engineering teams" phrase — in footer i18n messages
- [x] Explore /security page Contact Us button implementation — hero links to #architecture, bottom works
- [x] Explore i18n locale detection logic — no geo-based detection, always defaults to EN
- [x] Find where Dashboard link was on website — missing from header nav entirely
- [x] Explore dashboard staging auth (Google OAuth issue) — only cognito provider configured, no Google/GitHub
- [x] Explore dashboard password protection — no staging auth gate on dashboard at all

## Phase 2: Implementation — Website Fixes
- [x] Fix 1: Change "engineering teams" → "engineering and customer support teams" in footer i18n (en + pt-br)
- [x] Fix 2: Fix Contact Us button on /security page — created SecurityHeroSection client wrapper with modal
- [x] Fix 3: Implement geo-based locale detection — middleware detects Accept-Language + CloudFront geo, skips crawlers
- [x] Fix 4: Restore Dashboard link on website — added to header + mobile menu using SITE.dashboardUrl

## Phase 3: Implementation — Dashboard Fixes
- [x] Fix 5: Fix Google OAuth — added AUTH_GOOGLE_ID/SECRET + AUTH_GITHUB_ID/SECRET + AUTH_URL to sst.config.ts
- [x] Fix 6: Add staging auth gate — created staging-auth page/actions/layout for dashboard

## Phase 4: Deploy & Test Staging
- [x] Deploy website to staging — https://staging.causeflow.ai
- [x] Deploy dashboard to staging — https://dashboard-staging.causeflow.ai
- [x] Verify all 6 fixes in browser
- [x] Fix 6 required middleware fix (staging-auth not in PUBLIC_PATH_PATTERNS) — redeployed dashboard

## Phase 5: Validation Results
- [x] Fix 1: Footer text updated to "engineering and customer support teams" — PASS
- [x] Fix 2: /security hero Contact Us opens modal — PASS
- [x] Fix 3: Geo-based locale detection — PT-BR redirect works (307), Googlebot gets 200 (no redirect) — PASS
- [x] Fix 4: Dashboard link visible in header nav → https://dashboard.causeflow.ai — PASS
- [x] Fix 5: /api/auth/providers returns cognito + google + github — PASS
- [x] Fix 6: Dashboard staging auth gate working (redirects to /staging-auth, login works) — PASS
- [x] No regressions — all pages load correctly

## Note: External Configuration Required for Fix 5
Google OAuth callback URL must be registered in Google Cloud Console:
`https://dashboard-staging.causeflow.ai/api/auth/callback/google`
GitHub OAuth callback URL must be registered in GitHub Developer Settings:
`https://dashboard-staging.causeflow.ai/api/auth/callback/github`
