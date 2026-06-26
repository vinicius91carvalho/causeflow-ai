# Phase 2: Authentication (Cognito + Auth.js)

## Phase 2.1: Research & Setup
- [x] Study Auth.js v5 (next-auth) documentation — Cognito provider, middleware, session handling
- [x] Study AWS Cognito User Pool configuration — social federation, Lambda triggers, custom attributes
- [x] Study the existing dashboard middleware.ts to understand current i18n routing
- [x] Study the existing dashboard layout to understand where auth components will integrate
- [x] Determine Auth.js v5 package versions compatible with Next.js 15

## Phase 2.2: Create Auth Package (`packages/auth/`)
- [x] Create `packages/auth/` directory structure following clean architecture
- [x] Create `packages/auth/package.json` with dependencies (next-auth, @auth/core, @aws-sdk/client-cognito-identity-provider)
- [x] Create `packages/auth/tsconfig.json` extending base config
- [x] Create domain types: `Session`, `User`, `UserRole` (Admin | Member), `AuthState`
- [x] Create Auth.js v5 configuration: Cognito OIDC provider + Google + GitHub providers
- [x] Create session callback to include custom fields (tenantId, role, profileComplete)
- [x] Create JWT callback for token enrichment
- [x] Create auth utilities: `getServerSession()`, `requireAuth()`, `requireRole()`
- [x] Export everything from package index.ts
- [x] Add `@causeflow/auth` to `pnpm-workspace.yaml` if needed (should be auto-detected via packages/*)
- [x] Add `@causeflow/auth` as dependency in `apps/dashboard/package.json`
- [x] Run `pnpm install` to resolve workspace dependencies

## Phase 2.3: Auth Pages (Custom UI)
- [x] Create `apps/dashboard/src/app/[locale]/auth/layout.tsx` — minimal layout (no sidebar, centered card)
- [x] Create `apps/dashboard/src/app/[locale]/auth/sign-in/page.tsx`:
  - Email/password form with validation (Zod)
  - "Sign in with Google" button
  - "Sign in with GitHub" button
  - "Forgot password?" link
  - "Don't have an account? Sign up" link
  - Error handling and loading states
- [x] Create `apps/dashboard/src/app/[locale]/auth/sign-up/page.tsx`:
  - Name, email, password, confirm password form
  - Password strength indicator
  - "Sign up with Google" / "Sign up with GitHub" buttons
  - "Already have an account? Sign in" link
  - Terms of Service and Privacy Policy checkboxes
- [x] Create `apps/dashboard/src/app/[locale]/auth/verify-email/page.tsx`:
  - 6-digit verification code input
  - "Resend code" button with cooldown timer
  - Success → redirect to sign-in
- [x] Create `apps/dashboard/src/app/[locale]/auth/forgot-password/page.tsx`:
  - Email input → send reset code
  - Verification code + new password form
  - Success → redirect to sign-in
- [x] Add i18n messages for all auth pages (EN + PT-BR) in @causeflow/shared
- [x] Style all auth pages with CauseFlow AI branding (theme tokens, logo)
- [x] Ensure auth pages work in both light and dark mode

## Phase 2.4: Auth API Routes
- [x] Create `apps/dashboard/src/app/api/auth/[...nextauth]/route.ts` — Auth.js catch-all handler
- [x] Create `apps/dashboard/src/app/api/auth/sign-up/route.ts` — Registration endpoint (Cognito AdminCreateUser or SignUp)
- [x] Create `apps/dashboard/src/app/api/auth/verify-email/route.ts` — Confirm signup with verification code
- [x] Create `apps/dashboard/src/app/api/auth/forgot-password/route.ts` — Initiate password reset
- [x] Create `apps/dashboard/src/app/api/auth/reset-password/route.ts` — Confirm password reset with code
- [x] Add rate limiting to all auth endpoints
- [x] Add Zod validation to all request bodies
- [x] Add CSRF protection via Auth.js built-in

## Phase 2.5: Middleware Integration
- [x] Update `apps/dashboard/src/middleware.ts` to combine i18n routing + auth protection:
  - Public routes: `/auth/*`, `/api/auth/*`
  - Protected routes: `/dashboard/*`, `/onboarding/*`
  - Unauthenticated → redirect to `/auth/sign-in`
  - Authenticated + profile incomplete → redirect to `/onboarding/complete-profile`
  - Authenticated + profile complete → allow access to `/dashboard/*`
- [x] Add session token validation in middleware
- [x] Handle token refresh in middleware

## Phase 2.6: Dashboard Auth Integration
- [x] Update Topbar: show user name/avatar from session, add sign-out dropdown
- [x] Create user menu dropdown: Profile, Settings, Sign Out
- [x] Add `SessionProvider` (Auth.js) to dashboard root layout
- [x] Create `useSession` hook wrapper for client components
- [x] Show loading skeleton while session is being checked

## Phase 2.7: SST Resources (IaC Skeleton)
- [x] Add Cognito User Pool resource definition to `apps/dashboard/sst.config.ts`
  - Email/password sign-in enabled
  - Google federation placeholder (requires OAuth credentials)
  - GitHub federation placeholder (requires OAuth app)
  - Custom attributes: tenantId, role, profileComplete
  - Password policy: min 8 chars, require uppercase, lowercase, numbers
- [x] Add SES resource or configuration notes for branded emails
- [x] Add Lambda function skeleton for Custom Message trigger
- [x] Add environment variables for Cognito: COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET, COGNITO_ISSUER
- [x] Document: social login OAuth credentials must be configured manually in AWS Console

## Phase 2.8: Email Templates
- [x] Create branded HTML email template for verification (CauseFlow AI logo, green accent, clean design)
- [x] Create branded HTML email template for password reset
- [x] Create branded HTML email template for team invite (Phase 8 will use this)
- [x] Store templates in `packages/auth/src/infrastructure/templates/`
- [x] Templates support i18n (EN + PT-BR) via template variables

## Phase 2.9: Testing
- [x] Write unit tests for auth utilities (getServerSession, requireAuth, requireRole)
- [x] Write unit tests for auth API route handlers (sign-up, verify, forgot-password)
- [x] Write unit tests for middleware auth logic
- [x] Create E2E test: navigate to /dashboard without session → redirected to /auth/sign-in
- [x] Create E2E test: sign-in page renders correctly with form and social buttons
- [x] Create E2E test: sign-up page renders correctly with form validation

## Phase 2.10: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass
- [x] Verify auth pages render correctly in light and dark mode
- [x] Verify middleware redirects work (unauthenticated → sign-in)
- [x] Verify responsive layout on auth pages (mobile, tablet, desktop)
- [x] Remove unused code/imports
