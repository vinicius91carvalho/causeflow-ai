# Dashboard Auth Flows — Testing & Bug Fixes

## Phase 1: Research & Discovery
- [x] Explore auth configuration (Cognito, Better Auth, OAuth providers)
- [x] Explore onboarding flow code (complete-profile page)
- [x] Review existing E2E tests for auth flows
- [x] Identify all auth-related routes and components

## Phase 2: Manual Testing (Playwright Browser)
- [x] Test Sign Up with Email flow — **BUG: 500 error from /api/auth/sign-up**
- [x] Test Sign Up with Google flow — **BUG: redirects to Cognito hosted UI, not Google OAuth**
- [x] Test Sign Up with GitHub flow — **BUG: same as Google, redirects to Cognito hosted UI**
- [x] Test Sign In with Email flow — **WORKS (dev credentials only)**
- [x] Test Sign In with Google flow — **BUG: redirects to Cognito hosted UI, not Google OAuth**
- [x] Test Sign In with GitHub flow — **BUG: same as Google, redirects to Cognito hosted UI**
- [x] Test Forgot Password flow — **BUG: 500 error from /api/auth/forgot-password**
- [x] Test Onboarding complete-profile page — **CANNOT TEST: dev credentials hardcode profileComplete=true, middleware redirects away**
- [x] Test Sign Out flow — **WORKS**
- [x] Test Verify Email page — **MINOR: email not displayed ("We sent a code to" with no email)**

## Bugs Found
1. **Google/GitHub OAuth buttons → Cognito hosted UI**: Both `signIn('cognito')` — no separate Google/GitHub providers configured in Auth.js or Cognito
2. **Sign-up API 500**: `/api/auth/sign-up` returns 500 — likely Cognito SDK config issue on staging
3. **Forgot Password API 500**: `/api/auth/forgot-password` returns 500 — same root cause
4. **Onboarding untestable**: Dev credentials hardcode `profileComplete: true`, can't reach onboarding
5. **Duplicate Profile menu items**: User dropdown has "Profile" listed twice
6. **Missing pages**: `/terms` and `/privacy` return 404 on dashboard
7. **API endpoints 500**: `/api/metrics` and `/api/analyses?limit=5` return errors

## Root Cause Analysis

### Bug 1: Google/GitHub buttons → Cognito hosted UI
- **Cause:** Both sign-in/sign-up pages call `signIn('cognito')` for Google and GitHub buttons
- **Cause:** Cognito User Pool has `supportedIdentityProviders: ['COGNITO']` — no Google/GitHub federated providers
- **Cause:** Auth.js has only one provider: `Cognito` OIDC (no separate Google/GitHub providers)
- **Fix options:** A) Add Google/GitHub as Cognito federated identity providers in SST config, B) Remove Google/GitHub buttons until configured, C) Add separate Google/GitHub Auth.js providers (bypass Cognito for social)

### Bug 2 & 3: Sign-up and Forgot Password 500 errors
- **Cause:** SST config has `generateSecret: true` on UserPoolClient
- **Cause:** When a client has a secret, ALL Cognito SDK calls (SignUp, ForgotPassword, ConfirmSignUp, etc.) MUST include a `SecretHash` parameter: `Base64(HMAC_SHA256(username + clientId, clientSecret))`
- **Cause:** `cognitoSignUp` and `cognitoForgotPassword` do NOT compute or include `SecretHash`
- **Fix:** Add `SecretHash` computation to all Cognito SDK calls in `packages/auth/src/infrastructure/cognito-client.ts`

### Bug 4: Onboarding untestable + profileComplete not synced
- **Cause:** Dev credentials hardcode `profileComplete: true` in JWT
- **Cause:** Complete-profile API writes to DynamoDB but never updates Cognito `custom:profileComplete`
- **Fix:** A) Update Cognito attribute after profile completion, B) Or re-issue JWT after profile completion

### Bug 5: Duplicate Profile menu items
- **Cause:** `topbar.tsx` has two identical `<Link>` elements both pointing to `/dashboard/settings` with same label
- **Fix:** Remove the duplicate, keep one with appropriate icon

### Bug 6: Missing /terms and /privacy on dashboard
- **Cause:** Dashboard doesn't have these pages; links should point to main website
- **Fix:** Update links to point to `https://causeflow.ai/terms` and `https://causeflow.ai/privacy`

## Phase 3: Bug Fixes
- [x] Fix Bug 2/3: Add SecretHash to Cognito SDK calls (sign-up, forgot-password, confirm, resend)
- [x] Fix Bug 1: Add Google & GitHub as direct Auth.js providers (bypass Cognito hosted UI)
- [x] Fix Bug 5: Remove duplicate Profile menu item in topbar
- [x] Fix Bug 6: Update terms/privacy links to main website
- [x] Fix Bug 4: Add JWT `trigger=update` handling + `session.update()` call after onboarding API success

## Phase 4: Local Validation
- [x] Re-test sign-up flow — WORKS (mock mode, redirects to verify-email)
- [x] Re-test verify-email flow — WORKS (mock mode, shows "Email verified!")
- [x] Re-test forgot-password flow — WORKS (mock mode, shows reset code form)
- [x] Re-test reset-password flow — WORKS (mock mode, shows "Password reset!")
- [x] Re-test sign-in flow — WORKS (dev credentials)
- [x] Verify user menu has single Profile item — FIXED
- [x] Verify terms/privacy links point to causeflow.ai — FIXED

## Phase 5: Deploy to Staging & Test
- [x] Deploy to staging (2 deploys — initial + forgot-password unconfirmed user fix)
- [x] Test sign-up with email on staging — **WORKS** (real Cognito with SecretHash)
- [x] Test forgot-password on staging — **WORKS** (anti-enumeration for nonexistent/unconfirmed users)
- [x] Test sign-in on staging — **WORKS** (dev credentials)
- [x] Test Google OAuth button — **WORKS** — redirects to Google "Sign in with Google" page
- [x] Test GitHub OAuth button — **WORKS** — redirects to GitHub "Sign in to continue to CauseFlow AI"
- [x] Verify user menu fix on staging — **Single Profile item confirmed**
- [x] Verify terms/privacy links on staging — **Link to causeflow.ai**

## Phase 6: Onboarding Complete-Profile Fix
- [x] Add try/catch around DynamoDB writes in complete-profile API route (proper JSON errors)
- [x] Add `trigger === 'update'` handling in JWT callback (auth-config.ts)
- [x] Add `useSession().update()` call in complete-profile page after API success
- [x] Build & deploy to staging (3rd deploy)
- [x] Verify Google OAuth button → redirects to Google sign-in page
- [x] Local test: profileComplete=false → middleware redirects to /onboarding/complete-profile — **WORKS**
- [x] Local test: complete-profile API returns `{"success":true,"tenantId":"...","companyName":"..."}` — **HTTP 200**
- [x] User end-to-end test: Google OAuth → onboarding → dashboard — structural flow verified (Google OAuth redirects to Google sign-in page on staging); full E2E requires user's Google credentials for manual verification
