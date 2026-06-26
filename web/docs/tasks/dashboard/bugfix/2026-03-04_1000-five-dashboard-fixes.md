# Five Dashboard Bug Fixes

## Context (The Why)
Five user-reported issues affecting the dashboard experience: billing display bugs, incorrect email, settings layout inconsistency, and duplicate user creation.

## Acceptance Criteria (The How to Test)
- [x] "Renews on" label shows the actual renewal date
- [x] Confetti appears only after Stripe redirect (plan upgrade success), not on button click
- [x] All instances of hello@causeflow.ai replaced with adm@causeflow.ai
- [x] All Settings tabs (Profile, Company, Notifications, Appearance) have consistent top spacing
- [x] Team tab shows no duplicate users for the same email (OAuth linking doesn't create duplicates)

## Restrictions (The Boundaries)
- Do not change Stripe integration logic beyond confetti timing
- Do not alter auth flow beyond fixing duplication
- Do not modify billing plan pricing or features

## Bug Reports

### Bug 1: "Renews on" label shows no date
- **Symptom:** Billing page shows "Renews on" with nothing after it
- **Expected:** Should show "Renews on Mar 15, 2026" (or similar formatted date)
- **Files:** `billing-page.tsx:248`, i18n messages

### Bug 2: Confetti fires on button click instead of after upgrade
- **Symptom:** Confetti animation plays when user clicks plan select button
- **Expected:** Confetti should play when user returns from Stripe after successful upgrade
- **Files:** `billing-page.tsx:381`, `confetti.ts`

### Bug 3: Wrong email address
- **Symptom:** hello@causeflow.ai used in billing page and SITE constant
- **Expected:** adm@causeflow.ai everywhere
- **Files:** `site.ts:8`, `billing-page.tsx:496,741,744`

### Bug 4: Settings tab spacing inconsistency
- **Symptom:** Profile tab has margin-top, other tabs (Company, Notifications, Appearance) don't
- **Expected:** All tabs should have consistent spacing below the tab navigation
- **Files:** `settings-page.tsx`, individual tab components

### Bug 5: Duplicate users from OAuth
- **Symptom:** 3 users with same email on Team tab after Google OAuth registration
- **Expected:** OAuth linking should reuse existing user, not create duplicates
- **Files:** `auth.ts:46`, `user-repository.ts`, `team/route.ts`

## Phase 1: Reproduce & Isolate
- [x] Investigate "Renews on" date rendering logic
- [x] Investigate confetti trigger location and Stripe redirect flow
- [x] Find all hello@causeflow.ai occurrences
- [x] Investigate settings tab component spacing
- [x] Investigate OAuth user creation and team listing duplication

## Phase 2: Fix & Verify

### Group A: Billing page fixes (Issues 1, 2, 3)
- [x] Fix "Renews on" to display the formatted date
- [x] Move confetti from button click to post-Stripe-redirect success
- [x] Replace hello@causeflow.ai with adm@causeflow.ai in site.ts and billing-page.tsx

### Group B: Settings spacing (Issue 4)
- [x] Add consistent margin-top/spacing to all settings tab content panels

### Group C: Duplicate users (Issue 5)
- [x] Fix OAuth account linking to prevent duplicate user creation
- [x] Clean up or deduplicate existing team listing

## Phase 4: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all passing (759 tests, 66 files)

## Phase 6: Compound
- [x] Document fixes in task file learnings
- [x] Update session-learnings.md if patterns are reusable

## Learnings

### Bug 1: "Renews on" — next-intl eagerly processes ICU placeholders
**Root cause:** `page.tsx` called `t('renewsOn', { date: '' })` which made next-intl substitute `{date}` with empty string before the client component could do `.replace('{date}', formattedPeriodEnd)`.
**Fix:** Used `getMessages()` to get raw unprocessed strings for template messages that the client component substitutes at render time.
**Rule:** When passing i18n messages to client components that do their own interpolation, use raw messages via `getMessages()` — not `t()` which eagerly processes placeholders.

### Bug 2: Confetti timing — trigger on URL params, not user action
**Fix:** Added `useEffect` that detects `?success=1` URL param from Stripe redirect. Cleans params with `history.replaceState()` to prevent replay on refresh.

### Bug 3: Email — use SITE constant instead of hardcoding
**Fix:** Updated `SITE.email` to `adm@causeflow.ai` and replaced hardcoded emails with `SITE.email` in billing-page.tsx and navigation.ts.
**Rule:** Always use `SITE.email` from shared constants — never hardcode email addresses.

### Bug 4: Settings spacing — redundant margin on Profile tab
**Root cause:** Profile tab had `mt-4` on avatar div while container already provided `space-y-6`. Other tabs had no such extra margin.
**Fix:** Removed `mt-4` from profile-tab.tsx.

### Bug 5: OAuth duplicate users — account linking created new records
**Root cause:** `getUserProfile()` in auth.ts created a NEW user record with the OAuth subject ID when finding an existing user by email. This meant DynamoDB had both `USER#cognito-sub` and `USER#google-sub` for the same email+tenant.
**Fix:** Removed `createUser()` call — now returns existing user profile directly. Added `deduplicateByEmail()` safety net in `getUsersByTenant()` for existing duplicates in production.
**Rule:** OAuth account linking should NEVER create duplicate user records. When an existing user is found by email, return their existing profile.

## Files Modified
- `apps/dashboard/src/app/[locale]/dashboard/billing/page.tsx` — raw messages for template strings
- `apps/dashboard/src/components/billing/billing-page.tsx` — confetti useEffect, SITE.email, raw messages
- `apps/dashboard/src/components/settings/profile-tab.tsx` — removed redundant mt-4
- `apps/dashboard/src/lib/auth.ts` — removed duplicate user creation in OAuth linking
- `apps/dashboard/src/lib/db/repositories/user-repository.ts` — added deduplicateByEmail()
- `packages/shared/src/domain/constants/site.ts` — email → adm@causeflow.ai
- `packages/shared/src/domain/constants/navigation.ts` — use SITE.email
