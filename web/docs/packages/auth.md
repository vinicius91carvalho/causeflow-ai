# @causeflow/auth

Authentication package for CauseFlow AI dashboard. Built on Auth.js v5 with Amazon Cognito OIDC as the primary identity provider, Google and GitHub OAuth as social providers, and dev credentials for local development.

## Providers

| Provider | Usage | Condition |
|---|---|---|
| Cognito OIDC | Primary production auth | Always enabled in staging/production |
| Google OAuth | Social sign-in | Always enabled |
| GitHub OAuth | Social sign-in | Always enabled |
| Credentials (dev) | Email/password bypass | `NODE_ENV === 'development'` only |

The dev credentials provider is stripped from production builds, ensuring no bypass path exists in deployed environments.

## Exports

### Client-Safe Exports (`.` default)

```typescript
import {
  AuthProvider,   // React context provider — wraps the app
  AuthGuard,      // Route-level protection component
  useSession,     // Auth.js native session hook
  useAuthSession, // Typed session hook (returns CauseFlow session shape)
  requireAuth,    // Server-side redirect helper
  requireRole,    // Server-side RBAC guard
} from '@causeflow/auth'
```

### Server-Only Exports (`./server`)

```typescript
import { cognitoSignUp } from '@causeflow/auth/server'
```

Server-only exports are split into a separate entry point to prevent the AWS SDK (`@aws-sdk/client-cognito-identity-provider`) from being included in client bundles. Importing `./server` in a client component or a file that reaches the client bundle will throw a build error.

## Session Type

Auth.js session is extended with CauseFlow-specific fields:

```typescript
interface CauseFlowSession {
  user: {
    id: string           // Cognito sub / OAuth provider ID
    email: string
    name: string
    tenantId: string     // Organization ID (from Cognito custom attribute)
    role: 'admin' | 'member' | 'viewer'
    profileComplete: boolean  // Onboarding completion flag
  }
  expires: string
}
```

## JWT Extension

The JWT token is extended with fields beyond the Auth.js defaults to support server-side authorization and API forwarding:

| JWT Field | Type | Description |
|---|---|---|
| `tenantId` | `string` | Organization identifier for multi-tenant isolation |
| `role` | `string` | User role for RBAC |
| `profileComplete` | `boolean` | Whether onboarding has been completed |
| `accessToken` | `string` | Cognito access token (forwarded to API calls) |
| `refreshToken` | `string` | Cognito refresh token (for silent re-auth) |

## GetUserProfileFn Callback

A callback used to persist and retrieve onboarding state. Auth config accepts a `getUserProfile` function that is called during the `jwt` callback to read the user's current `profileComplete` state from the database:

```typescript
import { createAuthConfig } from '@causeflow/auth'

const authConfig = createAuthConfig({
  getUserProfile: async (userId: string) => {
    const user = await db.user.findUnique({ where: { id: userId } })
    return { profileComplete: user?.profileComplete ?? false }
  },
})
```

This decouples the auth package from any specific database client — the calling app provides the data access function.

## RBAC Utilities

| Utility | Signature | Description |
|---|---|---|
| `requireAuth` | `(session) => never \| void` | Throws redirect if session is null |
| `requireRole` | `(session, role) => never \| void` | Throws redirect if user lacks the required role |
| `getUserInitials` | `(name: string) => string` | Returns 1-2 letter initials for avatar fallback |
| `getAvatarColor` | `(userId: string) => string` | Deterministic HSL color from user ID |

### Usage in Server Components

```typescript
import { requireAuth, requireRole } from '@causeflow/auth'
import { auth } from '@/lib/auth'

export default async function AdminPage() {
  const session = await auth()
  requireAuth(session)               // redirect to /auth/sign-in if not authenticated
  requireRole(session, 'admin')      // redirect to /dashboard if not admin
  // ...
}
```

## AuthGuard Component

Client-side route guard for protecting pages when server-side redirect is not possible:

```typescript
import { AuthGuard } from '@causeflow/auth'

export default function ProtectedPage() {
  return (
    <AuthGuard redirectTo="/auth/sign-in">
      <PageContent />
    </AuthGuard>
  )
}
```

Renders `null` while session is loading, redirects if unauthenticated, renders children if authenticated.

## Environment Variables

| Variable | Description |
|---|---|
| `AUTH_COGNITO_ID` | Cognito app client ID |
| `AUTH_COGNITO_SECRET` | Cognito app client secret |
| `AUTH_COGNITO_ISSUER` | Cognito user pool issuer URL (`https://cognito-idp.<region>.amazonaws.com/<pool-id>`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_GITHUB_ID` | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app client secret |
| `AUTH_SECRET` | Auth.js signing secret (random 32+ char string) |

All variables are defined in `apps/dashboard/.env.local`. See `apps/dashboard/.env.example` for the full template with placeholder values.

## Key File

`packages/auth/src/infrastructure/auth-config.ts` — Auth.js v5 configuration, provider setup, JWT/session callbacks, RBAC utilities, and the `GetUserProfileFn` type definition.
