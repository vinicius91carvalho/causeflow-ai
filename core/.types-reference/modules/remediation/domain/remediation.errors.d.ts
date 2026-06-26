import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export declare class RemediationNotApprovedError extends AppError {
    constructor(remediationId: string, currentStatus: string);
}
export declare class RemediationNotProposedError extends AppError {
    constructor(remediationId: string, currentStatus: string);
}
export declare class RemediationAlreadyExistsError extends ConflictError {
    constructor(incidentId: string);
}
