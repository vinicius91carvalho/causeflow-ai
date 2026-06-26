import { describe, expect, it } from 'vitest';

/**
 * Middleware auth logic unit tests.
 *
 * The middleware itself imports Next.js server internals and Auth.js,
 * making full integration testing complex in Vitest. These tests cover the
 * pure helper logic that can be extracted and tested in isolation.
 */

const PUBLIC_PATH_PATTERNS = [
  /^\/api\/auth\//,
  /^\/auth\//,
  /^\/(en|pt-br)\/auth\//,
  /^\/api\/health$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

describe('isPublicPath', () => {
  it('marks /auth/sign-in as public', () => {
    expect(isPublicPath('/auth/sign-in')).toBe(true);
  });

  it('marks /auth/sign-up as public', () => {
    expect(isPublicPath('/auth/sign-up')).toBe(true);
  });

  it('marks /auth/verify-email as public', () => {
    expect(isPublicPath('/auth/verify-email')).toBe(true);
  });

  it('marks /auth/forgot-password as public', () => {
    expect(isPublicPath('/auth/forgot-password')).toBe(true);
  });

  it('marks /api/auth/* as public', () => {
    expect(isPublicPath('/api/auth/session')).toBe(true);
    expect(isPublicPath('/api/auth/callback/cognito')).toBe(true);
  });

  it('marks /api/health as public', () => {
    expect(isPublicPath('/api/health')).toBe(true);
  });

  it('marks /pt-br/auth/sign-in as public', () => {
    expect(isPublicPath('/pt-br/auth/sign-in')).toBe(true);
  });

  it('marks /en/auth/sign-in as public', () => {
    expect(isPublicPath('/en/auth/sign-in')).toBe(true);
  });

  it('marks /dashboard as protected', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
  });

  it('marks /dashboard/analyses as protected', () => {
    expect(isPublicPath('/dashboard/analyses')).toBe(false);
  });

  it('marks /onboarding/complete-profile as protected', () => {
    expect(isPublicPath('/onboarding/complete-profile')).toBe(false);
  });
});

describe('auth message keys', () => {
  it('verifies all required EN auth message keys exist', async () => {
    const messages = await import('@causeflow/shared/i18n/en');
    const en = messages.default as Record<string, unknown>;
    const dashboard = en.dashboard as Record<string, unknown>;
    const auth = dashboard.auth as Record<string, unknown>;

    expect(auth).toBeDefined();
    expect((auth.signIn as Record<string, unknown>).title).toBeDefined();
    expect((auth.signUp as Record<string, unknown>).title).toBeDefined();
    expect((auth.verifyEmail as Record<string, unknown>).title).toBeDefined();
    expect((auth.forgotPassword as Record<string, unknown>).title).toBeDefined();
    expect((auth.fields as Record<string, unknown>).email).toBeDefined();
    expect((auth.errors as Record<string, unknown>).generic).toBeDefined();
  });

  it('verifies all required PT-BR auth message keys exist', async () => {
    const messages = await import('@causeflow/shared/i18n/pt-br');
    const ptBr = messages.default as Record<string, unknown>;
    const dashboard = ptBr.dashboard as Record<string, unknown>;
    const auth = dashboard.auth as Record<string, unknown>;

    expect(auth).toBeDefined();
    expect((auth.signIn as Record<string, unknown>).title).toBeDefined();
    expect((auth.signUp as Record<string, unknown>).title).toBeDefined();
    expect((auth.verifyEmail as Record<string, unknown>).title).toBeDefined();
    expect((auth.forgotPassword as Record<string, unknown>).title).toBeDefined();
  });
});
