/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock TokenEncryption ────────────────────────────────────────────────────
const mockDecrypt = vi.fn(async (payload: { ciphertext: string }) => 'xoxb-decrypted-token');
const mockEncrypt = vi.fn(async (plaintext: string) => ({
  ciphertext: plaintext,
  encryptedDek: 'dek',
  iv: 'iv',
  tag: 'tag',
}));

vi.mock('@shared/application/ports/token-encryption.port.js', () => ({}));

// ─── Mock @slack/web-api before importing subscriber ─────────────────────────
const mockPostMessage = vi.fn(async () => ({ ok: true, ts: '1234567890.123456' }));
const mockAuthTest = vi.fn(async () => ({ ok: true }));

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
    auth: { test: mockAuthTest },
  })),
}));

// ─── Mock config ──────────────────────────────────────────────────────────────
vi.mock('@shared/config/index.js', () => ({
  config: {
    dashboardUrl: 'https://app.causeflow.io',
  },
}));

import { SlackNotificationSubscriber } from '../../../../../src/shared/application/subscribers/slack-notification.subscriber.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'incident.created',
    occurredAt: '2026-04-24T10:00:00.000Z',
    tenantId: 'tenant-001',
    payload: {
      incidentId: 'inc-001',
      severity: 'critical',
      title: 'DB pool exhausted',
      ...overrides,
    },
  };
}

function makeInvestigationEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'investigation.completed',
    occurredAt: '2026-04-24T11:00:00.000Z',
    tenantId: 'tenant-001',
    payload: {
      incidentId: 'inc-001',
      rootCause: 'Connection leak in v2.3.1',
      recommendedActions: [
        { description: 'Restart pods', action: 'restart' },
        { description: 'Roll back to v2.3.0', action: 'rollback' },
      ],
      investigationDurationMs: 3_600_000,
      ...overrides,
    },
  };
}

function makeSlackConfig() {
  return {
    accessToken: JSON.stringify({
      ciphertext: 'encrypted-token',
      encryptedDek: 'dek',
      iv: 'iv',
      tag: 'tag',
    }),
    channelId: 'C1234567890',
    channel: '#incidents',
    webhookUrl: 'https://hooks.slack.com/xxx',
    workspaceId: 'T1234567890',
    workspaceName: 'Acme Corp',
    installedAt: '2026-04-24T00:00:00.000Z',
  };
}

function makeTokenEncryption() {
  return {
    decrypt: mockDecrypt,
    encrypt: mockEncrypt,
  } as any;
}

function makeTenantRepo(slackConfig?: ReturnType<typeof makeSlackConfig>) {
  return {
    findById: vi.fn(async () => ({
      tenantId: 'tenant-001',
      settings: slackConfig ? { slackConfig } : { slackConfig: undefined },
    })),
  } as any;
}

function makeIncidentRepo(incident?: Record<string, unknown>) {
  return {
    findById: vi.fn(
      async () =>
        incident ?? {
          incidentId: 'inc-001',
          tenantId: 'tenant-001',
          title: 'DB pool exhausted',
          severity: 'critical',
          status: 'open',
          sourceProvider: 'datadog',
          sourceAlertId: 'alert-001',
          slackNotificationTs: undefined,
          createdAt: '2026-04-24T10:00:00.000Z',
          updatedAt: '2026-04-24T10:00:00.000Z',
        },
    ),
    update: vi.fn(async () => ({})),
  } as any;
}

function makeSlackNotificationRepo(existing?: Record<string, unknown>) {
  return {
    findNotification: vi.fn(async () => existing ?? null),
    saveNotification: vi.fn(async () => ({
      tenantId: 't',
      incidentId: 'i',
      type: 'alert',
      status: 'sent',
    })),
    deleteByIncident: vi.fn(async () => undefined),
  } as any;
}

function makeLogger() {
  // verify decrypt is called with the parsed encrypted payload
  mockDecrypt.mockClear();
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SlackNotificationSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onIncidentCreated', () => {
    it('should NOT call postMessage for medium severity', async () => {
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        makeSlackNotificationRepo(),
        makeLogger(),
        makeTokenEncryption(),
      );

      await subscriber.onIncidentCreated(makeEvent({ severity: 'medium' }));

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should skip and log when slackConfig is not present', async () => {
      const logger = makeLogger();
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(undefined),
        makeIncidentRepo(),
        makeSlackNotificationRepo(),
        logger,
        makeTokenEncryption(),
      );

      await subscriber.onIncidentCreated(makeEvent({ severity: 'critical' }));

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-001', incidentId: 'inc-001' }),
        expect.stringContaining('not_configured'),
      );
    });

    it('should skip when dedup record already exists', async () => {
      const logger = makeLogger();
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        makeSlackNotificationRepo({
          tenantId: 'tenant-001',
          incidentId: 'inc-001',
          type: 'alert',
          status: 'sent',
        }),
        logger,
        makeTokenEncryption(),
      );

      await subscriber.onIncidentCreated(makeEvent({ severity: 'critical' }));

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-001', incidentId: 'inc-001' }),
        expect.stringContaining('dedup'),
      );
    });

    it('should call postMessage and save dedup record for critical incident', async () => {
      const notificationRepo = makeSlackNotificationRepo();
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        notificationRepo,
        makeLogger(),
        makeTokenEncryption(),
      );

      await subscriber.onIncidentCreated(makeEvent({ severity: 'critical' }));

      expect(mockPostMessage).toHaveBeenCalledOnce();
      // Verify decrypt was called with the parsed encrypted payload
      expect(mockDecrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          ciphertext: 'encrypted-token',
          encryptedDek: 'dek',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      expect(notificationRepo.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-001',
          incidentId: 'inc-001',
          type: 'alert',
          status: 'sent',
        }),
      );
    });

    it('should log error and NOT propagate exception when postMessage throws', async () => {
      const logger = makeLogger();
      mockPostMessage.mockRejectedValueOnce(new Error('slack_api_error'));

      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        makeSlackNotificationRepo(),
        logger,
        makeTokenEncryption(),
      );

      // Should not throw
      await expect(
        subscriber.onIncidentCreated(makeEvent({ severity: 'critical' })),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ incidentId: 'inc-001', error: 'slack_api_error' }),
        expect.any(String),
      );
    });
  });

  describe('onInvestigationCompleted', () => {
    it('should post resolution message with thread_ts from incident.slackNotificationTs', async () => {
      const incidentWithTs = {
        incidentId: 'inc-001',
        tenantId: 'tenant-001',
        title: 'DB pool exhausted',
        severity: 'critical',
        status: 'resolved',
        sourceProvider: 'datadog',
        sourceAlertId: 'alert-001',
        slackNotificationTs: '9999999999.000001',
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T11:00:00.000Z',
      };

      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(incidentWithTs),
        makeSlackNotificationRepo(),
        makeLogger(),
        makeTokenEncryption(),
      );

      await subscriber.onInvestigationCompleted(makeInvestigationEvent());

      expect(mockPostMessage).toHaveBeenCalledOnce();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const call = (mockPostMessage.mock.calls as any[])[0][0] as Record<string, unknown>;
      expect(call['thread_ts']).toBe('9999999999.000001');
    });

    it('should save dedup record with type=resolution', async () => {
      const notificationRepo = makeSlackNotificationRepo();
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        notificationRepo,
        makeLogger(),
        makeTokenEncryption(),
      );

      await subscriber.onInvestigationCompleted(makeInvestigationEvent());

      expect(notificationRepo.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'resolution', status: 'sent' }),
      );
    });

    it('should skip when slackConfig not configured', async () => {
      const logger = makeLogger();
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(undefined),
        makeIncidentRepo(),
        makeSlackNotificationRepo(),
        logger,
        makeTokenEncryption(),
      );

      await subscriber.onInvestigationCompleted(makeInvestigationEvent());

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should skip on dedup hit for resolution type', async () => {
      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        makeSlackNotificationRepo({
          tenantId: 'tenant-001',
          incidentId: 'inc-001',
          type: 'resolution',
          status: 'sent',
        }),
        makeLogger(),
        makeTokenEncryption(),
      );

      await subscriber.onInvestigationCompleted(makeInvestigationEvent());

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should log error and NOT propagate exception when postMessage throws', async () => {
      const logger = makeLogger();
      mockPostMessage.mockRejectedValueOnce(new Error('network_error'));

      const subscriber = new SlackNotificationSubscriber(
        makeTenantRepo(makeSlackConfig()),
        makeIncidentRepo(),
        makeSlackNotificationRepo(),
        logger,
        makeTokenEncryption(),
      );

      await expect(
        subscriber.onInvestigationCompleted(makeInvestigationEvent()),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'network_error' }),
        expect.any(String),
      );
    });
  });
});
