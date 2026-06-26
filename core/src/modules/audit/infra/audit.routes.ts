import { Hono } from 'hono';
import { stream } from 'hono/streaming';
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

export function createAuditRoutes(useCases: AuditUseCases) {
    const app = new Hono<AppEnv>();
    app.get('/', async (c) => {
        const tenantId = c.get('tenantId');
        const action = c.req.query('action');
        const limit = Number(c.req.query('limit') ?? '20');
        const cursor = c.req.query('cursor');
        const actorTypeRaw = c.req.query('actorType');
        if (actorTypeRaw !== undefined && actorTypeRaw !== 'user' && actorTypeRaw !== 'system') {
            return c.json({ error: 'Invalid actorType' }, 400);
        }
        const actorType = actorTypeRaw as 'user' | 'system' | undefined;
        const result = await useCases.listAuditEntries.execute({
            tenantId,
            action,
            limit,
            cursor,
            ...(actorType !== undefined && { actorType }),
        });
        return c.json(result);
    });
    app.get('/verify', async (c) => {
        const tenantId = c.get('tenantId');
        const result = await useCases.verifyHashChain.execute(tenantId);
        return c.json(result);
    });
    app.get('/export', (c) => {
        const tenantId = c.get('tenantId');
        const action = c.req.query('action');
        c.header('Content-Type', 'application/x-ndjson');
        c.header('Content-Disposition', `attachment; filename="audit-${tenantId}-${Date.now()}.ndjson"`);
        return stream(c, async (s) => {
            const generator = useCases.exportAudit.execute({
                tenantId,
                action: action ?? undefined,
            });
            for await (const entry of generator) {
                await s.write(JSON.stringify(entry) + '\n');
            }
        });
    });
    // POST /v1/audit/terms-acceptance — record terms acceptance as audit entry
    if (useCases.createAuditEntry) {
        app.post('/terms-acceptance', async (c) => {
            const tenantId = c.get('tenantId');
            const userEmail = c.get('userEmail');
            const userId = c.get('userId');
            const entry = await useCases.createAuditEntry!.execute({
                tenantId,
                action: 'terms.accepted',
                actorType: 'user',
                actorEmail: userEmail,
                resourceType: 'user',
                resourceId: userId,
                changes: { acceptedAt: new Date().toISOString() },
            });
            return c.json({ entryId: entry.entryId, createdAt: entry.createdAt }, 201);
        });
    }
    return app;
}
