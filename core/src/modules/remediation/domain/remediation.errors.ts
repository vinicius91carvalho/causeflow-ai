import { AppError, ConflictError } from '../../../shared/domain/errors.js';
export class RemediationNotApprovedError extends AppError {
    constructor(remediationId: string, currentStatus: string) {
        super(`Remediation ${remediationId} cannot be executed: status is '${currentStatus}', expected 'approved'`, 'REMEDIATION_NOT_APPROVED', 422);
    }
}
export class RemediationNotProposedError extends AppError {
    constructor(remediationId: string, currentStatus: string) {
        super(`Remediation ${remediationId} cannot be updated: status is '${currentStatus}', expected 'proposed'`, 'REMEDIATION_NOT_PROPOSED', 422);
    }
}
export class RemediationAlreadyExistsError extends ConflictError {
    constructor(incidentId: string) {
        super(`An active remediation already exists for incident ${incidentId}`);
    }
}
