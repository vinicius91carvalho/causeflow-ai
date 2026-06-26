/**
 * OrchestratorMode — unit tests
 *
 * Minimal skeleton required by TDD hook. The OrchestratorMode delegates
 * entirely to InvestigateIncidentUseCase.execute; its only non-trivial
 * behaviour is the Promise cast that handles the inconclusive-void path.
 */
import { describe, it, expect, vi } from 'vitest';
import { OrchestratorMode } from './orchestrator-mode.js';
import type { InvestigateIncidentUseCase } from '../investigate-incident.usecase.js';
import type { InvestigationInput, InvestigationResult } from '../../domain/investigation.types.js';
import { tenantId, incidentId } from '../../../../shared/domain/value-objects.js';

const mockResult: InvestigationResult = {
    findings: [],
    potentialRootCause: 'test root cause',
    recommendedActions: [],
    evidence: [],
};

function makeInput(): InvestigationInput {
    return {
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-001'),
        suggestedAgents: [],
    };
}

describe('OrchestratorMode', () => {
    it('delegates run() to usecase.execute() and returns the result', async () => {
        const executeMock = vi.fn().mockResolvedValue(mockResult);
        const usecase = { execute: executeMock } as unknown as InvestigateIncidentUseCase;

        const mode = new OrchestratorMode(usecase);
        const result = await mode.run(makeInput());

        expect(executeMock).toHaveBeenCalledOnce();
        expect(result).toBe(mockResult);
    });

    it('propagates void (inconclusive) from usecase.execute without throwing', async () => {
        const executeMock = vi.fn().mockResolvedValue(undefined);
        const usecase = { execute: executeMock } as unknown as InvestigateIncidentUseCase;

        const mode = new OrchestratorMode(usecase);
        // On the inconclusive path execute() resolves to undefined (void).
        // The cast in run() means result is undefined — caller handles it.
        const result = await mode.run(makeInput());
        expect(result).toBeUndefined();
    });
});
