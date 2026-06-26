# Block Non-Beta Users at Login (All Auth Methods)

## Context (The Why)
Currently, the beta access gate is enforced at the dashboard **layout level** — users can sign in successfully but get redirected to `/beta-waitlist` after authentication. The user wants to block login itself, so non-beta users never complete authentication regardless of method (OAuth2 or email/password).

## Definition (The What)
Add an Auth.js `signIn` callback that checks the beta allowlist before allowing sign-in. If the email is not on the beta list, deny the sign-in and redirect back to the sign-in page with a clear error message. This applies to all auth methods: Cognito OIDC, Google OAuth, GitHub OAuth, and email/password credentials.

## Acceptance Criteria (The How to Test)
- [ ] Non-beta email via email/password login → stays on sign-in page, shows beta access denied message
- [ ] Non-beta email via Google OAuth → redirected back to sign-in page with beta access denied message
- [ ] Non-beta email via GitHub OAuth → redirected back to sign-in page with beta access denied message
- [ ] Beta-listed email via any method → login succeeds normally
- [ ] Staging/dev environment → all emails allowed (gate bypassed)
- [ ] Error message is clear and user-friendly (not generic auth error)

## Restrictions (The Boundaries)
- Do NOT remove the existing layout-level beta gate (keep as defense-in-depth)
- Follow the existing injection pattern (callback in AuthConfigOptions, dynamic import in dashboard auth.ts) — do NOT import dashboard-specific code directly in packages/auth
- Dev credentials provider should bypass beta check (same as staging/dev)

## Phase 1: Research & Setup
- [x] Read `packages/auth/src/infrastructure/auth-config.ts` — understand AuthConfigOptions and callback injection pattern
- [x] Read `apps/dashboard/src/contexts/identity/lib/auth.ts` — understand how callbacks are injected
- [x] Read `apps/dashboard/src/contexts/identity/infrastructure/beta-allowlist-repository.ts` — understand isEmailAllowed
- [x] Read `apps/dashboard/src/contexts/identity/presentation/pages/sign-in-page.tsx` — understand error display
- [x] Read dashboard i18n files for existing error messages

## Phase 2: Implementation
- [x] Add `isEmailOnBetaList?: (email: string) => Promise<boolean>` to `AuthConfigOptions` in `packages/auth/src/infrastructure/auth-config.ts`
- [x] Add `signIn` callback to `createAuthConfig` that checks `isEmailOnBetaList` — return `'/auth/sign-in?error=BetaAccessDenied'` if not allowed
- [x] Wire up `isEmailOnBetaList` in `apps/dashboard/src/contexts/identity/lib/auth.ts` using dynamic import of beta-allowlist-repository
- [x] Add `BetaAccessDenied` case to `authErrorToMessage` in `sign-in-page.tsx`
- [x] Add i18n error message for beta access denied in EN and PT-BR identity i18n files
- [x] Handle credentials sign-in: since `redirect: false` is used client-side, ensure the error propagates correctly

## Phase 3: Testing
- [ ] Write unit test for signIn callback beta check logic
- [x] Verify build passes (`pnpm turbo build`)
- [x] Verify lint passes (`pnpm exec biome check .`)
- [x] Verify type check passes (`pnpm turbo check-types`)
- [x] Run existing tests (`pnpm turbo test`) — 739/739 pass

## Phase 4: Validation
- [ ] Start dev server and test sign-in flow
- [ ] Verify error message displays correctly on sign-in page
- [x] Code review (clean, no debug code, no unused imports)
- [x] Security check — no credential leakage in error responses

## Phase 6: Compound
- [ ] Capture learnings
