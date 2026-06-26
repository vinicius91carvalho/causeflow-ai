import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispatchInvestigationUseCase } from '../../../../src/modules/investigation/application/dispatch-investigation.usecase.js';
import { InvestigationModeRegistry, UnknownInvestigationModeError } from '../../../../src/modules/investigation/application/modes/registry.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident, InvestigationMode as IncidentInvestigationMode } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { InvestigationMode } from '../../../../src/modules/investigation/application/modes/types.js';
import type { InvestigationInput, InvestigationResult } from '../../../../src/modules/investigation/domain/investigation.types.js';

const mockLogger = vi.hoisted(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
}));
vi.mock('../../../../src/shared/infra/logger.js', () => ({
    logger: mockLogger,
}));

const BASE_RESULT: InvestigationResult = {
    findings: [{ text: 'f', evidenceIds: [] }],
    potentialRootCause: 'cause',
    recommendedActions: [],
    evidence: [],
};

function makeIncident(overrides?: Partial<Incident>): Incident {
    return {
        incidentId: incidentId('inc-1'),
        tenantId: tenantId('tenant-1'),
        title: 't',
        description: 'd',
        severity: 'high',
        status: 'triaging',
        sourceProvider: 'manual',
        sourceAlertId: '',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

function makeRepo(incident: Incident | null): IIncidentRepository {
    return {
        create: vi.fn(),
        findById: vi.fn(async () => incident),
        findBySourceAlert: vi.fn(),
        update: vi.fn(),
        updateStatus: vi.fn(),
        listByTenant: vi.fn(),
        findBySeverity: vi.fn(),
        findByStatus: vi.fn(),
        listByCreatedAt: vi.fn(),
        findAll: vi.fn(),
    };
}

function makeMode(name: 'orchestrator' | 'hypothesis' | 'debate', impl?: (i: InvestigationInput) => Promise<InvestigationResult>): InvestigationMode {
    return {
        name,
        label: `label-${name}`,
        description: `desc-${name}`,
        run: vi.fn(impl ?? (async () => BASE_RESULT)),
    };
}

const INPUT: InvestigationInput = {
    tenantId: tenantId('tenant-1'),
    incidentId: incidentId('inc-1'),
    suggestedAgents: ['log_analyst'],
};

describe('DispatchInvestigationUseCase', () => {
    beforeEach(() => {
        mockLogger.warn.mockClear();
        mockLogger.info.mockClear();
    });

    it('dispatches to orchestrator by default when mode is undefined', async () => {
        const orchestrator = makeMode('orchestrator');
        const hypothesis = makeMode('hypothesis');
        const registry = new InvestigationModeRegistry([orchestrator, hypothesis]);
        const uc = new DispatchInvestigationUseCase({ incidentRepo: makeRepo(makeIncident()), registry });

        const result = await uc.execute(INPUT);

        expect(orchestrator.run).toHaveBeenCalledOnce();
        expect(hypothesis.run).not.toHaveBeenCalled();
        expect(result).toEqual(BASE_RESULT);
    });

    it('dispatches to the stamped mode when set on incident', async () => {
        const orchestrator = makeMode('orchestrator');
        const hypothesis = makeMode('hypothesis', async () => ({ ...BASE_RESULT, potentialRootCause: 'h' }));
        const registry = new InvestigationModeRegistry([orchestrator, hypothesis]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ investigationMode: 'hypothesis' })),
            registry,
        });

        const result = await uc.execute(INPUT);

        expect(hypothesis.run).toHaveBeenCalledOnce();
        expect(orchestrator.run).not.toHaveBeenCalled();
        expect(result.potentialRootCause).toBe('h');
    });

    it('throws NotFoundError when incident does not exist', async () => {
        const registry = new InvestigationModeRegistry([makeMode('orchestrator')]);
        const uc = new DispatchInvestigationUseCase({ incidentRepo: makeRepo(null), registry });

        await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws UnknownInvestigationModeError when mode is not registered', async () => {
        const registry = new InvestigationModeRegistry([makeMode('orchestrator')]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ investigationMode: 'debate' as IncidentInvestigationMode })),
            registry,
        });

        await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(UnknownInvestigationModeError);
    });

    it('fires shadow mode when stamped and different from primary', async () => {
        const orchestrator = makeMode('orchestrator');
        const debateShadowRun = vi.fn<(input: InvestigationInput) => Promise<InvestigationResult>>(
            async () => BASE_RESULT,
        );
        const debate: InvestigationMode = {
            name: 'debate',
            label: 'l',
            description: 'd',
            run: debateShadowRun,
        };
        const registry = new InvestigationModeRegistry([orchestrator, debate]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ shadowInvestigationMode: 'debate' })),
            registry,
        });

        await uc.execute(INPUT);

        // Let the fire-and-forget shadow settle
        await new Promise((r) => setImmediate(r));

        expect(orchestrator.run).toHaveBeenCalledOnce();
        expect(debateShadowRun).toHaveBeenCalledOnce();
        // Shadow must strip the channel so it never emits to the tenant UI
        const firstCall = debateShadowRun.mock.calls[0];
        expect(firstCall?.[0]?.channel).toBeUndefined();
    });

    it('does not fire shadow when same mode as primary', async () => {
        const orchestrator = makeMode('orchestrator');
        const registry = new InvestigationModeRegistry([orchestrator]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ shadowInvestigationMode: 'orchestrator' })),
            registry,
        });

        await uc.execute(INPUT);
        await new Promise((r) => setImmediate(r));

        expect(orchestrator.run).toHaveBeenCalledOnce();
    });

    it('shadow failure is swallowed and does not fail primary', async () => {
        const orchestrator = makeMode('orchestrator');
        const debate: InvestigationMode = {
            name: 'debate',
            label: 'l',
            description: 'd',
            run: vi.fn(async () => { throw new Error('shadow boom'); }),
        };
        const registry = new InvestigationModeRegistry([orchestrator, debate]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ shadowInvestigationMode: 'debate' })),
            registry,
        });

        const result = await uc.execute(INPUT);
        await new Promise((r) => setImmediate(r));

        expect(result).toEqual(BASE_RESULT);
        expect(mockLogger.warn).toHaveBeenCalled();
    });
});

describe('InvestigationModeRegistry', () => {
    it('throws on duplicate mode registration', () => {
        expect(() => new InvestigationModeRegistry([makeMode('orchestrator'), makeMode('orchestrator')])).toThrow(
            /Duplicate/,
        );
    });

    it('list() returns all registered modes', () => {
        const registry = new InvestigationModeRegistry([makeMode('orchestrator'), makeMode('hypothesis')]);
        expect(registry.list().map((m) => m.name).sort()).toEqual(['hypothesis', 'orchestrator']);
    });

    it('has() reports registration state', () => {
        const registry = new InvestigationModeRegistry([makeMode('orchestrator')]);
        expect(registry.has('orchestrator')).toBe(true);
        expect(registry.has('debate')).toBe(false);
    });
});
