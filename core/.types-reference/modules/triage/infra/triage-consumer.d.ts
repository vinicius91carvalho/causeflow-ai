import type { TriageIncidentUseCase } from '../application/triage-incident.usecase.js';
export declare function startTriageConsumer(queueUrl: string, triageUseCase: TriageIncidentUseCase): {
    start: () => Promise<void>;
    stop: () => void;
};
