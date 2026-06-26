# Test & Deploy: Password Auth and Email Collection

## Phase 1: Local Testing
- [x] Build website locally
- [x] Start production server
- [x] Test staging password protection (correct/wrong password)
- [x] Test email submission via /api/notify (fixed Formspree ID: mpqjooalFsd → mpqjooal)
- [x] Check all pages for console errors (0 errors)
- [x] Check all pages render without visual errors (all 18 routes return 200, EN + PT-BR)

## Phase 2: Fix Issues
- [x] Fix any issues found in Phase 1 (fixed Formspree ID in .env.local: mpqjooalFsd → mpqjooal)

## Phase 3: Deploy to Staging
- [x] Deploy to staging environment (https://staging.causeflow.ai)
- [x] Test staging password on staging.causeflow.ai (works correctly)
- [x] Test email submission on staging (success: "You're on the list!")
- [x] Check pages and console for errors on staging (only pre-existing favicon.svg 404)

## Phase 4: Deploy to Production
- [x] Deploy to production environment (https://causeflow.ai)
- [x] Test password on production (works correctly)
- [x] Test email submission on production (success: "You're on the list!")
- [x] Check pages and console for errors on production (0 errors)

## Phase 5: Commit & Push
- [x] Commit all changes
- [x] Push to CodeCommit
