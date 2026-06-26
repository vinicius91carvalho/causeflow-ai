# Dashboard Staging Bugfixes Batch (8 Issues)

## Root Cause Analysis

**Critical discovery**: Bugs 1, 3, 5, 6 share a root cause — `user-repository.ts:getUser()` uses `limit: 1` on GSI1, and the user has TWO tenant records in DynamoDB (from onboarding twice). The wrong record gets returned, causing the JWT to have `role: 'member'` and `tenantId: null` on session refresh.

**DynamoDB state (user vinicius91carvalho@gmail.com)**:
- Tenant 1: `tenant-1772053327314-x5dmhs3` (100 credits, old)
- Tenant 2: `tenant-1772097539264-hxjdbg3` (5 credits, current, admin)
- User records exist under BOTH tenants via GSI1

---

## Phase 1: Fix Auth Root Cause (fixes bugs 1, 3, 5, 6)
- [x] Fix `getUser()` in `user-repository.ts` — remove `limit: 1`, find record with `profileComplete: true`
- [x] Add try/catch error handling to `GET /api/analyses` route handler
- [x] Verify `withAuth` returns proper JSON error for missing tenantId

## Phase 2: Sidebar Credits (bug 8 — credits showing 100)
- [x] Replace hardcoded `{ count: 100 }` in `sidebar.tsx` with real credits from API
- [x] Create `use-credits.ts` hook to fetch from `/api/metrics`

## Phase 3: Dashboard Scroll Fix (bug 8 — unnecessary scroll)
- [x] Reduced EmptyState padding (py-14→py-8, mt-10→mt-6) to prevent overflow

## Phase 4: Profile Photo Margin (bug 2)
- [x] Added `mt-4` to avatar wrapper in `profile-tab.tsx`

## Phase 5: Billing PRO Plan Styling (bug 4)
- [x] Applied emerald-600 bg, white text, white CTA to PRO plan card (matches website)

## Phase 6: Integration Connection Modal + DynamoDB (bug 7)
- [x] Connection modal already exists with per-type config fields (all 15 integrations)
- [x] DynamoDB persistence via integration-repository with KMS encryption
- [x] Modal wired to connect button in integrations-client.tsx

## Phase 7: Deploy & Verify on Staging
- [x] Deploy to staging: `(cd apps/dashboard && sst deploy --stage staging)` — deployed successfully
- [x] Health API verified: `{"status":"ok"}`
- [x] Analyses API returns proper JSON error (401) instead of raw 500
- [ ] Manual verification needed: Google OAuth blocks headless browsers, user must verify visually

## Notes
- User has 3 tenant records from onboarding 3 times. The `getUser()` fix now sorts by `createdAt` DESC and picks the most recent `profileComplete: true` record.
- User must **sign out and sign back in** with Google OAuth for the auth fix to take effect (JWT needs to be rebuilt).
