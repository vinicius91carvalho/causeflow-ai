import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ListAuditEntriesUseCase } from '../application/list-audit-entries.usecase.js';
import type { VerifyHashChainUseCase } from '../application/verify-hash-chain.usecase.js';
import type { ExportAuditUseCase } from '../application/export-audit.usecase.js';
import type { CreateAuditEntryUseCase } from '../application/create-audit-entry.usecase.js';
export interface AuditUseCases {
    listAuditEntries: ListAuditEntriesUseCase;
    verifyHashChain: VerifyHashChainUseCase;
    exportAudit: ExportAuditUseCase;
    createAuditEntry?: CreateAuditEntryUseCase;
}
export declare function createAuditRoutes(useCases: AuditUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
