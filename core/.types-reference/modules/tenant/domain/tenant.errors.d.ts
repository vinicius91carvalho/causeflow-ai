import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
export declare class TenantNotFoundError extends NotFoundError {
    constructor(id: string);
}
export declare class TenantSlugConflictError extends ConflictError {
    constructor(slug: string);
}
