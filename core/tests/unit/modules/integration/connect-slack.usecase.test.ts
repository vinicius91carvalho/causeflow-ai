import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectSlackUseCase } from '../../../../src/modules/integration/application/connect-slack.usecase.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type {
  Tenant,
  TenantSettings,
} from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';
import type {
  TokenEncryption,
  EncryptedPayload,
} from '../../../../src/shared/application/ports/token-encryption.port.js';

// ─── Mock TokenEncryption ───────────────────────────────────────────────────
function makeMockTokenEncryption(): TokenEncryption {
  return {
    encrypt: vi.fn(
      async (plaintext: string): Promise<EncryptedPayload> => ({
        ciphertext: Buffer.from(`encrypted:${plaintext}`).toString('base64'),
        encryptedDek: Buffer.from('fake-dek').toString('base64'),
        iv: Buffer.from('fake-iv').toString('base64'),
        tag: Buffer.from('fake-tag').toString('base64'),
      }),
    ),
    decrypt: vi.fn(
      async (payload: EncryptedPayload): Promise<string> =>
        Buffer.from(payload.ciphertext, 'base64').toString('utf8').replace('encrypted:', ''),
    ),
  };
}

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const TENANT_ID = tenantId('tenant-slack-test-001');

const BASE_SETTINGS: TenantSettings = {
  maxIncidentsPerMonth: 50,
  autoRemediation: false,
  notificationChannels: [],
};

const BASE_TENANT: Tenant = {
  tenantId: TENANT_ID,
  name: 'Test Corp',
  slug: 'test-corp',
  ownerEmail: 'admin@test.com',
  plan: 'pro',
  status: 'active',
  settings: BASE_SETTINGS,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SLACK_OAUTH_RESPONSE = {
  ok: true,
  access_token: 'xoxb-test-bot-token-12345',
  incoming_webhook: {
    url: 'https://hooks.slack.com/services/T123/B456/abc123',
    channel: '#incidents',
    channel_id: 'C1234567',
    configuration_url: 'https://acme.slack.com/services/B456',
  },
  team: {
    id: 'T1234567',
    name: 'Acme Corp',
  },
};

function makeMockTenantRepo(): ITenantRepository {
  const tenant = { ...BASE_TENANT };
  return {
    create: vi.fn(async (t: Tenant) => t),
    findById: vi.fn(async () => tenant),
    findBySlug: vi.fn(async () => null),
    findByCustomDomain: vi.fn(async () => null),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    update: vi.fn(async (_id, data) => ({ ...tenant, ...data })),
    listByOwner: vi.fn(async () => ({ items: [], cursor: undefined })),
  };
}

describe('ConnectSlackUseCase', () => {
  let tenantRepo: ITenantRepository;
  let tokenEncryption: TokenEncryption;
  let useCase: ConnectSlackUseCase;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantRepo = makeMockTenantRepo();
    tokenEncryption = makeMockTokenEncryption();
    useCase = new ConnectSlackUseCase(
      tenantRepo,
      {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://api.causeflow.io/v1/integrations/slack/oauth/callback',
      },
      tokenEncryption,
    );

    // Mock global fetch
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('exchanges OAuth code and stores slackConfig in tenant settings', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    const result = await useCase.execute({
      code: 'valid-oauth-code',
      tenantId: TENANT_ID,
    });

    expect(result.connected).toBe(true);
    expect(result.channel).toBe('#incidents');
    expect(result.workspaceName).toBe('Acme Corp');
    expect(result.installedAt).toBeTruthy();

    // Verify tenant repo update was called with slackConfig
    expect(tenantRepo.update).toHaveBeenCalledTimes(1);
    const updateCall = vi.mocked(tenantRepo.update).mock.calls[0]!;
    const updatedSettings = updateCall[1]?.settings as TenantSettings & { slackConfig: unknown };
    expect(updatedSettings?.slackConfig).toBeTruthy();
  });

  it('maps Slack API response fields correctly to SlackConfig', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    await useCase.execute({ code: 'valid-oauth-code', tenantId: TENANT_ID });

    const updateCall = vi.mocked(tenantRepo.update).mock.calls[0]!;
    const updatedSettings = updateCall[1]?.settings as TenantSettings;
    const slackConfig = (updatedSettings as any)?.slackConfig;

    expect(slackConfig.channel).toBe('#incidents');
    expect(slackConfig.channelId).toBe('C1234567');
    expect(slackConfig.workspaceId).toBe('T1234567');
    expect(slackConfig.workspaceName).toBe('Acme Corp');
    expect(slackConfig.configurationUrl).toBe('https://acme.slack.com/services/B456');
    // Access token must be stored encrypted (not plaintext)
    expect(slackConfig.accessToken).not.toBe('xoxb-test-bot-token-12345');
    const parsed = JSON.parse(slackConfig.accessToken);
    expect(parsed.ciphertext).toBeTruthy();
    expect(parsed.encryptedDek).toBeTruthy();
    expect(parsed.iv).toBeTruthy();
    expect(parsed.tag).toBeTruthy();
    expect(slackConfig.webhookUrl).toBe('https://hooks.slack.com/services/T123/B456/abc123');
    expect(slackConfig.installedAt).toBeTruthy();
  });

  it('throws if Slack OAuth exchange returns ok:false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_code' }),
    });

    await expect(useCase.execute({ code: 'bad-code', tenantId: TENANT_ID })).rejects.toThrow(
      /Slack OAuth exchange failed/,
    );
  });

  it('throws if Slack API returns HTTP error', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(useCase.execute({ code: 'bad-code', tenantId: TENANT_ID })).rejects.toThrow();
  });

  it('throws if tenant is not found', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValueOnce(null);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    await expect(useCase.execute({ code: 'valid-code', tenantId: TENANT_ID })).rejects.toThrow();
  });

  it('sends correct form-encoded body to Slack token endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    await useCase.execute({ code: 'my-code', tenantId: TENANT_ID });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://slack.com/api/oauth.v2.access',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        body: expect.stringContaining('code=my-code'),
      }),
    );
  });

  it('SECURITY: does not log accessToken or webhookUrl', async () => {
    const infoLog: unknown[][] = [];
    const warnLog: unknown[][] = [];
    const loggerSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      infoLog.push(args);
    });
    const loggerWarnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnLog.push(args);
    });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    await useCase.execute({ code: 'valid-oauth-code', tenantId: TENANT_ID });

    const allCalls = [...infoLog, ...warnLog].map((args) => JSON.stringify(args));

    for (const call of allCalls) {
      expect(call).not.toContain('xoxb-test-bot-token-12345');
      expect(call).not.toContain('hooks.slack.com');
    }

    loggerSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('SECURITY: encrypts accessToken before storing', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => SLACK_OAUTH_RESPONSE,
    });

    await useCase.execute({ code: 'valid-oauth-code', tenantId: TENANT_ID });

    expect(tokenEncryption.encrypt).toHaveBeenCalledWith('xoxb-test-bot-token-12345');

    const updateCall = vi.mocked(tenantRepo.update).mock.calls[0]!;
    const updatedSettings = updateCall[1]?.settings as TenantSettings;
    const slackConfig = (updatedSettings as any)?.slackConfig;

    expect(slackConfig.accessToken).not.toBe('xoxb-test-bot-token-12345');
    const parsed = JSON.parse(slackConfig.accessToken);
    expect(parsed.ciphertext).toBeTruthy();
    expect(parsed.encryptedDek).toBeTruthy();

    const decrypted = await tokenEncryption.decrypt(parsed);
    expect(decrypted).toBe('xoxb-test-bot-token-12345');
  });
});
