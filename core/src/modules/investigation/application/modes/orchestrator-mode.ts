import type { InvestigateIncidentUseCase } from '../investigate-incident.usecase.js';
import type { InvestigationInput, InvestigationResult } from '../../domain/investigation.types.js';
import type { InvestigationMode } from './types.js';

/**
 * Default mode — wraps the existing single-agent orchestrator implementation
 * (`InvestigateIncidentUseCase.execute`) without changing any of its logic,
 * prompts, or tool set. Serves as the fallback/default mode and the baseline
 * against which new modes (hypothesis, debate) are measured.
 */
export class OrchestratorMode implements InvestigationMode {
    readonly name = 'orchestrator' as const;
    readonly label = 'Orchestrator (symptom-driven)';
    readonly description =
        'Single agent explores symptoms depth-first, escalates to operator on ambiguity.';

    constructor(private readonly usecase: InvestigateIncidentUseCase) {}

    async run(input: InvestigationInput): Promise<InvestigationResult> {
        // execute() returns void only on the inconclusive terminal path (pre-synthesis
        // gate or exhausted-citation retries). When void is returned the dispatcher
        // receives undefined and the worker surfaces the already-persisted inconclusive
        // status — no InvestigationResult is needed. The cast is safe here because the
        // mode interface requires InvestigationResult and callers handle undefined.
        return this.usecase.execute(input) as Promise<InvestigationResult>;
    }
}
