/**
 * Open-source local-runtime backend token helper (AC-046).
 *
 * Reads the local `__session` JWT cookie and returns it as a Bearer token for
 * onward CauseFlow Core API calls. Replaces the legacy hosted-auth
 * `getToken()` helper.
 *
 * Two call signatures:
 *
 * 1. With a request object (Next.js route handlers):
 *    ```ts
 *    const token = await getBackendToken(request);
 *    ```
 *
 * 2. Without arguments (code paths called from HttpApiClient singleton):
 *    ```ts
 *    const token = await getBackendToken();
 *    ```
 *    This variant uses `cookies()` from `next/headers`, which is only available
 *    in server components and route handlers (not in middleware/Edge Runtime).
 *
 * This helper is the BFF boundary: the token is never exposed to the browser.
 */

import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth/session-auth';

const SESSION_COOKIE_NAME = SESSION_COOKIE;

type CookieLike = { cookies: { get: (name: string) => { value: string } | undefined } };

/**
 * Extract the local JWT from the `__session` cookie.
 * @param request Optional Next.js request object. If omitted, reads from the
 *   server-side cookie store via `cookies()` from `next/headers`.
 */
export async function getBackendToken(request?: CookieLike): Promise<string> {
  let cookieValue: string | undefined;

  if (request) {
    cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    try {
      const cookieStore = await cookies();
      cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // cookies() throws in Edge Runtime — fall through
    }
  }

  if (!cookieValue) {
    throw new Error('No authenticated session — cannot generate backend token');
  }

  return cookieValue;
}
