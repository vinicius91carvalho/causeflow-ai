/**
 * TDD RED PHASE — Sprint 01: Audit Actor Attribution Threading
 * Integration test: authenticated HTTP request → audit row with actorType:'user'
 *
 * This test MUST FAIL against current production code because:
 *   1. memory.routes.ts does NOT pass userId/userEmail from context into chat.execute()
 *   2. ChatUseCase does NOT thread actorUserId/actorEmail into incident.created payload
 *   3. Bootstrap audit handler does NOT map actorUserId → actorType:'user'
 *
 * After Sprint 02+03 this test will pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../src/shared/infra/http/hono-types.js';
import { EventBus } from '../../src/shared/domain/events.js';
import {
  tenantId as toTenantId,
  incidentId as toIncidentId,
} from '../../src/shared/domain/value-objects.js';
import { CreateAuditEntryUseCase } from '../../src/modules/audit/application/create-audit-entry.usecase.js';
import type { IAuditRepository } from '../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../src/modules/audit/domain/audit.entity.js';
import type { Incident } from '../../src/modules/ingestion/domain/incident.entity.js';
import type { IIncidentRepository } from '../../src/modules/ingestion/domain/incident.repository.js';
import { signLocalJwt } from '../helpers/local-auth-jwt.js';

vi.mock('../../src/shared/config/index.js', () => ({
  config: {
    clerk: { secretKey: '' },
    logLevel: 'silent',
    auth: {
      jwtSecret: 'test-secret',
      jwtIssuer: 'causeflow',
      jwtAudience: 'causeflow-api',
    },
    isDev: () => false,
    isProd: () => false,
    isTest: () => true,
    isOss: () => true,
  },
}));

// Mock Redis so memory.routes.ts /summary and other endpoints don't connect
vi.mock('../../src/shared/infra/cache/redis-client.js', () => ({
  getRedisClient: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = toTenantId('tenant-integration-001');
const ACTOR_USER_ID = 'user_abc';
const ACTOR_EMAIL = 'alice@example.com';

function makeMockIncidentRepo(): IIncidentRepository {
  const mockIncident: Incident = {
    incidentId: toIncidentId('inc-integration-001'),
    tenantId: TENANT_ID,
    title: 'API 500 errors',
    description: 'The payment service is returning 500 errors',
    severity: 'high',
    status: 'open',
    sourceProvider: 'chat',
    sourceAlertId: 'alert-integration-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    create: vi.fn(async (i: Incident): Promise<Incident> => i),
    findById: vi.fn(async () => mockIncident),
    findBySourceAlert: vi.fn(async () => null),
    update: vi.fn(async (_id: unknown, _tid: unknown, data: Partial<Incident>): Promise<Incident> => ({ ...mockIncident, ...data })),
    updateStatus: vi.fn(async (): Promise<Incident> => mockIncident),
    listByTenant: vi.fn(async () => ({ items: [], cursor: undefined })),
    findBySeverity: vi.fn(async (): Promise<{ items: Incident[]; cursor?: string }> => ({ items: [] })),
    findByStatus: vi.fn(async (): Promise<{ items: Incident[]; cursor?: string }> => ({ items: [] })),
    listByCreatedAt: vi.fn(async () => ({ items: [], cursor: undefined })),
    findAll: vi.fn(async (): Promise<Incident[]> => []),
  };
}

function makeMockAuditRepo(): IAuditRepository {
  return {
    create: vi.fn(async (entry: AuditEntry): Promise<AuditEntry> => entry),
    getLastEntry: vi.fn(async () => null),
    findByTenant: vi.fn(async () => ({ items: [], cursor: undefined })),
    findByAction: vi.fn(async () => ({ items: [], cursor: undefined })),
    pseudonymizeActor: vi.fn(async () => 0),
    findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
    deleteBatch: vi.fn(async () => 0),
  };
}

// ── Integration test ──────────────────────────────────────────────────────────

describe('Integration: authenticated chat → incident.created audit row with actorType:user', () => {
  let app: Hono<AppEnv>;
  let auditRepo: IAuditRepository;
  let eventBus: EventBus;
  let authToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    authToken = await signLocalJwt({
      sub: ACTOR_USER_ID,
      email: ACTOR_EMAIL,
      tenant_id: TENANT_ID,
      roles: ['admin'],
    });

    eventBus = new EventBus();
    auditRepo = makeMockAuditRepo();
    const createAuditEntry = new CreateAuditEntryUseCase(auditRepo);

    // Wire TARGET audit handler for incident.created
    // (mirrors the contract Sprint 02/03 will implement in bootstrap.ts)
    // NOTE: The current bootstrap.ts does NOT wire actorUserId → actorType:'user'
    // This handler tests the DESIRED behaviour — it will be called in the flow
    // only if the route + use case thread the actor fields correctly (they don't yet)
    eventBus.subscribe('incident.created', async (event) => {
      const actorUserId = event.payload['actorUserId'] as string | undefined;
      const actorEmail = event.payload['actorEmail'] as string | undefined;
      await createAuditEntry.execute({
        tenantId: toTenantId(event.tenantId),
        action: 'incident.created',
        actorType: actorUserId ? 'user' : 'system',
        actorEmail: actorEmail ?? 'system@causeflow.ai',
        resourceType: 'incident',
        resourceId: (event.payload['incidentId'] as string) ?? '',
        changes: event.payload,
      });
    });

    // Build a minimal Hono app that mimics the real app:
    //   authMiddleware → memory routes → ChatUseCase
    const { authMiddleware } = await import(
      '../../src/shared/infra/http/middleware/auth.middleware.js'
    );

    // Mock LLM client so ChatUseCase classifies intent as 'incident'
    const mockLlmClient = {
      complete: vi.fn(async () => ({
        content: {
          intent: 'incident',
          title: 'API returning 500 errors',
          reasoning: 'User reports 500 errors',
        },
      })),
    };
    const mockAgentRunner = { run: vi.fn(async () => ({ response: 'Investigating...' })) };
    const mockCloudProvider = { name: 'stub' as const };
    const mockAgentMemory = {
      recall: vi.fn(async () => []),
      reflect: vi.fn(async () => 'No prior context'),
      retain: vi.fn(async () => {}),
    };
    const mockSseManager = { broadcast: vi.fn(async () => {}) };
    const mockToolHandlerFactory = vi.fn(() => vi.fn(async () => ({ result: 'ok' })));

    const { ChatUseCase } = await import(
      '../../src/modules/memory/application/chat.usecase.js'
    );
    const { createMemoryRoutes } = await import(
      '../../src/modules/memory/infra/memory.routes.js'
    );
    const mockRunbookRegistry = {
      listByTenant: vi.fn(async () => []),
      upsert: vi.fn(async () => {}),
      findByHash: vi.fn(async () => null),
      confirm: vi.fn(async () => {}),
    };

    const chatUseCase = new ChatUseCase({
      agentRunner: mockAgentRunner as unknown as ConstructorParameters<typeof ChatUseCase>[0]['agentRunner'],
      llmClient: mockLlmClient as unknown as ConstructorParameters<typeof ChatUseCase>[0]['llmClient'],
      cloudProvider: mockCloudProvider as unknown as ConstructorParameters<typeof ChatUseCase>[0]['cloudProvider'],
      agentMemory: mockAgentMemory as unknown as ConstructorParameters<typeof ChatUseCase>[0]['agentMemory'],
      incidentRepo: makeMockIncidentRepo(),
      eventBus,
      sseManager: mockSseManager as unknown as ConstructorParameters<typeof ChatUseCase>[0]['sseManager'],
      toolHandlerFactory: mockToolHandlerFactory as unknown as ConstructorParameters<typeof ChatUseCase>[0]['toolHandlerFactory'],
    });

    app = new Hono<AppEnv>();
    app.use('*', authMiddleware);
    app.route(
      '/v1/memory',
      createMemoryRoutes({
        agentMemory: mockAgentMemory as unknown as Parameters<typeof createMemoryRoutes>[0]['agentMemory'],
        runbookRegistry: mockRunbookRegistry as unknown as Parameters<typeof createMemoryRoutes>[0]['runbookRegistry'],
        chat: chatUseCase,
      }),
    );
  });

  it('POST /v1/memory/chat with valid Bearer token → audit entry has actorType:user + actorUserId + actorEmail', async () => {
    const res = await app.request('/v1/memory/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'API is returning 500 errors for all users right now',
      }),
    });

    // Chat should respond (even if 200 or 503 — we care about audit side effect)
    // The route must have been called — if auth fails we get 401
    expect(res.status).not.toBe(401);

    // Wait for async event handlers to settle
    await new Promise((r) => setTimeout(r, 50));

    // Exactly one incident.created audit entry should exist
    expect(auditRepo.create).toHaveBeenCalledTimes(1);

    const entry = (auditRepo.create as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AuditEntry;

    // FAIL against current code — the route passes neither actorUserId nor actorEmail
    // to chat.execute(), so the event payload has no actor fields, so the handler
    // falls back to actorType:'system'. After Sprint 02+03 this will be 'user'.
    expect(entry.actorType).toBe('user');
    expect(entry.actorEmail).toBe(ACTOR_EMAIL);
  });
});
