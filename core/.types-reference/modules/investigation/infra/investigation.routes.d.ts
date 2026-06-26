import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { InvestigateIncidentUseCase } from '../application/investigate-incident.usecase.js';
import type { GetInvestigationUseCase } from '../application/get-investigation.usecase.js';
import type { AddInvestigationContextUseCase } from '../application/add-investigation-context.usecase.js';
import type { RespondKnownSolutionUseCase } from '../application/respond-known-solution.usecase.js';
import type { RecordInvestigationFeedbackUseCase } from '../application/record-investigation-feedback.usecase.js';
import type { AbortInvestigationUseCase } from '../application/abort-investigation.usecase.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
export interface InvestigationUseCases {
    investigateIncident: InvestigateIncidentUseCase;
    getInvestigation: GetInvestigationUseCase;
    addInvestigationContext: AddInvestigationContextUseCase;
    respondKnownSolution?: RespondKnownSolutionUseCase;
    recordInvestigationFeedback?: RecordInvestigationFeedbackUseCase;
    abortInvestigation?: AbortInvestigationUseCase;
    evidenceRepo: IEvidenceRepository;
}
export declare function createInvestigationRoutes(useCases: InvestigationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
