import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
export class IncidentNotFoundError extends NotFoundError {
    constructor(id: string) {
        super('Incident', id);
    }
}
export class DuplicateAlertError extends ConflictError {
    constructor(source: string, externalId: string) {
        super(`Alert already ingested: ${source}/${externalId}`);
    }
}
export class InvalidStatusTransitionError extends ConflictError {
    constructor(from: string, to: string) {
        super(`Invalid status transition: ${from} → ${to}`);
    }
}
