import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export class InvestigationFailedError extends AppError {
    constructor(incidentId: string, reason: string) {
        super(`Investigation failed for ${incidentId}: ${reason}`, 'INVESTIGATION_FAILED', 500);
    }
}
export class IncidentNotInvestigatableError extends ConflictError {
    constructor(incidentId: string, currentStatus: string) {
        super(`Incident ${incidentId} cannot be investigated (status: ${currentStatus})`);
    }
}
