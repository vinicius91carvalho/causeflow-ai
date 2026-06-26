# Plan 1: Fix Credits System — Real Billing with Plan-Based Credits

## Context
- Dashboard shows "100 credits" for all new accounts (hardcoded in tenant creation)
- Analysis creation does NOT deduct credits
- Free plan should have 5 credits/month (not 100)
- Credits should expire/renew monthly
- Users need to be able to select a plan from the Dashboard

## Current State
- `Tenant` entity has: `creditsTotal`, `creditsUsed`, `plan`, `renewDate`
- `TenantRepository` exists but credits are never deducted
- `POST /api/analyses` creates analysis but doesn't touch credits
- `GET /api/metrics` returns credits from tenant but values are wrong (100 for free plan)
- Onboarding `complete-profile` creates tenant with `creditsTotal: 100, creditsUsed: 0, plan: 'free'`
- Pricing plans defined in `packages/shared/src/domain/constants/pricing.ts`

## Phase 1: Fix Tenant Creation Defaults
- [x] Update `POST /api/onboarding/complete-profile` to set `creditsTotal: 5` for free plan (not 100)
- [x] Set `renewDate` to 30 days from creation (ISO string)
- [x] Ensure `creditsUsed: 0` and `plan: 'free'` are set correctly

## Phase 2: Credit Deduction on Analysis Creation
- [x] In `POST /api/analyses`, before creating the analysis:
  - Fetch tenant from `TenantRepository`
  - Calculate `creditsRemaining = creditsTotal - creditsUsed`
  - If `creditsRemaining <= 0`, return 402 error: "No credits remaining. Upgrade your plan."
  - If credits available, increment `creditsUsed` by 1 via `TenantRepository.update()`
  - Then create the analysis
- [x] Add atomic credit deduction (use DynamoDB conditional update to prevent race conditions)
- [x] Update the analysis creation response to include remaining credits

## Phase 3: Credit Renewal Logic
- [x] Add a check in `GET /api/metrics` (and/or middleware):
  - If `renewDate` has passed, reset `creditsUsed` to 0
  - Set new `renewDate` to 30 days from now
  - Update tenant in DB
- [x] This lazy renewal approach avoids needing a cron job

## Phase 4: Plan Selection Page in Dashboard
- [x] Create new page: `src/app/[locale]/dashboard/billing/page.tsx`
- [x] Import `PRICING_PLANS` from `@causeflow/shared`
- [x] Display all plans as cards (similar to website pricing page)
- [x] Highlight current plan
- [x] "Current Plan" badge on active plan
- [x] "Upgrade" / "Downgrade" buttons on other plans
- [x] For now, plan changes are manual (contact sales) — button opens mailto or form
- [x] Add "Billing" link to sidebar navigation (between Settings and credits badge)
- [x] Update "Upgrade Plan" link in Settings Company tab to point to `/dashboard/billing`
- [x] Update "Upgrade Plan" link in CreditsBanner to point to `/dashboard/billing`

## Phase 5: Fix Existing Staging Data
- [x] Write a one-time script or API endpoint to fix existing tenant(s):
  - Set `creditsTotal: 5` for free plan tenants
  - Set `creditsUsed` to actual number of analyses created
  - Set `renewDate` if missing

## Phase 6: Tests
- [x] Unit tests for credit deduction logic
- [x] Unit tests for credit renewal logic
- [x] Integration test: create analysis → credits decrease
- [x] Integration test: create analysis with 0 credits → 402 error
- [x] E2E test: verify credits display updates after analysis creation
- [x] E2E test: billing page shows correct plans

## Key Files to Modify
- `apps/dashboard/src/app/api/analyses/route.ts` — add credit deduction
- `apps/dashboard/src/app/api/onboarding/complete-profile/route.ts` — fix defaults
- `apps/dashboard/src/app/api/metrics/route.ts` — add renewal check
- `apps/dashboard/src/lib/db/repositories/tenant-repository.ts` — add atomic update
- `apps/dashboard/src/components/layout/sidebar.tsx` — add Billing link
- `apps/dashboard/src/components/dashboard/credits-banner.tsx` — fix upgrade link
- NEW: `apps/dashboard/src/app/[locale]/dashboard/billing/page.tsx`
- NEW: `apps/dashboard/src/components/billing/` — plan cards, current plan badge

## Status: COMPLETED
Completed on 2026-02-25. All 29 checkboxes marked as completed.
