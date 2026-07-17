import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/shared/infra/llm/llm-factory.js', () => ({
  usesLocalLlmConnector: () => true,
}));

vi.mock('../../../../src/modules/oss/infra/investigation-llm-profile-active.store.js', () => ({
  getActiveInvestigationLlmProfileId: vi.fn().mockResolvedValue(null),
}));

import {
  NO_ACTIVE_INVESTIGATION_LLM_ERROR,
  NoActiveInvestigationLlmError,
  assertActiveInvestigationLlmProfile,
  composeReachableLlmBaseUrl,
  isRunningInDocker,
} from '../../../../src/modules/oss/infra/resolve-investigation-llm-profile.js';
import { resolveActiveLlmEndpoint } from '../../../../src/shared/infra/llm/llm-connector-profile.js';

describe('resolve-investigation-llm-profile (AC-090)', () => {
  it('composeReachableLlmBaseUrl rewrites host loopback Ornith only inside Docker (AC-025)', () => {
    const loopback = 'http://127.0.0.1:8081/v1';
    const localhost = 'http://localhost:8081/v1';
    const gateway = 'http://host.docker.internal:8081/v1';
    expect(composeReachableLlmBaseUrl(loopback, false)).toBe(loopback);
    expect(composeReachableLlmBaseUrl(localhost, false)).toBe(localhost);
    expect(composeReachableLlmBaseUrl(gateway, false)).toBe(gateway);
    expect(composeReachableLlmBaseUrl(loopback, true)).toBe(gateway);
    expect(composeReachableLlmBaseUrl(localhost, true)).toBe(gateway);
    expect(composeReachableLlmBaseUrl(gateway, true)).toBe(gateway);
    // Default path follows /.dockerenv detection (host unit tests usually false).
    expect(typeof isRunningInDocker()).toBe('boolean');
  });

  it('exposes a clear configure-Settings operator message', () => {
    expect(NO_ACTIVE_INVESTIGATION_LLM_ERROR).toContain('Configure an Investigation LLM in Settings');
    expect(new NoActiveInvestigationLlmError().message).toBe(NO_ACTIVE_INVESTIGATION_LLM_ERROR);
  });

  it('assertActiveInvestigationLlmProfile fails closed when no active profile', async () => {
    await expect(assertActiveInvestigationLlmProfile('tenant-1')).rejects.toBeInstanceOf(
      NoActiveInvestigationLlmError,
    );
  });

  it('resolveActiveLlmEndpoint does not fall back to legacy connectors in OSS when tenant has no profile', async () => {
    await expect(resolveActiveLlmEndpoint('tenant-1')).rejects.toBeInstanceOf(
      NoActiveInvestigationLlmError,
    );
  });

  it('resolveActiveLlmEndpoint without tenantId still allows legacy health probes', async () => {
    const endpoint = await resolveActiveLlmEndpoint();
    expect(endpoint.connectorId).toBeTruthy();
    expect(endpoint.baseUrl).toBeTruthy();
  });
});
