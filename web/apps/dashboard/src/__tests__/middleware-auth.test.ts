import { describe, expect, it } from 'vitest';

/**
 * Middleware auth logic unit tests.
 *
 * The middleware itself imports Next.js server internals and Auth.js,
 * making full integration testing complex in Vitest. These tests cover the
 * pure helper logic that can be extracted and tested in isolation.
 */

// Mirror PUBLIC_ROUTE_PATTERNS from middleware.ts (AC-020 / AC-046 OSS semantics).
const PUBLIC_PATH_PATTERNS = [
  /^\/api\/health/,
  /^\/api\/ingestion\/webhook$/,
  /^\/auth\/?(.*)$/,
  /^\/(en|pt-br)\/auth\/?(.*)$/,
  /^\/accept-invitation/,
  /^\/(en|pt-br)\/accept-invitation/,
  /^\/beta-waitlist/,
  /^\/(en|pt-br)\/beta-waitlist/,
  /^\/waitlist/,
  /^\/(en|pt-br)\/waitlist/,
  /^\/create-organization/,
  /^\/(en|pt-br)\/create-organization/,
  /^\/$/,
  /^\/(en|pt-br)\/?$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hasOrganization(payload: Record<string, unknown>): boolean {
  const tenantId = payload.tenantId ?? payload.tenant_id ?? payload.orgId;
  return typeof tenantId === 'string' && tenantId.trim() !== '';
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

  it('does not list /api/auth/* in isPublicRoute (API paths bypass middleware earlier)', () => {
    expect(isPublicPath('/api/auth/session')).toBe(false);
    expect(isPublicPath('/api/auth/login')).toBe(false);
  });

  it('marks /api/health and /api/health/detailed as public', () => {
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/health/detailed')).toBe(true);
  });

  it('marks /api/ingestion/webhook as public', () => {
    expect(isPublicPath('/api/ingestion/webhook')).toBe(true);
  });

  it('marks invitation, waitlist, and create-organization routes as public', () => {
    expect(isPublicPath('/accept-invitation/token')).toBe(true);
    expect(isPublicPath('/pt-br/accept-invitation/token')).toBe(true);
    expect(isPublicPath('/beta-waitlist')).toBe(true);
    expect(isPublicPath('/pt-br/beta-waitlist')).toBe(true);
    expect(isPublicPath('/waitlist')).toBe(true);
    expect(isPublicPath('/pt-br/waitlist')).toBe(true);
    expect(isPublicPath('/create-organization')).toBe(true);
    expect(isPublicPath('/pt-br/create-organization')).toBe(true);
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

describe('hasOrganization (AC-020 org guard)', () => {
  it('returns false when tenantId, tenant_id, and orgId are absent', () => {
    expect(hasOrganization({ sub: 'u1', email: 'a@b.com' })).toBe(false);
  });

  it('returns true when tenantId is set', () => {
    expect(hasOrganization({ tenantId: 't1' })).toBe(true);
  });

  it('returns true when tenant_id or orgId is set', () => {
    expect(hasOrganization({ tenant_id: 't2' })).toBe(true);
    expect(hasOrganization({ orgId: 'org-1' })).toBe(true);
  });

  it('returns false for blank tenant identifiers', () => {
    expect(hasOrganization({ tenantId: '  ' })).toBe(false);
    expect(hasOrganization({ tenantId: '' })).toBe(false);
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
