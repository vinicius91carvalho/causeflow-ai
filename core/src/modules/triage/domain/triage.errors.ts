import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export class TriageFailedError extends AppError {
    constructor(incidentId: string, reason: string) {
        super(`Triage failed for incident ${incidentId}: ${reason}`, 'TRIAGE_FAILED', 500);
    }
}
export class IncidentAlreadyTriagedError extends ConflictError {
    constructor(incidentId: string, currentStatus: string) {
        super(`Incident ${incidentId} is not in 'open' status (current: ${currentStatus})`);
    }
}
