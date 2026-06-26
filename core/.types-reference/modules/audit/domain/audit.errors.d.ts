import { NotFoundError, AppError } from '../../../shared/domain/errors.js';
export declare class AuditEntryNotFoundError extends NotFoundError {
    constructor(id: string);
}
export declare class AuditHashChainBrokenError extends AppError {
    constructor(entryId: string, expectedHash: string, actualHash: string);
}
