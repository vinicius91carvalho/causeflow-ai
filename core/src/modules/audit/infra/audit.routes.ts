import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { ListAuditEntriesUseCase } from '../application/list-audit-entries.usecase.js';
import type { VerifyHashChainUseCase } from '../application/verify-hash-chain.usecase.js';
import type { ExportAuditUseCase } from '../application/export-audit.usecase.js';
import type { CreateAuditEntryUseCase } from '../application/create-audit-entry.usecase.js';
import type { DeleteAuditEntryUseCase } from '../application/delete-audit-entry.usecase.js';
import { auditEntryId } from '../../../shared/domain/value-objects.js';

export interface AuditUseCases {
  listAuditEntries: ListAuditEntriesUseCase;
  verifyHashChain: VerifyHashChainUseCase;
  exportAudit: ExportAuditUseCase;
  createAuditEntry?: CreateAuditEntryUseCase;
  deleteAuditEntry?: DeleteAuditEntryUseCase;
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
    c.header(
      'Content-Disposition',
      `attachment; filename="audit-${tenantId}-${Date.now()}.ndjson"`,
    );
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
  // DELETE /:id — admin-only (RBAC). Purges one audit entry and advances the
  // hash chain with a new `audit.entry.deleted` entry whose previousHash is
  // the prior tip. Viewers/members get 403 via requireRole('admin').
  if (useCases.deleteAuditEntry) {
    app.delete('/:id', requireRole('admin'), async (c) => {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const userEmail = c.get('userEmail');
      const entryId = auditEntryId(c.req.param('id'));
      const result = await useCases.deleteAuditEntry!.execute({
        tenantId,
        entryId,
        ...(userId ? { actorUserId: userId } : {}),
        actorEmail: userEmail,
      });
      return c.json({
        entryId,
        deleted: result.deleted,
        newEntry: result.newEntry,
      });
    });
  }
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
