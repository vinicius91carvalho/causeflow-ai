import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
export class TenantNotFoundError extends NotFoundError {
    constructor(id: string) {
        super('Tenant', id);
    }
}
export class TenantSlugConflictError extends ConflictError {
    constructor(slug: string) {
        super(`Tenant with slug "${slug}" already exists`);
    }
}
