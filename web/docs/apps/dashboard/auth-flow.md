# Dashboard Auth Flow

This document describes the complete authentication and authorization system for the CauseFlow AI dashboard, including Clerk integration, the middleware chain, RBAC, and the `withAuth` route wrapper.

---

## Authentication Provider: Clerk

The dashboard uses [Clerk](https://clerk.com) (`@clerk/nextjs` v7) for all authentication and organization management. Clerk replaces the previous Auth.js + Cognito setup.

### Sign-In Methods

| Method | Description |
|---|---|
| **Email/Password** | Clerk-managed credentials |
| **Google OAuth** | Social sign-in via Google |
| **GitHub OAuth** | Social sign-in via GitHub |

### Clerk Organization Model

Clerk organizations map directly to CauseFlow tenants:

- One Clerk organization per tenant
- `orgId` = `tenantId` throughout the application
- `orgRole: org:admin` maps to app role `admin`
- `orgRole: org:member` (default) maps to app role `member`
- The "Create Organization" Clerk UI is hidden — org creation happens during onboarding

---

## Sign-Up Flow

```
1. User visits /auth/sign-up
2. Clerk handles registration (email/password or OAuth)
3. Clerk creates user + session
4. Middleware detects missing orgId → redirects to /create-organization
5. Clerk creates organization (tenant)
6. User redirected to /onboarding/complete-profile
7. Profile form: company name, website, team size, role, terms acceptance
8. POST /api/onboarding/complete-profile completes setup
9. User redirected to /dashboard?welcome=1 (triggers onboarding tutorial)
```

### Sign-In Flow

```
1. User visits /auth/sign-in
2. Clerk handles authentication (credentials or OAuth)
3. Middleware extracts session via auth() from @clerk/nextjs/server
4. Maps Clerk orgRole to app role (admin/member)
5. Checks orgId — if missing, redirects to /create-organization
6. Checks profile completion — if incomplete, redirects to /onboarding/complete-profile
7. User reaches /dashboard
```

---

## Middleware Chain

`src/middleware.ts` processes every request through multiple layers:

```
Request
  │
  ├── 1. API Route Handling
  │       API routes skip i18n middleware
  │       Public API routes (health, webhook) pass through without auth
  │       Protected API routes enforce Clerk session
  │
  ├── 2. Public Routes Bypass
  │       Always allowed without auth:
  │         - /auth/** (sign-in, sign-up)
  │         - /api/auth/**
  │         - /api/health
  │         - /api/billing/webhook (Stripe signature-verified, not session-verified)
  │         - /staging-auth
  │
  ├── 3. Clerk Session Check
  │       Extracts session via auth() from @clerk/nextjs/server
  │       No session → redirect to /auth/sign-in?callbackUrl=<original>
  │       Locale preserved in redirect URL
  │
  ├── 4. Organization Check
  │       Authenticated + no orgId → redirect to /create-organization
  │       Maps orgRole to app role:
  │         - org:admin → admin
  │         - default → member
  │
  ├── 5. Profile Completion Guard
  │       Authenticated + profileComplete=false → /onboarding/complete-profile
  │       Authenticated + profileComplete=true + onboarding path → /dashboard
  │
  └── 6. Locale Detection (next-intl createMiddleware)
          Reads NEXT_LOCALE cookie (1-year expiry)
          If no cookie: parses Accept-Language header
          Matches against ['en', 'pt-br']
          Sets NEXT_LOCALE cookie on first visit
```

### Dev Mode

In development, the middleware handles Clerk's dev browser token initialization via the `__clerk_db_jwt` cookie.

---

## Role-Based Access Control (RBAC)

Two roles: `admin` and `member`. The first user in an organization is always `admin`.

### Permission Types

| Permission | Admin | Member |
|---|---|---|
| `MANAGE_TEAM` | Yes | No |
| `MANAGE_INTEGRATIONS` | Yes | No |
| `MANAGE_BILLING` | Yes | No |
| `MANAGE_SETTINGS` | Yes | No |
| `SUBMIT_ANALYSIS` | Yes | Yes |
| `VIEW_ANALYSES` | Yes | Yes |
| `VIEW_INTEGRATIONS` | Yes | Yes |

### Role Capabilities

| Action | Admin | Member |
|---|---|---|
| View incidents/analyses | Yes | Yes |
| Create incidents | Yes | Yes |
| View integrations | Yes | Yes |
| Connect/disconnect integrations | Yes | No |
| View team members | Yes | Yes |
| Invite/remove team members | Yes | No |
| Change team member roles | Yes | No |
| Update company settings | Yes | No |
| Update own profile/notifications | Yes | Yes |
| Manage billing/subscription | Yes | No |
| Manage API keys | Yes | No |
| Approve/reject remediations | Yes | No |

Admin cannot: remove themselves from the team, change their own role (prevents lockout).

### Server-Side Enforcement

**1. `withAuth()` HOC (route handlers):**

```typescript
// Admin-only route
export const POST = withAuth(handler, { adminOnly: true });

// Any authenticated user
export const GET = withAuth(handler);
```

**2. `RoleGuard` component (React):**

```typescript
import { RoleGuard } from '@/contexts/identity/domain/rbac/role-guard';

<RoleGuard requiredPermission="MANAGE_TEAM">
  <InviteButton />
</RoleGuard>
```

**3. `usePermission` hook:**

```typescript
import { usePermission } from '@/contexts/identity/domain/rbac/permissions';

const canManageTeam = usePermission('MANAGE_TEAM');
```

---

## `withAuth()` Higher-Order Function

Located at `src/lib/api/with-auth.ts`. Wraps API route handlers with:

1. **Authentication check:** Calls Clerk's `auth()` — returns `401` if no session
2. **Tenant isolation check:** Returns `403` if `orgId` (tenantId) is missing
3. **Role guard:** Returns `403` if `adminOnly: true` and role is not `admin`
4. **Per-user rate limiting:** Key: `api:<userId>:<ip>:<pathname>`, default 60 req/min. Returns `429` with `Retry-After` header
5. **Params resolution:** Resolves Next.js 15's async `params` Promise

**AuthContext** passed to every wrapped handler:

```typescript
interface AuthContext {
  userId: string;      // Clerk user ID
  tenantId: string;    // Clerk org ID
  email: string;
  name: string;
  role: 'admin' | 'member';
  profileComplete: boolean;
}
```

**Usage pattern:**

```typescript
// Non-dynamic route
export const GET = withAuth(async (request, ctx) => {
  // ctx.tenantId, ctx.userId, ctx.role available
  const data = await getApiClient().getTeam(ctx.tenantId);
  return NextResponse.json(data);
});

// Dynamic route with params
export const DELETE = withAuth(
  async (request, ctx, params) => {
    const userId = params?.userId;
    // ...
  },
  { adminOnly: true },
);
```

---

## Clerk Theme Integration

The dashboard applies CauseFlow design tokens to Clerk's UI components for visual consistency:

- `ClerkThemeProvider` wraps Clerk components with custom theme variables
- Dark mode support follows the app's theme setting (`.dark` class on `<html>`)
- Clerk's "Create Organization" UI is hidden — org creation is part of the onboarding flow
- Custom sign-in/sign-up pages use Clerk's pre-built components with theme overrides

---

## Onboarding & Session Enrichment

After Clerk authentication, the session is enriched through the onboarding flow:

1. **Clerk creates session** with basic user info (email, name, avatar)
2. **Org creation** associates user with a tenant (orgId = tenantId)
3. **Profile completion** (`POST /api/onboarding/complete-profile`) stores company details
4. **Tutorial modal** guides new users through key features

The Clerk session naturally includes `orgId` and `orgRole` — no custom JWT enrichment is needed (unlike the previous Auth.js setup).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (server-side) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (client-side) |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | Staging | Set to `staging` to activate the staging password gate |
