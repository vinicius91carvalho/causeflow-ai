import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetChatUseCase } from '../../../../src/modules/widget/application/widget-chat.usecase.js';
import type { IWidgetSessionRepository } from '../../../../src/modules/widget/domain/widget-session.repository.js';
import type { WidgetSession } from '../../../../src/modules/widget/domain/widget-session.entity.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import type { ChatUseCase } from '../../../../src/modules/memory/application/chat.usecase.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import { DataMasker } from '../../../../src/modules/widget/application/data-masker.js';
import { ResponseFormatter } from '../../../../src/modules/widget/application/response-formatter.js';
import { FollowUpGenerator } from '../../../../src/modules/widget/application/follow-up-generator.js';
import { tenantId, widgetSessionId } from '../../../../src/shared/domain/value-objects.js';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const TID = tenantId('tenant-1');
const SID = widgetSessionId('ws-test123');

function createActiveSession(overrides: Partial<WidgetSession> = {}): WidgetSession {
  return {
    sessionId: SID,
    tenantId: TID,
    messages: [],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-02T00:00:00Z',
    ...overrides,
  };
}

function createMocks() {
  const sessionRepo: IWidgetSessionRepository = {
    create: vi.fn(async (s: WidgetSession) => s),
    findById: vi.fn(async () => createActiveSession()),
    appendMessage: vi.fn(),
    updatePushSubscription: vi.fn(),
    close: vi.fn(),
  };

  const chatUseCase = {
    execute: vi.fn(async () => ({
      chatId: 'chat-abc',
      message: 'test',
      intent: 'general' as const,
      status: 'completed' as const,
      answer: 'Hello from CauseFlow!',
    })),
  } as unknown as ChatUseCase;

  const llmClient: LLMClient = {
    complete: vi.fn(async () => ({
      content: JSON.stringify({ needsFollowUp: false, questions: [] }),
      usage: { inputTokens: 10, outputTokens: 10 },
      model: 'haiku',
      costUsd: 0,
    })),
  } as any;

  const tenantRepo: ITenantRepository = {
    create: vi.fn(),
    findById: vi.fn(async () => ({
      tenantId: TID,
      name: 'Acme',
      slug: 'acme',
      ownerEmail: 'a@b.com',
      plan: 'starter' as const,
      status: 'active' as const,
      settings: { maxIncidentsPerMonth: 50, autoRemediation: false, notificationChannels: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    })),
    findBySlug: vi.fn(),
    findByCustomDomain: vi.fn(),
    update: vi.fn(),
    listByOwner: vi.fn(),
  };

  return {
    sessionRepo,
    chatUseCase,
    llmClient,
    tenantRepo,
    dataMasker: new DataMasker(),
    responseFormatter: new ResponseFormatter(),
    followUpGenerator: new FollowUpGenerator(llmClient),
  };
}

describe('WidgetChatUseCase', () => {
  let mocks: ReturnType<typeof createMocks>;
  let useCase: WidgetChatUseCase;

  beforeEach(() => {
    mocks = createMocks();
    useCase = new WidgetChatUseCase(mocks);
  });

  describe('createSession', () => {
    it('should create a new session with generated ID', async () => {
      const session = await useCase.createSession(TID, 'agent@co.com', 'Agent');

      expect(session.tenantId).toBe(TID);
      expect(session.sessionId).toMatch(/^ws-/);
      expect(session.agentId).toBe('agent@co.com');
      expect(session.agentName).toBe('Agent');
      expect(session.status).toBe('active');
      expect(mocks.sessionRepo.create).toHaveBeenCalledOnce();
    });
  });

  describe('execute', () => {
    it('should delegate to ChatUseCase and return formatted response', async () => {
      const result = await useCase.execute({
        tenantId: TID,
        sessionId: SID,
        message: 'hello',
      });

      expect(result.sessionId).toBe(SID);
      expect(result.response.text).toBe('Hello from CauseFlow!');
      expect(result.status).toBe('completed');
      expect(mocks.sessionRepo.appendMessage).toHaveBeenCalledTimes(2); // user + assistant
    });

    it('should throw when session not found', async () => {
      vi.mocked(mocks.sessionRepo.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({ tenantId: TID, sessionId: SID, message: 'test' }),
      ).rejects.toThrow('Session not found or closed');
    });

    it('should throw when session is closed', async () => {
      vi.mocked(mocks.sessionRepo.findById).mockResolvedValue(
        createActiveSession({ status: 'closed' }),
      );

      await expect(
        useCase.execute({ tenantId: TID, sessionId: SID, message: 'test' }),
      ).rejects.toThrow('Session not found or closed');
    });

    it('should reject when message limit is reached', async () => {
      const fullSession = createActiveSession({
        messages: Array.from({ length: 50 }, (_, i) => ({
          role: 'user' as const,
          content: `msg ${i}`,
          timestamp: '2024-01-01T00:00:00Z',
        })),
      });
      vi.mocked(mocks.sessionRepo.findById).mockResolvedValue(fullSession);

      const result = await useCase.execute({
        tenantId: TID,
        sessionId: SID,
        message: 'one more',
      });

      expect(result.response.text).toContain('limite');
      expect(mocks.chatUseCase.execute).not.toHaveBeenCalled();
    });

    it('should apply data masking when configured', async () => {
      vi.mocked(mocks.tenantRepo.findById).mockResolvedValue({
        tenantId: TID,
        name: 'Acme',
        slug: 'acme',
        ownerEmail: 'a@b.com',
        plan: 'starter',
        status: 'active',
        settings: {
          maxIncidentsPerMonth: 50,
          autoRemediation: false,
          notificationChannels: [],
          widgetConfig: {
            enabled: true,
            allowedOrigins: ['*'],
            branding: {},
            dataMasking: {
              enabled: true,
              rules: [{ type: 'ip_address', enabled: true }],
            },
          },
        },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      } as unknown as Tenant);

      vi.mocked(mocks.chatUseCase.execute).mockResolvedValue({
        chatId: 'chat-x',
        message: 'test',
        intent: 'general',
        status: 'completed',
        answer: 'Server at 10.0.0.1 is down',
      });

      const result = await useCase.execute({
        tenantId: TID,
        sessionId: SID,
        message: 'whats wrong?',
      });

      expect(result.response.text).not.toContain('10.0.0.1');
      expect(result.response.text).toContain('***REDACTED***');
    });

    it('should build context from conversation history', async () => {
      const sessionWithHistory = createActiveSession({
        messages: [
          { role: 'user', content: 'OTP not received', timestamp: '2024-01-01T00:00:00Z' },
          { role: 'assistant', content: 'Which client?', timestamp: '2024-01-01T00:00:01Z' },
        ],
      });
      vi.mocked(mocks.sessionRepo.findById).mockResolvedValue(sessionWithHistory);

      await useCase.execute({
        tenantId: TID,
        sessionId: SID,
        message: 'Client Acme Corp',
      });

      expect(mocks.chatUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('OTP not received'),
        }),
      );
    });
  });
});
