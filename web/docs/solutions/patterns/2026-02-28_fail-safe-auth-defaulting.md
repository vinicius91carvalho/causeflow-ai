---
title: Fail-safe defaulting for auth claims — always default toward least access
date: 2026-02-28
category: patterns
tags: [auth, security, defaults, onboarding, profileComplete, role, cognito]
app: dashboard
severity: high
---

# Fail-safe defaulting for auth claims — always default toward least access

## Problem

Auth callbacks return `undefined` for custom claims like `profileComplete`, `role`, and `tenantId` when:
- A new OAuth user signs in for the first time (no profile in DB yet)
- A DB read fails (network error, permission issue)
- A Cognito attribute is never populated (e.g., custom attributes set during sign-up were skipped)

If code uses `?? true` or assumes truthy values, new users skip onboarding and land on an empty dashboard.

## Root Cause

Multiple places in the Auth.js callbacks used unsafe defaults:

```ts
// BAD — these patterns existed and caused bypass bugs:
profileComplete: session.user.profileComplete ?? true   // skips onboarding
role: user.role ?? 'admin'                              // elevates privilege
```

The worst case of defaulting toward "more access" is granting unearned access. The worst case of defaulting toward "less access" is a brief inconvenience (seeing onboarding again).

## Solution

Always default toward the safest UX path:

```ts
// GOOD — fail-safe defaults:
profileComplete: session.user.profileComplete ?? false  // forces onboarding
role: user.role ?? 'member'                             // least privilege
tenantId: user.tenantId ?? null                         // no tenant access
```

Applied throughout `packages/auth/src/infrastructure/auth-config.ts`:

```ts
// In jwt() callback:
token.profileComplete = profile?.profileComplete ?? false;
token.role = profile?.role ?? 'member';

// In session() callback:
session.user.profileComplete = token.profileComplete ?? false;
session.user.role = token.role ?? 'member';
```

The middleware also defaults to false:

```ts
// apps/dashboard/src/middleware.ts
const profileComplete = session?.user?.profileComplete ?? false;
if (!profileComplete && !isOnboardingRoute) {
  return NextResponse.redirect(new URL('/onboarding/complete-profile', req.url));
}
```

## Prevention

- **Rule:** When defaulting a boolean auth claim on error/undefined, ALWAYS default to `false` if `true` grants access or skips a step.
- **Rule:** When defaulting a role on error/undefined, ALWAYS default to `'member'` (least privilege), never `'admin'`.
- Code review checklist: search for `?? true` near auth claims — these are almost always bugs.

## Related

- `packages/auth/src/infrastructure/auth-config.ts`
- [`bugfixes/2026-02-28_cognito-secrethash.md`](../bugfixes/2026-02-28_cognito-secrethash.md)
- Fix deployed in commit `fa88ba0`
