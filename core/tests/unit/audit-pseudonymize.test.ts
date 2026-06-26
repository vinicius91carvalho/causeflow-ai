import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { CreateAuditEntryUseCase } from '../../src/modules/audit/application/create-audit-entry.usecase.js';
import { VerifyHashChainUseCase } from '../../src/modules/audit/application/verify-hash-chain.usecase.js';
import { PseudonymizeActorUseCase } from '../../src/modules/audit/application/pseudonymize-actor.usecase.js';
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
    async findExpired(tid: TenantId, before: Date) {
        const beforeIso = before.toISOString();
        const items = this.rows.filter((r) => r.tenantId === tid && r.createdAt < beforeIso);
        return { items, cursor: undefined };
    }
    async deleteBatch(tid: TenantId, entryIds: string[]) {
        const before = this.rows.length;
        this.rows = this.rows.filter((r) => !(r.tenantId === tid && entryIds.includes(r.entryId)));
        return before - this.rows.length;
    }
}

describe('PseudonymizeActorUseCase', () => {
    let repo: InMemoryAuditRepo;
    let create: CreateAuditEntryUseCase;
    let verify: VerifyHashChainUseCase;
    let pseudonymize: PseudonymizeActorUseCase;
    const tid = tenantId(uuidv4());

    beforeEach(() => {
        repo = new InMemoryAuditRepo();
        create = new CreateAuditEntryUseCase(repo);
        verify = new VerifyHashChainUseCase(repo);
        pseudonymize = new PseudonymizeActorUseCase(repo);
    });

    async function seedChain(actorUserId: string, count: number) {
        for (let i = 0; i < count; i++) {
            await create.execute({
                tenantId: tid,
                action: 'incident.created',
                actorType: 'user',
                actorUserId,
                actorEmail: 'subject@example.com',
                resourceType: 'incident',
                resourceId: 'inc-' + i,
                changes: { i },
            });
            // force monotonic createdAt ordering
            await new Promise((r) => setTimeout(r, 2));
        }
    }

    it('preserves hash chain after pseudonymization of a 3-entry chain', async () => {
        await seedChain('user-victim', 3);
        const result = await pseudonymize.execute({
            tenantId: tid,
            actorUserId: 'user-victim',
            tenantSecret: 'secret-xyz',
        });
        expect(result.mutatedRows).toBe(3);
        expect(result.pseudonym.startsWith('erased:')).toBe(true);

        const verifyResult = await verify.execute(tid);
        expect(verifyResult.valid).toBe(true);
        expect(verifyResult.totalEntries).toBe(3);
    });

    it('produces a deterministic pseudonym per (actorUserId, tenantSecret)', async () => {
        const expected = 'erased:' + createHash('sha256')
            .update('user-victim|secret-xyz')
            .digest('hex');
        await seedChain('user-victim', 1);
        const r = await pseudonymize.execute({
            tenantId: tid,
            actorUserId: 'user-victim',
            tenantSecret: 'secret-xyz',
        });
        expect(r.pseudonym).toBe(expected);
    });

    it('only mutates matching actorUserId rows; other actors untouched', async () => {
        await seedChain('user-victim', 2);
        // different actor
        await create.execute({
            tenantId: tid,
            action: 'incident.created',
            actorType: 'user',
            actorUserId: 'user-other',
            actorEmail: 'other@example.com',
            resourceType: 'incident',
            resourceId: 'inc-other',
        });
        const r = await pseudonymize.execute({
            tenantId: tid,
            actorUserId: 'user-victim',
            tenantSecret: 'secret',
        });
        expect(r.mutatedRows).toBe(2);
        const otherRow = repo.rows.find((x) => x.resourceId === 'inc-other')!;
        expect(otherRow.actorUserId).toBe('user-other');
        expect(otherRow.pseudonymizedAt).toBeUndefined();
    });

    it('sets pseudonymizedAt on every mutated row', async () => {
        await seedChain('user-victim', 2);
        await pseudonymize.execute({
            tenantId: tid,
            actorUserId: 'user-victim',
            tenantSecret: 'secret',
        });
        const victimRows = repo.rows.filter((r) => r.pseudonymizedAt);
        expect(victimRows.length).toBe(2);
        for (const row of victimRows) {
            expect(row.pseudonymizedAt).toBeTruthy();
            expect(row.actorUserId?.startsWith('erased:')).toBe(true);
        }
    });
});
