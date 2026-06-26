import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { CreateAuditEntryUseCase } from '../../src/modules/audit/application/create-audit-entry.usecase.js';
import { PurgeExpiredEntriesUseCase } from '../../src/modules/audit/application/purge-expired-entries.usecase.js';
import { tenantId } from '../../src/shared/domain/value-objects.js';
import type { IAuditRepository } from '../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../src/modules/audit/domain/audit.entity.js';
import type { TenantId } from '../../src/shared/domain/value-objects.js';

class InMemoryAuditRepo implements IAuditRepository {
    rows: AuditEntry[] = [];
    async create(entry: AuditEntry): Promise<AuditEntry> {
        this.rows.push(entry);
        return entry;
    }
    findByTenant(tid: TenantId, _options?: { limit?: number; cursor?: string }) {
        const items = this.rows
            .filter((r) => r.tenantId === tid)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return Promise.resolve({ items, cursor: undefined });
    }
    findByAction(tid: TenantId, action: string) {
        const items = this.rows.filter((r) => r.tenantId === tid && r.action === action);
        return Promise.resolve({ items, cursor: undefined });
    }
    getLastEntry(tid: TenantId) {
        const items = this.rows
            .filter((r) => r.tenantId === tid)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return Promise.resolve(items[0] ?? null);
    }
    async pseudonymizeActor(tid: TenantId, actorUserId: string, pseudonym: string) {
        let mutated = 0;
        const now = new Date().toISOString();
        for (const r of this.rows) {
            if (r.tenantId === tid && r.actorUserId === actorUserId) {
                r.actorUserId = pseudonym;
                r.pseudonymizedAt = now;
                mutated++;
            }
        }
        return mutated;
    }
    async findExpired(tid: TenantId, before: Date, options?: { limit?: number }) {
        const beforeIso = before.toISOString();
        const items = this.rows
            .filter((r) => r.tenantId === tid && r.createdAt < beforeIso)
            .slice(0, options?.limit ?? 100);
        return { items, cursor: undefined };
    }
    async deleteBatch(tid: TenantId, entryIds: string[]) {
        const before = this.rows.length;
        this.rows = this.rows.filter((r) => !(r.tenantId === tid && entryIds.includes(r.entryId)));
        return before - this.rows.length;
    }
}

describe('PurgeExpiredEntriesUseCase', () => {
    let repo: InMemoryAuditRepo;
    let create: CreateAuditEntryUseCase;
    let purge: PurgeExpiredEntriesUseCase;
    const tid = tenantId(uuidv4());

    beforeEach(() => {
        repo = new InMemoryAuditRepo();
        create = new CreateAuditEntryUseCase(repo);
        purge = new PurgeExpiredEntriesUseCase(repo);
    });

    it('hard-deletes entries older than the cutoff', async () => {
        // seed three entries with controlled createdAt
        for (let i = 0; i < 3; i++) {
            await create.execute({
                tenantId: tid,
                action: 'incident.created',
                actorType: 'system',
                actorEmail: 'system@causeflow.ai',
                resourceType: 'incident',
                resourceId: 'inc-' + i,
            });
            await new Promise((r) => setTimeout(r, 2));
        }
        // backdate first two
        repo.rows[0]!.createdAt = '2020-01-01T00:00:00.000Z';
        repo.rows[1]!.createdAt = '2020-06-01T00:00:00.000Z';

        const result = await purge.execute({
            tenantId: tid,
            before: new Date('2021-01-01T00:00:00.000Z'),
        });
        expect(result.deleted).toBe(2);
        expect(repo.rows.length).toBe(1);
    });

    it('returns zero deletions when no entry is expired', async () => {
        await create.execute({
            tenantId: tid,
            action: 'incident.created',
            actorType: 'system',
            actorEmail: 'system@causeflow.ai',
            resourceType: 'incident',
            resourceId: 'inc-fresh',
        });
        const result = await purge.execute({
            tenantId: tid,
            before: new Date('2000-01-01T00:00:00.000Z'),
        });
        expect(result.deleted).toBe(0);
        expect(repo.rows.length).toBe(1);
    });

    it('respects batchSize cap per invocation', async () => {
        for (let i = 0; i < 5; i++) {
            await create.execute({
                tenantId: tid,
                action: 'incident.created',
                actorType: 'system',
                actorEmail: 'system@causeflow.ai',
                resourceType: 'incident',
                resourceId: 'inc-' + i,
            });
        }
        // backdate all
        for (const r of repo.rows) r.createdAt = '2020-01-01T00:00:00.000Z';

        const result = await purge.execute({
            tenantId: tid,
            before: new Date('2021-01-01T00:00:00.000Z'),
            batchSize: 2,
        });
        expect(result.deleted).toBe(2);
        expect(repo.rows.length).toBe(3);
    });

    it('cutoff is returned as ISO string in result', async () => {
        const before = new Date('2025-01-01T00:00:00.000Z');
        const result = await purge.execute({ tenantId: tid, before });
        expect(result.cutoff).toBe(before.toISOString());
    });
});
