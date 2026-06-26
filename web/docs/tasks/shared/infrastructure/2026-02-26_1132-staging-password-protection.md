# Staging Password Protection (Basic Auth Middleware)

Add password-based access control to both website and dashboard apps that activates **only** in the staging environment. Uses HTTP Basic Auth via Next.js middleware — simple, no UI needed, browser-native prompt.

## Phase 1: Research & Setup
- [x] Read current middleware files for both apps
- [x] Identify environment variable pattern for staging detection

## Phase 2: Implementation

### Shared logic
- [x] Create a shared `stagingAuth` helper in `packages/shared` that checks Basic Auth credentials against env var `STAGING_PASSWORD`
- [x] Only activates when `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'`
- [x] Returns 401 with `WWW-Authenticate: Basic` header if not authenticated
- [x] Passes through if authenticated or not staging

### Website middleware
- [x] Integrate staging auth check into `apps/website/src/middleware.ts` — runs before i18n logic
- [x] Skip auth for `_next`, `api`, and static assets

### Dashboard middleware
- [x] Integrate staging auth check into `apps/dashboard/src/middleware.ts` — runs before auth/i18n logic
- [x] Skip auth for `_next`, `api`, and static assets

### SST config
- [x] Add `STAGING_PASSWORD` env var to `apps/website/sst.config.ts` (staging only)
- [x] Add `STAGING_PASSWORD` env var to `apps/dashboard/sst.config.ts` (staging only)

## Phase 3: Validation
- [x] Verify local dev (no STAGING_PASSWORD set) — no auth prompt
- [x] Verify with `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging` + `STAGING_PASSWORD=test` — auth prompt appears
- [x] Verify correct password grants access
- [x] Verify wrong password returns 401
