import { describe, it, expect, vi } from 'vitest';
import { DispatchInvestigationUseCase } from '../../../../src/modules/investigation/application/dispatch-investigation.usecase.js';
import { InvestigationModeRegistry } from '../../../../src/modules/investigation/application/modes/registry.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { InvestigationMode } from '../../../../src/modules/investigation/application/modes/types.js';
import type { InvestigationInput, InvestigationResult } from '../../../../src/modules/investigation/domain/investigation.types.js';
import type { MetricRecorder } from '../../../../src/shared/application/ports/metric-recorder.port.js';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));

const BASE_RESULT: InvestigationResult = {
    findings: [{ text: 'x', evidenceIds: [] }],
    potentialRootCause: 'y',
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
        createdAt: '2026-04-17T00:00:00Z',
        updatedAt: '2026-04-17T00:00:00Z',
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

function makeMode(
    name: 'orchestrator' | 'hypothesis' | 'debate',
    impl?: (i: InvestigationInput) => Promise<InvestigationResult>,
): InvestigationMode {
    return {
        name,
        label: name,
        description: 'x',
        run: vi.fn(impl ?? (async () => BASE_RESULT)),
    };
}

function makeMetrics(): MetricRecorder {
    return {
        increment: vi.fn(),
        gauge: vi.fn(),
        histogram: vi.fn(),
    };
}

const INPUT: InvestigationInput = {
    tenantId: tenantId('tenant-1'),
    incidentId: incidentId('inc-1'),
    suggestedAgents: [],
};

describe('DispatchInvestigationUseCase — metrics', () => {
    it('emits mode_invoked + mode_duration_ms on success', async () => {
        const metrics = makeMetrics();
        const registry = new InvestigationModeRegistry([makeMode('orchestrator')]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident()),
            registry,
            metrics,
        });

        await uc.execute(INPUT);

        expect(metrics.increment).toHaveBeenCalledWith(
            'investigation.mode_invoked',
            1,
            { mode: 'orchestrator' },
        );
        expect(metrics.histogram).toHaveBeenCalledWith(
            'investigation.mode_duration_ms',
            expect.any(Number),
            { mode: 'orchestrator', outcome: 'success' },
        );
    });

    it('tags durations with mode from stamped incident', async () => {
        const metrics = makeMetrics();
        const registry = new InvestigationModeRegistry([
            makeMode('orchestrator'),
            makeMode('debate'),
        ]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ investigationMode: 'debate' })),
            registry,
            metrics,
        });

        await uc.execute(INPUT);

        expect(metrics.increment).toHaveBeenCalledWith(
            'investigation.mode_invoked',
            1,
            { mode: 'debate' },
        );
        expect(metrics.histogram).toHaveBeenCalledWith(
            'investigation.mode_duration_ms',
            expect.any(Number),
            { mode: 'debate', outcome: 'success' },
        );
    });

    it('emits mode_failed + error duration on throw', async () => {
        const metrics = makeMetrics();
        const failingMode = makeMode('hypothesis', async () => {
            throw new Error('boom');
        });
        const registry = new InvestigationModeRegistry([failingMode]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident({ investigationMode: 'hypothesis' })),
            registry,
            metrics,
        });

        await expect(uc.execute(INPUT)).rejects.toThrow('boom');

        expect(metrics.increment).toHaveBeenCalledWith(
            'investigation.mode_failed',
            1,
            { mode: 'hypothesis' },
        );
        expect(metrics.histogram).toHaveBeenCalledWith(
            'investigation.mode_duration_ms',
            expect.any(Number),
            { mode: 'hypothesis', outcome: 'error' },
        );
    });

    it('does not crash when metrics is undefined', async () => {
        const registry = new InvestigationModeRegistry([makeMode('orchestrator')]);
        const uc = new DispatchInvestigationUseCase({
            incidentRepo: makeRepo(makeIncident()),
            registry,
        });
        await expect(uc.execute(INPUT)).resolves.toEqual(BASE_RESULT);
    });
});
