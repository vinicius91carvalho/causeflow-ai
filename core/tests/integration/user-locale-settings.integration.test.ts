/**
 * Sprint 01: Core contract confirmation — locale persistence via PATCH/GET settings
 *
 * Verifies that:
 *   1. PATCH /v1/users/:userId/settings with {locale: 'pt-br'} persists to
 *      UserSettingsEntity and GET returns locale === 'pt-br'
 *   2. PATCH with {locale: 'invalid-locale'} returns 400 (Zod rejection)
 *   3. PATCH with {locale: 'en'} after a prior 'pt-br' write flips the value back
 *
 * No real DynamoDB required — UserSettingsEntity is mocked in-memory.
 * No real Clerk required — local JWT auth (OSS mode).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tenant } from '../../src/modules/tenant/domain/tenant.entity.js';
import type { ITenantRepository } from '../../src/modules/tenant/domain/tenant.repository.js';
import type {
  Locale,
  NotificationPreferences,
  Theme,
} from '../../src/modules/user/domain/settings.entity.js';
import type { User } from '../../src/modules/user/domain/user.entity.js';
import type { IUserRepository } from '../../src/modules/user/domain/user.repository.js';
import { tenantId as toTenantId } from '../../src/shared/domain/value-objects.js';
import type { AppEnv } from '../../src/shared/infra/http/hono-types.js';
import { signLocalJwt } from '../helpers/local-auth-jwt.js';

vi.mock('../../src/shared/config/index.js', () => ({
  config: {
    clerk: { secretKey: '' },
    logLevel: 'silent',
    aws: {
      region: 'us-east-1',
      dynamoEndpoint: undefined,
      sqsEndpoint: undefined,
      tableName: 'causeflow-test',
    },
    auth: {
      jwtSecret: 'test-secret',
      jwtIssuer: 'causeflow',
      jwtAudience: 'causeflow-api',
    },
    redis: { url: 'redis://localhost:6379' },
    isDev: () => false,
    isProd: () => false,
    isTest: () => true,
    isOss: () => true,
  },
}));

// ── In-memory store for UserSettingsEntity mock ──────────────────────────────

type StoredSettings = {
  tenantId: string;
  userId: string;
  theme: Theme;
  locale: Locale;
  notifications: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
};

const settingsStore = new Map<string, StoredSettings>();

function storeKey(tenantId: string, userId: string) {
  return `${tenantId}#${userId}`;
}

vi.mock('../../src/shared/infra/db/entities/UserSettingsEntity.js', () => {
  const UserSettingsEntity = {
    get: (key: { tenantId: string; userId: string }) => ({
      go: async () => {
        const item = settingsStore.get(storeKey(key.tenantId, key.userId));
        return { data: item ?? null };
      },
    }),
    patch: (key: { tenantId: string; userId: string }) => ({
      set: (updates: Partial<StoredSettings>) => ({
        go: async () => {
          const existing = settingsStore.get(storeKey(key.tenantId, key.userId));
          if (existing) {
            const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
            settingsStore.set(storeKey(key.tenantId, key.userId), updated);
          }
          return { data: settingsStore.get(storeKey(key.tenantId, key.userId)) ?? null };
        },
      }),
    }),
    create: (item: StoredSettings) => ({
      go: async () => {
        const now = new Date().toISOString();
        const stored: StoredSettings = {
          ...item,
          createdAt: item.createdAt ?? now,
          updatedAt: item.updatedAt ?? now,
        };
        settingsStore.set(storeKey(item.tenantId, item.userId), stored);
        return { data: stored };
      },
    }),
  };
  return { UserSettingsEntity };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = toTenantId('org_locale_test_tenant');
const USER_ID = 'user_locale_test_001';
const USER_EMAIL = 'alice@example.com';

const mockUser: User = {
  tenantId: TENANT_ID,
  userId: USER_ID,
  email: USER_EMAIL,
  name: 'Alice',
  role: 'admin',
  profileComplete: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTenant: Tenant = {
  tenantId: TENANT_ID,
  name: 'Test Corp',
  slug: 'test-corp',
  plan: 'pro',
  ownerEmail: USER_EMAIL,
  status: 'active',
  settings: {
    maxIncidentsPerMonth: 50,
    autoRemediation: false,
    notificationChannels: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeMockUserRepo(): IUserRepository {
  return {
    create: vi.fn(async (u: User) => u),
    findById: vi.fn(async () => mockUser),
    findByUserId: vi.fn(async () => mockUser),
    findByEmail: vi.fn(async () => mockUser),
    findByTenant: vi.fn(async () => [mockUser]),
    update: vi.fn(
      async (_tid: unknown, _uid: unknown, data: Partial<User>): Promise<User> => ({
        ...mockUser,
        ...data,
      }),
    ),
    delete: vi.fn(async () => {}),
  };
}

function makeMockTenantRepo(): ITenantRepository {
  return {
    create: vi.fn(async (t: Tenant) => t),
    findById: vi.fn(async () => mockTenant),
    findBySlug: vi.fn(async () => mockTenant),
    findByCustomDomain: vi.fn(async () => null),
    update: vi.fn(
      async (_tid: unknown, data: Partial<Tenant>): Promise<Tenant> => ({ ...mockTenant, ...data }),
    ),
    listByOwner: vi.fn(async () => ({ items: [mockTenant] })),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Integration: PATCH/GET /v1/users/:userId/settings — locale persistence', () => {
  let app: Hono<AppEnv>;
  let authToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    settingsStore.clear();

    authToken = await signLocalJwt({
      sub: USER_ID,
      email: USER_EMAIL,
      tenant_id: TENANT_ID,
      roles: ['admin'],
    });

    const { authMiddleware } =
      await import('../../src/shared/infra/http/middleware/auth.middleware.js');
    const { createUserRoutes } = await import('../../src/modules/user/infra/user.routes.js');
    const { GetSettingsUseCase } =
      await import('../../src/modules/user/application/get-settings.usecase.js');
    const { UpdateSettingsUseCase } =
      await import('../../src/modules/user/application/update-settings.usecase.js');

    const userRepo = makeMockUserRepo();
    const tenantRepo = makeMockTenantRepo();

    const getSettings = new GetSettingsUseCase(userRepo, tenantRepo);
    const updateSettings = new UpdateSettingsUseCase(userRepo, tenantRepo);

    const { users } = createUserRoutes({
      // Minimal stubs for use cases not under test
      createUser: { execute: vi.fn() } as never,
      listUsers: { execute: vi.fn(async () => []) } as never,
      updateUser: { execute: vi.fn() } as never,
      deleteUser: { execute: vi.fn() } as never,
      createInvite: { execute: vi.fn() } as never,
      listInvites: { execute: vi.fn(async () => []) } as never,
      revokeInvite: { execute: vi.fn() } as never,
      getSettings,
      updateSettings,
    });

    app = new Hono<AppEnv>();
    app.use('*', authMiddleware);
    app.route('/v1/users', users);
  });

  // ── Test 1: persist pt-br and read it back ────────────────────────────────

  it('PATCH with locale:pt-br → 200; GET returns locale === pt-br', async () => {
    // PATCH settings with pt-br
    const patchRes = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'pt-br' }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { settings: { locale: string } };
    expect(patchBody.settings.locale).toBe('pt-br');

    // GET settings and verify locale is persisted
    const getRes = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { settings: { locale: string } };
    expect(getBody.settings.locale).toBe('pt-br');
  });

  // ── Test 2: invalid locale returns 400 ────────────────────────────────────

  it('PATCH with locale:invalid-locale → 400 (Zod rejection)', async () => {
    const res = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'invalid-locale' }),
    });

    expect(res.status).toBe(400);
  });

  // ── Test 3: flip pt-br → en ───────────────────────────────────────────────

  it('PATCH locale:pt-br then PATCH locale:en → GET returns locale === en', async () => {
    // First write: pt-br
    const patch1 = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'pt-br' }),
    });
    expect(patch1.status).toBe(200);

    // Confirm intermediate state
    const mid = await (patch1.json() as Promise<{ settings: { locale: string } }>);
    expect(mid.settings.locale).toBe('pt-br');

    // Second write: flip to en
    const patch2 = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'en' }),
    });
    expect(patch2.status).toBe(200);

    // GET and confirm final state is en
    const getRes = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { settings: { locale: string } };
    expect(getBody.settings.locale).toBe('en');
  });

  // ── Test 4: tenant isolation — write under T1 does not appear under T2 ────

  it('locale written under tenant T1 does NOT appear under tenant T2', async () => {
    const TENANT_2_ID = toTenantId('org_locale_test_tenant_2');

    // Write pt-br under tenant T1 (default mock)
    const patch1 = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'pt-br' }),
    });
    expect(patch1.status).toBe(200);

    const tenant2Token = await signLocalJwt({
      sub: USER_ID,
      email: USER_EMAIL,
      tenant_id: TENANT_2_ID,
      roles: ['admin'],
    });

    const getRes = await app.request(`/v1/users/${USER_ID}/settings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });

    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { settings: { locale: string } };
    // T2 has no settings written — should return default locale 'en'
    expect(getBody.settings.locale).toBe('en');
  });
});
