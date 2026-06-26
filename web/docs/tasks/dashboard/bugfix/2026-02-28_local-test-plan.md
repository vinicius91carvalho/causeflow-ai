# Local Dashboard Testing Plan — Auth Flow Fixes

## Context

We deployed commit `fa88ba0` to staging with auth flow fixes (OAuth onboarding bypass, account linking, profileComplete defaults). Staging sign-up API returns 500, which is a pre-existing issue unrelated to our changes. We need to run all tests locally to verify everything works.

## Key Fact: Local Dashboard Uses Dev Credentials Provider

The dashboard at `127.0.0.1:3001` has `ENABLE_DEV_CREDENTIALS=true` in `.env.local`. This means:
- The Credentials provider accepts **any email/password** — no Cognito needed
- Sign-in flow: email+password → Auth.js Credentials provider → JWT with `profileComplete: true`, `tenantId: 'tenant-e2e-test'`
- The dev credentials path is **NOT affected** by our changes (lines 172-176 in auth-config.ts are untouched)
- Our changes affect: Google OAuth path, GitHub OAuth path, Cognito OIDC path, session callback defaults, middleware defaults

## What We're Testing Locally

### 1. Unit Tests (Vitest) — All 537+ tests
```bash
pnpm vitest run
```
Covers: all packages (shared, forms, analytics, auth, ui, website, dashboard)
Critical: `complete-profile.test.ts` — verifies our `getUser` mock + duplicate tenant prevention

### 2. Dashboard Playwright E2E Tests — Against Local Dev Server
```bash
# Kill existing servers
pkill -f "next-server|next start|next dev" 2>/dev/null

# Build dashboard (required for `next start` which Playwright config uses)
pnpm turbo build --filter=dashboard

# Run dashboard E2E tests (playwright.config.ts auto-starts dashboard on port 3001)
DASHBOARD_URL=http://127.0.0.1:3001 pnpm exec playwright test tests/dashboard/
```

Dashboard tests available:
- `tests/dashboard/auth.spec.ts` — Sign-in/up page rendering, form validation, middleware redirects, nav, accessibility (~70 tests)
- `tests/dashboard/auth-setup.ts` — Auth setup (signs in via dev credentials, saves session to `.auth/user.json`)
- `tests/dashboard/dashboard.spec.ts` — Dashboard overview (requires auth)
- `tests/dashboard/onboarding.spec.ts` — Onboarding flow
- `tests/dashboard/analyses.spec.ts` — Analyses pages
- `tests/dashboard/integrations.spec.ts` — Integrations page
- `tests/dashboard/settings.spec.ts` — Settings pages
- `tests/dashboard/team.spec.ts` — Team management

### 3. Website Playwright E2E Tests (sanity — our changes shouldn't affect website)
```bash
BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/audit.spec.ts tests/visual-functional.spec.ts
```

## Execution Steps

### Phase 1: Unit Tests
```bash
# Run all unit tests
pnpm vitest run
```
**Expected**: All 537+ tests pass, including the updated `complete-profile.test.ts`

### Phase 2: Build Dashboard
```bash
# Kill any running servers
pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f playwright 2>/dev/null

# Build dashboard (Playwright webServer config runs `next start`, which needs a build)
pnpm turbo build --filter=dashboard
```

### Phase 3: Run Dashboard Auth E2E Tests
```bash
# Auth tests don't need a pre-authenticated session — they test the sign-in/sign-up UI
DASHBOARD_URL=http://127.0.0.1:3001 pnpm exec playwright test tests/dashboard/auth.spec.ts --project=chromium-desktop
```
**Expected**: All auth UI tests pass (middleware redirects, form validation, navigation, accessibility)

### Phase 4: Run Full Dashboard E2E Suite
The auth-setup.ts signs in via dev credentials and saves session cookies. Other dashboard tests use this saved session.

```bash
# Run auth-setup first to create session, then all dashboard tests
DASHBOARD_URL=http://127.0.0.1:3001 pnpm exec playwright test tests/dashboard/ --project=chromium-desktop
```
**Expected**: All dashboard E2E tests pass

### Phase 5: Run Website E2E Tests (sanity check)
```bash
# Build website first
pnpm turbo build --filter=website

# Run website tests
pnpm exec playwright test tests/audit.spec.ts tests/visual-functional.spec.ts --project=chromium-desktop
```
**Expected**: Website tests unaffected by our changes

### Phase 6: Investigate Sign-Up 500 Error
The staging sign-up API (`/api/auth/sign-up`) returns 500 for ALL new emails. This is pre-existing — not caused by our changes. But we should investigate:

```bash
# Find and read the sign-up API route
cat apps/dashboard/src/app/api/auth/sign-up/route.ts
```

Check:
- Does it call Cognito `SignUp`? If so, are Cognito credentials (`AUTH_COGNITO_ID`, `AUTH_COGNITO_SECRET`, `AUTH_COGNITO_ISSUER`) properly configured in staging env?
- Does the Cognito User Pool allow self-sign-up?
- Are there any missing env vars that would cause a 500?

### Phase 7: Document Results
After all tests pass:
1. Update task file `docs/tasks/dashboard/bugfix/2026-02-28_1200-dashboard-auth-flow-fix.md`
2. Update session-learnings.md with findings
3. Update MEMORY.md if any new patterns emerged

## Environment Details

| Setting | Value |
|---|---|
| Dashboard dev URL | `http://127.0.0.1:3001` |
| Website dev URL | `http://127.0.0.1:3000` |
| Dashboard .env.local | Has `ENABLE_DEV_CREDENTIALS=true`, Google/GitHub OAuth creds, no Cognito |
| DynamoDB | Not set locally → uses in-memory dev store |
| Playwright config | `playwright.config.ts` at project root, chromium only, 4 viewports |
| Playwright webServer | Auto-starts dashboard on 3001 and website on 3000 via `next start` |

## Files Changed in This Fix (for reference)

| File | Change |
|---|---|
| `apps/dashboard/src/lib/db/repositories/user-repository.ts` | Added `getUserByEmail()` + `ScanCommand` import |
| `packages/auth/src/infrastructure/auth-config.ts` | Fixed fail-safe (`false`), session default (`false`), email param, unified Cognito path |
| `apps/dashboard/src/lib/auth.ts` | Email fallback + account linking in `getUserProfile` |
| `apps/dashboard/src/middleware.ts` | `profileComplete` default: `true` → `false` |
| `apps/dashboard/src/app/api/onboarding/complete-profile/route.ts` | Duplicate tenant prevention |
| `apps/dashboard/src/app/api/onboarding/__tests__/complete-profile.test.ts` | Added `getUser` mock |

## Critical Verification Points

1. **Middleware redirect**: Unauthenticated → `/auth/sign-in` (tests in auth.spec.ts)
2. **Dev credentials still work**: Sign in with any email/password → lands on dashboard (auth-setup.ts)
3. **Onboarding form**: Submitting complete-profile creates tenant correctly (unit test)
4. **No regressions**: All existing 537+ unit tests and all dashboard E2E tests pass
