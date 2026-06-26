import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Cognito from 'next-auth/providers/cognito';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import type { AuthToken, UserRole } from '../domain/types';

/**
 * Optional callback to look up a persisted user profile by their OAuth subject ID.
 * Returning `{ profileComplete: true, tenantId, role }` allows returning OAuth users
 * to skip the onboarding flow on subsequent sign-ins.
 *
 * The callback must be async-safe and must never throw — any error should be caught
 * internally and result in `undefined` being returned (fail-safe: treat as new user).
 */
export type GetUserProfileFn = (
  userId: string,
  email?: string | null,
) => Promise<
  | {
      profileComplete: boolean;
      tenantId: string | null;
      role: UserRole;
    }
  | undefined
>;

/**
 * Result type returned by a successful credentials sign-in.
 * Matches the shape that cognitoSignIn() returns.
 */
export interface CredentialsSignInResult {
  sub: string;
  email: string;
  accessToken: string;
  idToken: string;
  refreshToken: string | undefined;
}

/**
 * Optional callback for email/password sign-in via Cognito USER_PASSWORD_AUTH.
 *
 * Injected by the consuming app so that auth-config.ts (which may be bundled
 * for the client) never directly imports server-only modules (node:crypto,
 * AWS SDK).  The callback is only ever invoked server-side inside the
 * Credentials `authorize` function.
 *
 * Return the user token payload on success, `null` on invalid credentials.
 */
export type CredentialsSignInFn = (params: {
  email: string;
  password: string;
}) => Promise<CredentialsSignInResult | null>;

/**
 * Build the Auth.js v5 configuration.
 *
 * Production:  Cognito OIDC + Cognito Credentials (when credentialsSignIn injected)
 * Development: Same as above, or dev mock when ENABLE_DEV_CREDENTIALS=true
 */
function buildProviders(credentialsSignIn?: CredentialsSignInFn) {
  const providers: NextAuthConfig['providers'] = [];

  // Cognito OIDC provider (production + dev when credentials are set)
  if (
    process.env.AUTH_COGNITO_ID &&
    process.env.AUTH_COGNITO_SECRET &&
    process.env.AUTH_COGNITO_ISSUER
  ) {
    providers.push(
      Cognito({
        clientId: process.env.AUTH_COGNITO_ID,
        clientSecret: process.env.AUTH_COGNITO_SECRET,
        issuer: process.env.AUTH_COGNITO_ISSUER,
        authorization: {
          params: {
            scope: 'openid email profile',
          },
        },
      }),
    );
  }

  // Google OAuth provider
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  // GitHub OAuth provider
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }

  if (process.env.ENABLE_DEV_CREDENTIALS === 'true') {
    // Development-only Credentials provider — allows any email/password.
    // Takes priority over Cognito when enabled so local dev works without internet.
    // NEVER set ENABLE_DEV_CREDENTIALS=true in a real production deployment.
    providers.push(
      Credentials({
        id: 'credentials',
        name: 'Development Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }
          return {
            id: `dev-${String(credentials.email).replace(/[^a-z0-9]/gi, '')}`,
            email: String(credentials.email),
            name: String(credentials.email).split('@')[0],
            image: null,
          };
        },
      }),
    );
  } else if (credentialsSignIn) {
    // Real Cognito Credentials provider — injected by the consuming app.
    // The sign-in function is only invoked server-side; auth-config.ts itself
    // never imports node:crypto or the AWS SDK directly.
    providers.push(
      Credentials({
        id: 'credentials',
        name: 'Email / Password',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }
          const result = await credentialsSignIn({
            email: String(credentials.email),
            password: String(credentials.password),
          });
          if (!result) {
            return null;
          }
          return {
            id: result.sub,
            email: result.email,
            name: result.email.split('@')[0],
            image: null,
          };
        },
      }),
    );
  }

  return providers;
}

/**
 * Options for creating the Auth.js v5 configuration.
 */
/**
 * Optional callback to check whether an email is on the beta allowlist.
 * Injected by the consuming app so auth-config.ts never imports dashboard-specific code.
 *
 * Return `true` if the email is allowed to sign in, `false` otherwise.
 */
export type IsEmailOnBetaListFn = (email: string) => Promise<boolean>;

export interface AuthConfigOptions {
  /**
   * Optional async function to look up a persisted user profile by OAuth user ID.
   * When provided, returning OAuth users (Google/GitHub) will have their
   * `profileComplete`, `tenantId`, and `role` restored from persistent storage on
   * every sign-in — preventing them from being redirected to onboarding again.
   *
   * If omitted or if the lookup returns undefined, the token defaults apply
   * (profileComplete = false, i.e. new-user onboarding flow).
   */
  getUserProfile?: GetUserProfileFn;

  /**
   * Optional async function that performs email/password sign-in against Cognito
   * using the USER_PASSWORD_AUTH flow.
   *
   * Inject this from the dashboard's `auth.ts` to enable the Credentials provider
   * without pulling server-only modules (node:crypto, AWS SDK) into the client bundle.
   *
   * When provided, a real Credentials provider is registered.
   * When omitted and ENABLE_DEV_CREDENTIALS=true, the dev mock provider is used instead.
   */
  credentialsSignIn?: CredentialsSignInFn;

  /**
   * Optional callback to gate sign-in to beta-allowlisted emails only.
   * When provided, the signIn callback will check this before allowing any login.
   * If the email is not on the beta list, sign-in is denied with a redirect to
   * the sign-in page with ?error=BetaAccessDenied.
   */
  isEmailOnBetaList?: IsEmailOnBetaListFn;
}

/**
 * Build the Auth.js v5 configuration object.
 *
 * Accepts an optional `options` object so the consuming app (dashboard) can
 * inject a `getUserProfile` callback without creating a circular dependency
 * between the auth package and the dashboard's database layer.
 */
export function createAuthConfig(options: AuthConfigOptions = {}): NextAuthConfig {
  const { getUserProfile, credentialsSignIn, isEmailOnBetaList } = options;

  return {
    providers: buildProviders(credentialsSignIn),
    pages: {
      signIn: '/auth/sign-in',
      error: '/auth/sign-in',
      newUser: '/onboarding/complete-profile',
    },
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
      /**
       * signIn callback — gate sign-in to beta-allowlisted emails.
       * Runs for ALL providers (OAuth + credentials). Returning a URL string
       * redirects the user there instead of completing sign-in.
       */
      async signIn({ user, account }) {
        if (isEmailOnBetaList) {
          // Dev credentials bypass beta check entirely
          if (
            account?.provider === 'credentials' &&
            process.env.ENABLE_DEV_CREDENTIALS === 'true'
          ) {
            return true;
          }

          const email = user.email;
          if (!email) return '/auth/sign-in?error=BetaAccessDenied';

          try {
            const allowed = await isEmailOnBetaList(email);
            if (!allowed) return '/auth/sign-in?error=BetaAccessDenied';
          } catch (err) {
            // Fail-open: if beta check fails, allow sign-in rather than blocking
            console.error('[auth] Beta allowlist check failed:', err);
          }
        }
        return true;
      },

      /**
       * JWT callback — enrich token with custom claims.
       * Called on sign-in, refresh, and every session access.
       */
      async jwt({ token, user, account, trigger, session: updateData }) {
        const t = token as JWT & AuthToken;

        // Handle client-side session.update() calls (e.g. after onboarding profile completion)
        if (trigger === 'update' && updateData) {
          const data = updateData as Partial<AuthToken>;
          if (data.profileComplete !== undefined) t.profileComplete = data.profileComplete;
          if (data.tenantId !== undefined) t.tenantId = data.tenantId;
          if (data.role !== undefined) t.role = data.role as UserRole;
          return t;
        }

        // On initial sign-in, merge provider data into token
        if (account && user) {
          t.accessToken = account.access_token;
          t.refreshToken = account.refresh_token;
          t.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000;

          if (account.provider === 'credentials') {
            if (process.env.ENABLE_DEV_CREDENTIALS === 'true') {
              // Dev credentials provider — set fixed defaults so dev/E2E
              // users land directly on the dashboard without onboarding.
              t.tenantId = 'tenant-e2e-test';
              t.role = 'admin' as UserRole;
              t.profileComplete = true;
            } else if (credentialsSignIn) {
              // Real Cognito credentials — treat same as OIDC sign-in:
              // look up the persisted profile so returning users skip onboarding.
              t.tenantId = null;
              t.role = 'member' as UserRole;
              t.profileComplete = false;

              if (getUserProfile && user.id) {
                try {
                  const existing = await getUserProfile(user.id, user.email);
                  if (existing?.profileComplete) {
                    t.profileComplete = true;
                    t.tenantId = existing.tenantId;
                    t.role = existing.role;
                  }
                } catch (err) {
                  console.error('[auth] getUserProfile lookup failed (credentials):', err);
                  t.profileComplete = false;
                }
              }
            }
          } else if (account.provider === 'google' || account.provider === 'github') {
            // Social login — set safe defaults first (treats as new user)
            t.tenantId = null;
            t.role = 'member' as UserRole;
            t.profileComplete = false;

            // If a profile lookup function is provided, check whether this is a
            // returning user who already completed onboarding.  We look up by the
            // OAuth subject ID (user.id), which is stable across sign-ins for the
            // same OAuth account.
            if (getUserProfile && user.id) {
              try {
                const existing = await getUserProfile(user.id, user.email);
                if (existing?.profileComplete) {
                  t.profileComplete = true;
                  t.tenantId = existing.tenantId;
                  t.role = existing.role;
                }
              } catch (err) {
                // Fail-safe: DB lookup failed — default to profileComplete=false
                // so new users go to onboarding rather than an empty dashboard.
                console.error('[auth] getUserProfile lookup failed:', err);
                t.profileComplete = false;
              }
            }
          } else {
            // Cognito OIDC — use same getUserProfile lookup as Google/GitHub.
            // Custom Cognito attributes (custom:tenantId, etc.) are never set
            // during sign-up, so reading them was a dead path.
            t.tenantId = null;
            t.role = 'member' as UserRole;
            t.profileComplete = false;

            if (getUserProfile && user.id) {
              try {
                const existing = await getUserProfile(user.id, user.email);
                if (existing?.profileComplete) {
                  t.profileComplete = true;
                  t.tenantId = existing.tenantId;
                  t.role = existing.role;
                }
              } catch (err) {
                console.error('[auth] getUserProfile lookup failed (cognito):', err);
                t.profileComplete = false;
              }
            }
          }
        }

        return t;
      },

      /**
       * Session callback — expose token data to client session.
       */
      async session({ session, token }) {
        const t = token as JWT & AuthToken;

        return {
          ...session,
          user: {
            ...session.user,
            id: t.sub ?? '',
            tenantId: t.tenantId ?? null,
            role: (t.role ?? 'member') as UserRole,
            profileComplete: t.profileComplete ?? false,
          },
        };
      },

      /**
       * Authorized callback — used by middleware to check access.
       * Returns true if the request is authorized.
       */
      authorized({ auth, request }) {
        const { pathname } = request.nextUrl;

        // Auth pages and API auth routes are always public
        if (
          pathname.includes('/auth/') ||
          pathname.includes('/api/auth/') ||
          pathname === '/api/health'
        ) {
          return true;
        }

        // Everything else requires authentication
        return !!auth;
      },
    },
  };
}

/**
 * Default Auth.js v5 configuration object (no profile lookup).
 * Import this in the dashboard's auth.ts file when no DB callback is needed,
 * or use `createAuthConfig({ getUserProfile })` to enable returning-user detection.
 *
 * @deprecated Prefer `createAuthConfig(options)` to enable returning OAuth user support.
 */
export const authConfig: NextAuthConfig = createAuthConfig();
