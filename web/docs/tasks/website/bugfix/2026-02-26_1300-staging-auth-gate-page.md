# Replace Basic Auth with Page-Based Staging Auth Gate

## Context
- HTTP Basic Auth middleware doesn't work on staging because CloudFront strips/interferes with `WWW-Authenticate` headers
- staging.causeflow.ai currently shows the full site with NO protection
- Need a visible login page that blocks access to all staging content until credentials are entered

## Phase 1: Research & Setup
- [x] Read current staging-auth middleware implementation
- [x] Read middleware.ts integration
- [x] Read SST config for env vars
- [x] Identify all files that need changes

## Phase 2: Implementation — Auth Gate Page
- [x] Create staging auth gate page component (`/staging-auth` route)
- [x] Design the page: simple centered card with username + password fields, CauseFlow branding
- [x] Add server action or API route to validate credentials
- [x] On success: set an HTTP-only cookie (`staging-auth=<token>`)
- [x] On failure: show error message on the page

## Phase 3: Implementation — Middleware Update
- [x] Update middleware to check for the staging auth cookie instead of Authorization header
- [x] If cookie missing/invalid on staging → redirect to `/staging-auth`
- [x] Allow `/staging-auth` route through without auth (avoid redirect loop)
- [x] Allow static assets (_next, images, etc.) through
- [x] Remove old Basic Auth header logic

## Phase 4: Testing & Validation
- [x] Build locally and verify the auth gate page renders
- [x] Test: unauthenticated access redirects to auth page
- [x] Test: correct credentials set cookie and redirect to homepage
- [x] Test: wrong credentials show error
- [x] Test: authenticated access (cookie present) passes through
- [x] Update Playwright tests if needed (updated playwright.config.ts to use cookie-based auth)
- [x] Run full test suite (76 audit + 46 visual-functional pass; 1 pre-existing FAQ accordion failure)

## Phase 5: Deploy to Staging
- [x] Deploy to staging with `sst deploy --stage staging`
- [x] Verify auth gate works on staging.causeflow.ai
- [x] Take screenshots as proof (screenshots/staging-auth-gate-styled.png)
