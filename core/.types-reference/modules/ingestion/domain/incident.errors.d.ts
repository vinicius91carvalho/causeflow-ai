import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
export declare class IncidentNotFoundError extends NotFoundError {
    constructor(id: string);
}
export declare class DuplicateAlertError extends ConflictError {
    constructor(source: string, externalId: string);
}
export declare class InvalidStatusTransitionError extends ConflictError {
    constructor(from: string, to: string);
}
