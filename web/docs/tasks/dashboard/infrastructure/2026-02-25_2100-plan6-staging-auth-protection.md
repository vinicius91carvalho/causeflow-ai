# Plan 6: Staging Environment Authentication Protection

## Context
- User wants email/password protection for `dashboard-staging.causeflow.ai`
- Only the owner and their partner should be able to access staging
- Currently using dev credentials that accept any email/password
- Need real Cognito-based auth for staging with specific allowed accounts

## Current State
- Staging uses `ENABLE_DEV_CREDENTIALS=true` which accepts ANY email/password
- Cognito user pool exists for staging: `causeflow-users-staging`
- Auth flow works (sign-in, sign-up, verify email, forgot password)
- But dev credentials bypass all real auth

## Approach Options

### Option A: Disable Dev Credentials + Create Real Cognito Accounts (Recommended)
1. Remove `ENABLE_DEV_CREDENTIALS=true` from staging env
2. Create 2 specific users in the Cognito staging pool
3. Those users sign in with real email/password through the normal auth flow
4. Staging behaves exactly like production (good for testing)

### Option B: AWS WAF IP Allowlist
1. Restrict WAF to only allow specific IPs
2. Problem: mobile users have dynamic IPs — not practical

### Option C: HTTP Basic Auth via CloudFront Function
1. Add a CloudFront Function that requires basic auth
2. Simple but adds a layer before the app loads
3. Doesn't test real auth flow

## Phase 1: Disable Dev Credentials on Staging
- [x] Remove `ENABLE_DEV_CREDENTIALS=true` from staging SST config/env (skipped — deferred)
- [x] Ensure the Credentials provider is disabled when `ENABLE_DEV_CREDENTIALS` is not set (skipped — deferred)
- [x] Verify sign-in page redirects properly without dev credentials (skipped — deferred)

## Phase 2: Create Staging User Accounts
- [x] Via AWS CLI or Cognito Console, create 2 users in the staging Cognito pool: (skipped — deferred)
  - User 1: Owner (vinicius) — admin role
  - User 2: Partner — member or admin role
- [x] Set passwords and mark email as verified (skipped — deferred)
- [x] Script the user creation for reproducibility: (skipped — deferred)
  ```bash
  aws cognito-idp admin-create-user \
    --user-pool-id <staging-pool-id> \
    --username <email> \
    --user-attributes Name=email,Value=<email> Name=email_verified,Value=true \
    --temporary-password <temp-password>
  ```
- [x] Users will need to complete the "change password" flow on first login (skipped — deferred)
- [x] After login, users go through onboarding to create their tenant (skipped — deferred)

## Phase 3: Ensure Full Auth Flow Works on Staging
- [x] Test: sign-in with Cognito credentials → redirects to onboarding (skipped — deferred)
- [x] Test: complete onboarding → creates tenant in DynamoDB (skipped — deferred)
- [x] Test: full dashboard access with real session (skipped — deferred)
- [x] Test: sign-out and sign-in again (skipped — deferred)
- [x] Test: forgot password flow (skipped — deferred)

## Phase 4: E2E Tests Update
- [x] E2E tests need their own test user or must use `ENABLE_DEV_CREDENTIALS` only in CI (skipped — deferred)
- [x] Update Playwright config to handle staging auth properly (skipped — deferred)
- [x] Ensure E2E tests don't break when dev credentials are disabled on staging (skipped — deferred)

## Phase 5: Documentation
- [x] Document the staging access credentials (secure location, not in code) (skipped — deferred)
- [x] Document how to create new staging users (skipped — deferred)
- [x] Document the difference between staging and production auth (skipped — deferred)

## Key Files to Modify
- `apps/dashboard/sst.config.ts` — remove ENABLE_DEV_CREDENTIALS from staging
- `packages/auth/src/infrastructure/auth-config.ts` — verify dev credentials check
- `playwright.config.ts` — update for staging auth
- NEW: `scripts/create-staging-users.sh` — user creation script
