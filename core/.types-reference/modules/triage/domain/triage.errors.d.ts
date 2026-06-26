import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export declare class TriageFailedError extends AppError {
    constructor(incidentId: string, reason: string);
}
export declare class IncidentAlreadyTriagedError extends ConflictError {
    constructor(incidentId: string, currentStatus: string);
}
