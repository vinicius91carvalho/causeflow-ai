# Fix Dashboard Auth Flow: OAuth Onboarding, Account Linking, Data Cleanup

## Bug Report
- **Symptom:** Google OAuth login bypasses onboarding; re-signup with same email fails
- **Expected:** OAuth users see onboarding; same email across providers links accounts
- **Root Causes:** Fail-safe sets `profileComplete = true`, defaults mask missing data, no email-based account linking

## Phase 1: Reproduce & Isolate
- [x] Read all affected files and confirm root causes
- [x] Identify exact lines to change

## Phase 2: Fix & Verify
- [x] 1. Add `getUserByEmail()` to UserRepository
- [x] 2. Expand `GetUserProfileFn` type signature (add email param)
- [x] 3a. Fix fail-safe catch block (`profileComplete = true` → `false`)
- [x] 3b. Pass email to `getUserProfile` in JWT callback
- [x] 3c. Unify Cognito OIDC path to use `getUserProfile`
- [x] 3d. Fix session callback default (`?? true` → `?? false`)
- [x] 4. Update `getUserProfile` callback with email lookup + account linking
- [x] 5. Fix middleware `profileComplete` default
- [x] 6. Prevent duplicate tenant creation during onboarding

## Phase 4: Validation
- [x] TypeScript check passes (`pnpm turbo check-types`)
- [x] Lint passes (`pnpm exec biome check .`)
- [x] Build succeeds (`pnpm turbo build`)
- [x] Unit tests pass (`pnpm vitest run`) — 608/608 pass
- [x] Dashboard auth E2E: 69/73 pass, 4 PRoot concurrency flakes (pass individually)

## Phase 5: Additional Fixes (commit `834e079`)
- [x] Fix Cognito SecretHash — all 5 Cognito operations now compute `HMAC-SHA256(secret, username+clientId)`
- [x] Fix logo selectors in auth/onboarding E2E tests (`text=CF` → `img[alt="CauseFlow AI"]`)
- [x] Fix React controlled input fill issues (`pressSequentially` for forgot-password email + sign-up name)
- [x] Fix resend cooldown test (handle button text change during countdown)
- [x] Fix forgot-password error test (text-based locator vs CSS class)
- [x] Add Playwright `dashboard-setup` + `dashboard-authed` projects for authenticated tests

## Phase 6: Compound
- [x] Document learnings in task file
- [x] Update session-learnings.md if needed

## Learnings

### Root Cause
Five fail-safe defaults conspired to let new OAuth users bypass onboarding:
1. `auth-config.ts` catch block set `profileComplete = true` on DB errors — meant to protect returning users but let new users through
2. `auth-config.ts` session callback used `?? true` — masked undefined as "complete"
3. `middleware.ts` used `?? true` — same masking
4. Cognito OIDC path read custom attributes that were never set during sign-up
5. No email-based account linking meant same email across providers created separate identities

### Fix Pattern
- **Fail-safe direction matters**: When uncertain, default to the safer UX path (onboarding) not the "happy" path (dashboard). Worst case: returning user sees onboarding briefly. Better than new user seeing an empty dashboard.
- **Account linking via email**: Look up by subject ID first (fast GSI1), then fall back to email scan. Create a linked record on first match so future lookups are fast.
- **Duplicate tenant prevention**: Before creating a new tenant in onboarding, check if user already has a linked account with an existing tenant.

### What caused the bug
The original fail-safe logic was designed to protect returning OAuth users from being sent back to onboarding if the DB lookup failed. But this logic also applied to brand-new users (who have no DB record), causing them to skip onboarding entirely.

### Prevention
- Default `profileComplete` to `false` everywhere — it's always safer to redirect to onboarding than to an empty dashboard
- Test mock must match production interface — added `getUser` to test mock after adding it to the endpoint

### Cognito SecretHash (pre-existing staging bug)
- Staging sign-up returned 500 for all new emails — root cause: `generateSecret: true` on Cognito app client but no SecretHash sent in API calls
- Fix: `computeSecretHash(username)` → `Base64(HMAC-SHA256(clientSecret, username+clientId))`
- Applied to all 5 Cognito operations in `cognito-client.ts`

### Playwright + React Controlled Inputs
- `fill()` can fail to trigger React's `onChange` in Next.js production builds — the DOM value is set but React state stays empty
- `pressSequentially()` with `{ delay: 10 }` reliably fires React's synthetic events character by character
- Use `pressSequentially` for any controlled input where form submission depends on React state
- PRoot environment causes ~5% flake rate under parallel test execution (3 workers × 73 tests); tests pass individually
