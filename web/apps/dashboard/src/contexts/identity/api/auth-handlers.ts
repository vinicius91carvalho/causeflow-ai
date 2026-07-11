import { type NextRequest, NextResponse } from 'next/server';

/**
 * Open-source local-runtime auth handlers (AC-046).
 *
 * Proxy the dashboard's local sign-in / sign-up forms to the CauseFlow Core
 * API's local auth endpoints (`POST /v1/auth/login`, `POST /v1/auth/register`).
 * On success the Core returns a short-lived JWT signed with the shared
 * `JWT_SECRET`; this handler stores it in an `__session` httpOnly cookie that
 * `middleware.ts` + `withAuth` read on subsequent requests.
 *
 * These routes are public (not wrapped in `withAuth`) — they run before the
 * session exists. They never contact clerk.com / stripe.com / amazonaws.com /
 * sentry.io / sst.
 */

const SESSION_COOKIE = '__session';
const COOKIE_MAX_AGE = 60 * 60; // 1 hour — Core JWTs are short-lived
const IS_PROD = process.env.NODE_ENV === 'production';

function coreApiUrl(): string | null {
  const url = process.env.CORE_API_URL;
  return url && url.trim() !== '' ? url : null;
}

function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

interface CoreAuthSuccess {
  token?: string;
  jwt?: string;
  accessToken?: string;
  user?: { id?: string; email?: string; tenantId?: string; role?: string };
}

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 * Sets: __session httpOnly cookie
 */
export async function loginHandler(request: NextRequest) {
  const baseUrl = coreApiUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'auth_unavailable', message: 'Core API is not configured.' },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Email and password are required.' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      return NextResponse.json(
        {
          error: errBody.error ?? 'auth_failed',
          message: errBody.message ?? 'Sign-in failed.',
        },
        { status: res.status },
      );
    }

    const data = (await res.json()) as CoreAuthSuccess;
    const token = data.token ?? data.jwt ?? data.accessToken;
    if (!token) {
      return NextResponse.json(
        { error: 'no_token', message: 'Core did not return a session token.' },
        { status: 502 },
      );
    }

    const response = NextResponse.json({ ok: true, user: data.user ?? null });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: 'auth_unavailable',
        message: err instanceof Error ? err.message : 'Unable to reach the Core API.',
      },
      { status: 502 },
    );
  }
}

/**
 * POST /api/auth/register
 *
 * Body: { name, email, password, tenantName? }
 * Sets: __session httpOnly cookie
 *
 * Core's OSS register requires `tenantName`. When the sign-up form only
 * collects the user's name, we derive a tenant name from it so fresh OSS
 * tenants can complete registration in one step (AC-046/AC-048).
 */
export async function registerHandler(request: NextRequest) {
  const baseUrl = coreApiUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'auth_unavailable', message: 'Core API is not configured.' },
      { status: 503 },
    );
  }

  let body: { name?: string; email?: string; password?: string; tenantName?: string };
  try {
    body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      tenantName?: string;
    };
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  if (!body.email || !body.password || !body.name) {
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Name, email, and password are required.' },
      { status: 400 },
    );
  }

  const tenantName = (body.tenantName ?? body.name).trim();

  try {
    const res = await fetch(`${baseUrl}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body.name,
        email: body.email,
        password: body.password,
        tenantName,
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      return NextResponse.json(
        {
          error: errBody.error ?? 'register_failed',
          message: errBody.message ?? 'Sign-up failed.',
        },
        { status: res.status },
      );
    }

    const data = (await res.json()) as CoreAuthSuccess;
    const token = data.token ?? data.jwt ?? data.accessToken;

    const response = NextResponse.json({ ok: true, user: data.user ?? null });
    if (token) {
      setSessionCookie(response, token);
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: 'auth_unavailable',
        message: err instanceof Error ? err.message : 'Unable to reach the Core API.',
      },
      { status: 502 },
    );
  }
}

/**
 * POST /api/auth/logout — clears the local session cookie.
 */
export async function logoutHandler() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
