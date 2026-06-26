import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export declare class InvestigationFailedError extends AppError {
    constructor(incidentId: string, reason: string);
}
export declare class IncidentNotInvestigatableError extends ConflictError {
    constructor(incidentId: string, currentStatus: string);
}
