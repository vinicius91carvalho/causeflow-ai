import { NotFoundError, AppError } from '../../../shared/domain/errors.js';
export class AuditEntryNotFoundError extends NotFoundError {
    constructor(id: string) {
        super('AuditEntry', id);
    }
}
export class AuditHashChainBrokenError extends AppError {
    constructor(entryId: string, expectedHash: string, actualHash: string) {
        super(`Hash chain broken at entry ${entryId}`, 'AUDIT_HASH_CHAIN_BROKEN', 500, { entryId, expectedHash, actualHash });
    }
}
