import { auth } from '@clerk/nextjs/server';

/**
 * Get a Clerk session token to authenticate with the CauseFlow Core API backend.
 *
 * The backend auth middleware verifies this Clerk JWT via JWKS using
 * @clerk/backend's verifyToken with the shared CLERK_SECRET_KEY.
 * The token includes org_id (tenantId) and user identity.
 * It is never exposed to the browser — BFF pattern.
 */
export async function getBackendToken(): Promise<string> {
  const { getToken } = await auth();

  const token = await getToken();
  if (!token) {
    throw new Error('No authenticated session — cannot generate backend token');
  }

  return token;
}
