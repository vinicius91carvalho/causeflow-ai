import { logger } from '../../../shared/infra/logger.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { DEFAULT_INVESTIGATION_MODE } from './modes/types.js';
import { usesLocalLlmConnector } from '../../../shared/infra/llm/llm-factory.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { InvestigationInput, InvestigationResult } from '../domain/investigation.types.js';
import type { InvestigationMode, InvestigationModeName } from './modes/types.js';
import type { InvestigationModeRegistry } from './modes/registry.js';
import type { MetricRecorder } from '../../../shared/application/ports/metric-recorder.port.js';

export interface DispatchInvestigationDeps {
    incidentRepo: IIncidentRepository;
    registry: InvestigationModeRegistry;
    /**
     * Optional metrics sink. When provided, the dispatcher records
     * `investigation.mode_invoked`, `investigation.mode_duration_ms` and
     * `investigation.mode_failed` tagged with the mode name. Off by default
     * so test doubles do not need to stub it.
     */
    metrics?: MetricRecorder;
}

/**
 * Thin dispatcher in front of the investigation modes. Reads the mode stamped
 * on the Incident (or defaults to orchestrator), delegates to the matching
 * implementation, and optionally fires a shadow run for A/B comparison.
 *
 * This use case is the ONLY entry point that callers (routes, workers,
 * bootstrap) should hit. Individual mode implementations remain internal.
 */
export class DispatchInvestigationUseCase {
    constructor(private readonly deps: DispatchInvestigationDeps) {}

    async execute(input: InvestigationInput): Promise<InvestigationResult> {
        const incident = await this.deps.incidentRepo.findById(input.tenantId, input.incidentId);
        if (!incident) {
            throw new NotFoundError('Incident', input.incidentId);
        }

        let modeName: InvestigationModeName = incident.investigationMode ?? DEFAULT_INVESTIGATION_MODE;
        // AC-060 safety net: local Ornith cannot reliably run debate/hypothesis
        // seeker schemas — fall back to orchestrator for the OSS golden path.
        if (
            usesLocalLlmConnector() &&
            (modeName === 'debate' || modeName === 'hypothesis')
        ) {
            logger.info(
                { incidentId: input.incidentId, from: modeName, to: 'orchestrator' },
                'Local LLM investigation — coercing mode to orchestrator',
            );
            modeName = 'orchestrator';
        }
        const mode = this.deps.registry.get(modeName);

        logger.info(
            { tenantId: input.tenantId, incidentId: input.incidentId, mode: modeName },
            'Dispatching investigation',
        );

        this.deps.metrics?.increment('investigation.mode_invoked', 1, { mode: modeName });
        const start = Date.now();
        let primary: InvestigationResult;
        try {
            primary = await mode.run(input);
        } catch (err) {
            this.deps.metrics?.increment('investigation.mode_failed', 1, { mode: modeName });
            this.deps.metrics?.histogram('investigation.mode_duration_ms', Date.now() - start, {
                mode: modeName,
                outcome: 'error',
            });
            throw err;
        }
        this.deps.metrics?.histogram('investigation.mode_duration_ms', Date.now() - start, {
            mode: modeName,
            outcome: 'success',
        });

        // Shadow mode — fire-and-forget, never fails the primary. Only runs
        // when an internal admin has stamped a `shadowInvestigationMode`
        // different from the primary. Result is logged/persisted separately
        // (Phase 1.5 persists to ShadowInvestigation entity — for now we log).
        const shadowName = incident.shadowInvestigationMode;
        if (shadowName && shadowName !== modeName && this.deps.registry.has(shadowName)) {
            this.runShadow(this.deps.registry.get(shadowName), input).catch((err) => {
                logger.warn(
                    { err, shadow: shadowName, incidentId: input.incidentId },
                    'Shadow investigation failed (non-fatal)',
                );
            });
        }

        return primary;
    }

    private async runShadow(mode: InvestigationMode, input: InvestigationInput): Promise<void> {
        const start = Date.now();
        logger.info({ mode: mode.name, incidentId: input.incidentId }, 'Shadow investigation started');
        // Strip the channel — shadow must not emit to the tenant-facing relay.
        const shadowInput: InvestigationInput = { ...input, channel: undefined };
        const result = await mode.run(shadowInput);
        logger.info(
            {
                mode: mode.name,
                incidentId: input.incidentId,
                durationMs: Date.now() - start,
                rootCauseLength: result.potentialRootCause?.length ?? 0,
                findingsCount: result.findings?.length ?? 0,
                recommendedActionsCount: result.recommendedActions?.length ?? 0,
            },
            'Shadow investigation completed',
        );
    }
}
