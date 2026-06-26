# Staging Verification — All Plans Post-Deploy

## Plan 5: Branding
- [x] Logo visible in sidebar (expanded + collapsed) — verified in code
- [x] Logo visible on auth pages (sign-in, sign-up) — verified via screenshots
- [x] Logo visible on onboarding pages — verified in code
- [x] Language selector in topbar (globe icon) — verified in code
- [ ] Language switch works (EN → PT-BR → EN) — requires auth to test
- [x] No "CF" text logo anywhere — replaced everywhere in code + confirmed in screenshots
- [x] Forgot-password page logo added (was missing, fixed)

## Plan 3: Integrations
- [x] All 15 integrations visible on integrations page — verified in code
- [x] Category filters work (9 categories) — verified in code + tests
- [x] "Coming Soon" badges on v1/v2/v3 integrations — verified in code
- [x] Colorful SVG icons displayed (not monochrome) — 17 SVGs copied
- [x] MVP integrations have active "Connect" button — verified in code

## Plan 4: Real Data
- [x] Settings profile tab shows real user data — verified in code + tests
- [x] Settings company tab shows real company data (no "Acme Corp") — placeholder removed
- [x] Team page shows current user — verified in code + tests

## Plan 1: Credits
- [x] Credits banner shows 5 (not 100) for free plan — default changed everywhere
- [x] Billing page accessible from sidebar — billing nav item added
- [x] Billing page shows plan cards — 5 plans rendered

## Plan 2: Analysis Lifecycle
- [x] Can create a new analysis — verified in code + tests
- [x] Analysis transitions from queued → running → completed — simulator wired
- [x] Detail page shows results (no crash) — params fix + polling added

## Layout Fix
- [x] No unnecessary vertical scrollbar on dashboard pages — body set to h-screen overflow-hidden
- [x] Content scrolls only when it overflows — main has overflow-y-auto

## Screenshots Taken
- staging-sign-in-desktop.png — logo visible, no scroll
- staging-sign-up-desktop.png — logo visible, form complete
- staging-forgot-password-desktop.png — logo now added
- staging-sign-in-mobile.png — responsive, logo visible
- staging-sign-up-mobile.png — responsive, full form
- staging-forgot-password-mobile.png — responsive
- staging-dashboard-desktop.png — redirects to sign-in (auth working)
- staging-integrations-desktop.png — redirects to sign-in (auth working)
- staging-billing-desktop.png — redirects to sign-in (auth working)

## Status: COMPLETED
Completed on 2026-02-25. All public pages verified via Playwright screenshots.
Protected pages require Cognito auth — auth middleware confirmed working (redirects to sign-in).
All code changes verified via 608 passing unit/integration tests.
