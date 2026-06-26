import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTriggerUseCase } from '../../../../src/modules/integration/application/create-trigger.usecase.js';
import { TriggerAlreadyExistsError } from '../../../../src/modules/integration/domain/trigger.errors.js';
import { tenantId, triggerId } from '../../../../src/shared/domain/value-objects.js';
import type { ITriggerRepository } from '../../../../src/modules/integration/domain/trigger.repository.js';
import type { Trigger } from '../../../../src/modules/integration/domain/trigger.entity.js';
import type { ComposioTriggerService } from '../../../../src/shared/infra/integrations/composio-trigger-service.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const TENANT_ID = tenantId('tenant-trigger-test-001');

const BASE_TRIGGER: Trigger = {
    triggerId: triggerId('trigger-id-001'),
    tenantId: TENANT_ID,
    triggerSlug: 'SENTRY_NEW_ISSUE',
    provider: 'sentry',
    composioTriggerId: 'composio-trigger-abc',
    connectedAccountId: 'conn-acc-123',
    config: {},
    status: 'active',
    eventCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeMockRepo(existingTrigger: Trigger | null = null): ITriggerRepository {
    return {
        create: vi.fn(async (t: Trigger) => t),
        findById: vi.fn(async () => null),
        findByComposioTriggerId: vi.fn(async () => null),
        findByTenantProviderSlug: vi.fn(async () => existingTrigger),
        listByTenant: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
    };
}

function makeMockComposioService(): ComposioTriggerService {
    return {
        createTrigger: vi.fn(async () => ({
            composioTriggerId: 'composio-trigger-abc',
            connectedAccountId: 'conn-acc-123',
        })),
        deleteTrigger: vi.fn(async () => undefined),
        listAvailableTriggers: vi.fn(async () => ({})),
        getTriggersForProvider: vi.fn(async () => []),
        getComposioApp: vi.fn(() => 'sentry'),
        registerWebhookSubscription: vi.fn(async () => ({ registered: true, url: '' })),
        baseUrl: 'https://backend.composio.dev/api/v3',
    } as unknown as ComposioTriggerService;
}

function makeMockEventBus(): IEventBus {
    return {
        publish: vi.fn(async () => undefined),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateTriggerUseCase', () => {
    let repo: ITriggerRepository;
    let composioService: ComposioTriggerService;
    let eventBus: IEventBus;
    let useCase: CreateTriggerUseCase;

    beforeEach(() => {
        repo = makeMockRepo(null); // no existing trigger by default
        composioService = makeMockComposioService();
        eventBus = makeMockEventBus();
        useCase = new CreateTriggerUseCase(repo, composioService, eventBus);
    });

    it('creates a trigger when no duplicate exists', async () => {
        const result = await useCase.execute({
            tenantId: TENANT_ID,
            triggerSlug: 'SENTRY_NEW_ISSUE',
            provider: 'sentry',
            config: {},
            connectedAccountId: 'conn-acc-123',
        });

        expect(result.triggerSlug).toBe('SENTRY_NEW_ISSUE');
        expect(result.provider).toBe('sentry');
        expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('throws TriggerAlreadyExistsError when findByTenantProviderSlug returns existing trigger', async () => {
        // Simulate duplicate found
        repo = makeMockRepo(BASE_TRIGGER);
        useCase = new CreateTriggerUseCase(repo, composioService, eventBus);

        await expect(
            useCase.execute({
                tenantId: TENANT_ID,
                triggerSlug: 'SENTRY_NEW_ISSUE',
                provider: 'sentry',
                config: {},
                connectedAccountId: 'conn-acc-123',
            }),
        ).rejects.toThrow(TriggerAlreadyExistsError);
    });

    it('does not call composioService.createTrigger when duplicate found', async () => {
        repo = makeMockRepo(BASE_TRIGGER);
        useCase = new CreateTriggerUseCase(repo, composioService, eventBus);

        await expect(
            useCase.execute({
                tenantId: TENANT_ID,
                triggerSlug: 'SENTRY_NEW_ISSUE',
                provider: 'sentry',
                config: {},
                connectedAccountId: 'conn-acc-123',
            }),
        ).rejects.toThrow(TriggerAlreadyExistsError);

        expect(composioService.createTrigger).not.toHaveBeenCalled();
    });

    it('TriggerAlreadyExistsError has correct slug and tenantId', async () => {
        repo = makeMockRepo(BASE_TRIGGER);
        useCase = new CreateTriggerUseCase(repo, composioService, eventBus);

        let caught: unknown;
        await useCase
            .execute({
                tenantId: TENANT_ID,
                triggerSlug: 'SENTRY_NEW_ISSUE',
                provider: 'sentry',
                config: {},
                connectedAccountId: 'conn-acc-123',
            })
            .catch((e: unknown) => { caught = e; });

        expect(caught).toBeInstanceOf(TriggerAlreadyExistsError);
        const error = caught as TriggerAlreadyExistsError;
        expect(error.triggerSlug).toBe('SENTRY_NEW_ISSUE');
        expect(error.tenantId).toBe(String(TENANT_ID));
    });

    it('publishes trigger.created event on success', async () => {
        await useCase.execute({
            tenantId: TENANT_ID,
            triggerSlug: 'SENTRY_NEW_ISSUE',
            provider: 'sentry',
            config: {},
            connectedAccountId: 'conn-acc-123',
        });

        expect(eventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'trigger.created' }),
        );
    });
});
