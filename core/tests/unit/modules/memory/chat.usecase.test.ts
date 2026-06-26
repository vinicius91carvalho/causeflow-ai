/**
 * Skeleton test for ChatUseCase — actor threading contract (Sprint 02).
 *
 * Full producer threading tests live in tests/unit/audit-actor-threading.test.ts.
 * This file satisfies the TDD hook requirement for chat.usecase.ts edits.
 */

import { describe, it, expect, vi } from 'vitest';
import { tenantId as toTenantId } from '../../../../src/shared/domain/value-objects.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { ChatUseCase } from '../../../../src/modules/memory/application/chat.usecase.js';

const TENANT_ID = toTenantId('tenant-test-001');

function makeDeps(overrides: Partial<ConstructorParameters<typeof ChatUseCase>[0]> = {}): ConstructorParameters<typeof ChatUseCase>[0] {
  const eventBus = new EventBus();
  const mockLlmClient = {
    complete: vi.fn(async () => ({
      content: { intent: 'general', reasoning: 'test' },
    })),
  };
  const mockAgentRunner = { run: vi.fn() };
  const mockCloudProvider = { name: 'stub' as const };
  const mockAgentMemory = { recall: vi.fn(async () => []), reflect: vi.fn(async () => 'ok'), retain: vi.fn() };
  const mockSseManager = { broadcast: vi.fn(async () => {}) };
  const mockToolHandlerFactory = vi.fn(() => vi.fn());
  const mockIncidentRepo = {
    create: vi.fn(async (i: unknown) => i),
    findById: vi.fn(async () => null),
    findBySourceAlert: vi.fn(async () => null),
    update: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
    listByTenant: vi.fn(async () => ({ items: [], cursor: undefined })),
    findBySeverity: vi.fn(async () => ({ items: [] })),
    findByStatus: vi.fn(async () => ({ items: [] })),
    listByCreatedAt: vi.fn(async () => ({ items: [], cursor: undefined })),
    findAll: vi.fn(async () => []),
  };

  return {
    agentRunner: mockAgentRunner as unknown as ConstructorParameters<typeof ChatUseCase>[0]['agentRunner'],
    llmClient: mockLlmClient as unknown as ConstructorParameters<typeof ChatUseCase>[0]['llmClient'],
    cloudProvider: mockCloudProvider as unknown as ConstructorParameters<typeof ChatUseCase>[0]['cloudProvider'],
    agentMemory: mockAgentMemory as unknown as ConstructorParameters<typeof ChatUseCase>[0]['agentMemory'],
    incidentRepo: mockIncidentRepo as unknown as ConstructorParameters<typeof ChatUseCase>[0]['incidentRepo'],
    eventBus,
    sseManager: mockSseManager as unknown as ConstructorParameters<typeof ChatUseCase>[0]['sseManager'],
    toolHandlerFactory: mockToolHandlerFactory as unknown as ConstructorParameters<typeof ChatUseCase>[0]['toolHandlerFactory'],
    ...overrides,
  };
}

describe('ChatUseCase — actor threading (Sprint 02)', () => {
  it('ChatInput accepts actorUserId and actorEmail fields without type error', async () => {
    const useCase = new ChatUseCase(makeDeps());
    // If this compiles and runs without throwing, the DTO fields are wired correctly.
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      message: 'hello',
      actorUserId: 'user_abc',
      actorEmail: 'alice@example.com',
    });
    expect(result).toBeDefined();
    expect(result.intent).toBe('general');
  });

  it('ChatInput works without actorUserId/actorEmail (backwards compat)', async () => {
    const useCase = new ChatUseCase(makeDeps());
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      message: 'hello',
    });
    expect(result).toBeDefined();
  });
});
