import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { TriageIncidentUseCase } from '../application/triage-incident.usecase.js';
import type { IEvidenceRepository } from '../domain/evidence.repository.js';
export interface TriageUseCases {
    triageIncident: TriageIncidentUseCase;
    evidenceRepo: IEvidenceRepository;
}
export declare function createTriageRoutes(useCases: TriageUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
