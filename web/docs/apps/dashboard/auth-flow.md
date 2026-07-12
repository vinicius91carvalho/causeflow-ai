# Dashboard Auth Flow

This document describes the dashboard authentication and authorization flow in
the open-source runtime.

---

## Provider

The OSS dashboard uses Core-issued local JWTs. Core signs tokens with
`JWT_SECRET`; the dashboard stores the token in the `__session` cookie and
verifies it through Core `/v1/auth/me`.

Hosted deployments can still receive Core-issued tokens backed by an external
identity provider, but the dashboard does not own Clerk, Cognito, DynamoDB, or
KMS resources.

---

## Sign-Up Flow

```text
1. User visits /auth/sign-up
2. Dashboard posts registration to /api/auth/register
3. The BFF calls Core /v1/auth/register
4. Core creates the local tenant/user and returns a JWT
5. Dashboard stores __session and redirects into onboarding/dashboard
```

## Sign-In Flow

```text
1. User visits /auth/sign-in
2. Dashboard posts credentials to /api/auth/login
3. The BFF calls Core /v1/auth/login
4. Core returns a signed local JWT
5. Dashboard stores __session
6. Middleware verifies the session through Core /v1/auth/me
7. User reaches /dashboard
```

## Sign-Out Flow

```text
1. User submits sign-out
2. Dashboard calls /api/auth/logout
3. The BFF clears __session and proxies Core /v1/auth/logout when available
4. User returns to /auth/sign-in
```

---

## Middleware Chain

`src/middleware.ts` processes requests in this order:

1. Public route bypass for auth pages, health checks, webhooks, and staging auth.
2. API route handling; protected API routes require `withAuth()`.
3. Session check by reading `__session` and verifying it through Core.
4. Profile/onboarding guard.
5. Locale detection via `next-intl`.

No Clerk browser-token bootstrap or Cognito callback handling runs in OSS mode.

---

## RBAC

Two roles are used: `admin` and `member`.

| Permission | Admin | Member |
|---|---|---|
| `MANAGE_TEAM` | Yes | No |
| `MANAGE_INTEGRATIONS` | Yes | No |
| `MANAGE_BILLING` | Yes | No |
| `MANAGE_SETTINGS` | Yes | No |
| `SUBMIT_ANALYSIS` | Yes | Yes |
| `VIEW_ANALYSES` | Yes | Yes |
| `VIEW_INTEGRATIONS` | Yes | Yes |

Server-side enforcement happens in `src/lib/api/with-auth.ts`.

```typescript
export const POST = withAuth(handler, { adminOnly: true });
export const GET = withAuth(handler);
```

The `AuthContext` passed to handlers contains:

```typescript
interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  profileComplete: boolean;
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CORE_API_URL` | Docker yes; optional in app-only dev | Core API base URL. Blank uses the mock Core client. |
| `JWT_SECRET` | Yes | Must match Core's `JWT_SECRET`. |
| `CAUSEFLOW_RUNTIME` | OSS yes | Set to `oss` for local auth and stub billing behavior. |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | Optional | `development`, `staging`, or `production`. |
