import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing the service
vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    composio: { apiKey: 'test-api-key' },
    apiUrl: 'https://api.causeflow.ai',
  },
}));

// Mock logger
vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the composio client singleton
vi.mock('../../../../src/shared/infra/integrations/composio-client.js', () => ({
  getComposioClient: vi.fn(),
  COMPOSIO_APP_MAP: {
    sentry: 'sentry',
    github: 'github',
  },
}));

import { ComposioTriggerService } from '../../../../src/shared/infra/integrations/composio-trigger-service.js';
import { getComposioClient } from '../../../../src/shared/infra/integrations/composio-client.js';

describe('ComposioTriggerService.createTrigger', () => {
  let service: ComposioTriggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ComposioTriggerService();
  });

  describe('webhook-only providers (sentry, pagerduty, datadog)', () => {
    it('short-circuits for sentry — returns empty composioTriggerId without calling Composio', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.createTrigger('conn-123', 'SENTRY_NEW_ISSUE', {}, 'sentry');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.composioTriggerId).toBe('');
      expect(result.connectedAccountId).toBe('conn-123');

      vi.unstubAllGlobals();
    });

    it('short-circuits for pagerduty without calling Composio', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.createTrigger(
        'conn-456',
        'PAGERDUTY_INCIDENT_TRIGGERED',
        {},
        'pagerduty',
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.composioTriggerId).toBe('');

      vi.unstubAllGlobals();
    });

    it('short-circuits for datadog without calling Composio', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.createTrigger(
        'conn-789',
        'DATADOG_MONITOR_TRIGGERED',
        {},
        'datadog',
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.composioTriggerId).toBe('');

      vi.unstubAllGlobals();
    });
  });

  describe('GitHub (Composio-backed providers)', () => {
    it('calls Composio HTTP upsert for GitHub triggers', async () => {
      vi.mocked(getComposioClient).mockResolvedValue(null);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ trigger_id: 'github-trigger-abc' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.createTrigger(
        'conn-github-123',
        'GITHUB_COMMIT_EVENT',
        { repo: 'test' },
        'github',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('trigger_instances/GITHUB_COMMIT_EVENT/upsert'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.composioTriggerId).toBe('github-trigger-abc');
      expect(result.connectedAccountId).toBe('conn-github-123');

      vi.unstubAllGlobals();
    });

    it('does NOT throw for GitHub trigger when SDK client is null (HTTP fallback)', async () => {
      vi.mocked(getComposioClient).mockResolvedValue(null);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ trigger_id: 'trigger-ok' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        service.createTrigger('conn-123', 'GITHUB_PULL_REQUEST_EVENT', {}, 'github'),
      ).resolves.not.toThrow();

      vi.unstubAllGlobals();
    });
  });

  describe('deleteTrigger', () => {
    it('no-ops immediately when composioTriggerId is empty (webhook-only providers)', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await service.deleteTrigger('');

      expect(mockFetch).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
