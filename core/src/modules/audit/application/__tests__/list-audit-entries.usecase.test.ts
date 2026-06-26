import { describe, expect, it, vi } from 'vitest';
import type { TenantId, AuditEntryId } from '../../../../shared/domain/value-objects.js';
import type { IAuditRepository } from '../../domain/audit.repository.js';
import type { AuditEntry } from '../../domain/audit.entity.js';
import type { IUserEmailResolver } from '../../domain/user-email-resolver.js';
import { ListAuditEntriesUseCase } from '../list-audit-entries.usecase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const T1 = 'tenant-1' as unknown as TenantId;

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
    return {
        tenantId: T1,
        entryId: 'e1' as unknown as AuditEntryId,
        action: 'incident.created',
        actorType: 'user',
        actorEmail: '',
        actorUserId: 'user-abc',
        resourceType: 'incident',
        resourceId: 'i1',
        previousHash: '0'.repeat(64),
        entryHash: 'abc123',
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function makeRepo(items: AuditEntry[]): IAuditRepository {
    return {
        create: vi.fn(),
        findByTenant: vi.fn().mockResolvedValue({ items, cursor: undefined }),
        findByAction: vi.fn().mockResolvedValue({ items, cursor: undefined }),
        getLastEntry: vi.fn().mockResolvedValue(null),
        pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
        findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
        deleteBatch: vi.fn(() => Promise.resolve(0)),
    };
}

// ---------------------------------------------------------------------------
// Task 1: Read-time actorEmail enrichment
// ---------------------------------------------------------------------------

describe('ListAuditEntriesUseCase — actorEmail enrichment', () => {
    it('enriches empty actorEmail for user entries using the resolver', async () => {
        const entry = makeEntry({ actorType: 'user', actorEmail: '', actorUserId: 'user-abc' });
        const repo = makeRepo([entry]);
        const resolver: IUserEmailResolver = {
            resolveEmails: vi.fn().mockResolvedValue(new Map([['user-abc', 'alice@example.com']])),
        };
        const useCase = new ListAuditEntriesUseCase(repo, resolver);

        const result = await useCase.execute({ tenantId: T1 });

        expect(result.items[0]!.actorEmail).toBe('alice@example.com');
        // entryHash must remain untouched
        expect(result.items[0]!.entryHash).toBe('abc123');
    });

    it('leaves system entries untouched even if actorUserId is present', async () => {
        const entry = makeEntry({ actorType: 'system', actorEmail: '', actorUserId: 'user-abc' });
        const repo = makeRepo([entry]);
        const resolveEmailsSpy = vi.fn().mockResolvedValue(new Map([['user-abc', 'alice@example.com']]));
        const resolver: IUserEmailResolver = { resolveEmails: resolveEmailsSpy };
        const useCase = new ListAuditEntriesUseCase(repo, resolver);

        const result = await useCase.execute({ tenantId: T1 });

        expect(result.items[0]!.actorEmail).toBe('');
        expect(resolveEmailsSpy).not.toHaveBeenCalled();
    });

    it('leaves non-empty actorEmail untouched', async () => {
        const entry = makeEntry({ actorType: 'user', actorEmail: 'existing@example.com', actorUserId: 'user-abc' });
        const repo = makeRepo([entry]);
        const resolveEmailsSpy = vi.fn().mockResolvedValue(new Map([['user-abc', 'other@example.com']]));
        const resolver: IUserEmailResolver = { resolveEmails: resolveEmailsSpy };
        const useCase = new ListAuditEntriesUseCase(repo, resolver);

        const result = await useCase.execute({ tenantId: T1 });

        // Already has an email — resolver should not be called for this entry
        expect(result.items[0]!.actorEmail).toBe('existing@example.com');
        expect(resolveEmailsSpy).not.toHaveBeenCalled();
    });

    it('leaves actorEmail as empty string when resolver returns empty for userId', async () => {
        const entry = makeEntry({ actorType: 'user', actorEmail: '', actorUserId: 'deleted-user' });
        const repo = makeRepo([entry]);
        const resolver: IUserEmailResolver = {
            resolveEmails: vi.fn().mockResolvedValue(new Map([['deleted-user', '']])),
        };
        const useCase = new ListAuditEntriesUseCase(repo, resolver);

        const result = await useCase.execute({ tenantId: T1 });

        expect(result.items[0]!.actorEmail).toBe('');
    });

    it('works without a resolver — skips enrichment entirely', async () => {
        const entry = makeEntry({ actorType: 'user', actorEmail: '', actorUserId: 'user-abc' });
        const repo = makeRepo([entry]);
        const useCase = new ListAuditEntriesUseCase(repo); // no resolver

        const result = await useCase.execute({ tenantId: T1 });

        // No enrichment performed
        expect(result.items[0]!.actorEmail).toBe('');
    });
});

// ---------------------------------------------------------------------------
// Task 3: actorType filter
// ---------------------------------------------------------------------------

describe('ListAuditEntriesUseCase — actorType filter', () => {
    it('passes actorType to findByTenant when no action provided', async () => {
        const userEntry = makeEntry({ actorType: 'user', actorEmail: 'u@x.com' });
        const systemEntry = makeEntry({ entryId: 'e2' as unknown as AuditEntryId, actorType: 'system', actorEmail: 'system@causeflow.ai' });
        const findByTenantSpy = vi.fn().mockResolvedValue({ items: [userEntry, systemEntry], cursor: undefined });
        const repo: IAuditRepository = {
            create: vi.fn(),
            findByTenant: findByTenantSpy,
            findByAction: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
            getLastEntry: vi.fn().mockResolvedValue(null),
            pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
            findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
            deleteBatch: vi.fn(() => Promise.resolve(0)),
        };
        const useCase = new ListAuditEntriesUseCase(repo);

        await useCase.execute({ tenantId: T1, actorType: 'user' });

        expect(findByTenantSpy).toHaveBeenCalledWith(T1, expect.objectContaining({ actorType: 'user' }));
    });

    it('filters by actorType in-memory when action is also provided', async () => {
        const userEntry = makeEntry({ actorType: 'user', actorEmail: 'u@x.com' });
        const systemEntry = makeEntry({ entryId: 'e2' as unknown as AuditEntryId, actorType: 'system', actorEmail: 'system@causeflow.ai' });
        const repo: IAuditRepository = {
            create: vi.fn(),
            findByTenant: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
            findByAction: vi.fn().mockResolvedValue({ items: [userEntry, systemEntry], cursor: undefined }),
            getLastEntry: vi.fn().mockResolvedValue(null),
            pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
            findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
            deleteBatch: vi.fn(() => Promise.resolve(0)),
        };
        const useCase = new ListAuditEntriesUseCase(repo);

        const result = await useCase.execute({ tenantId: T1, action: 'incident.created', actorType: 'user' });

        // Should filter in-memory, keeping only user entries
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.actorType).toBe('user');
    });

    it('returns all entries when actorType not provided', async () => {
        const userEntry = makeEntry({ actorType: 'user', actorEmail: 'u@x.com' });
        const systemEntry = makeEntry({ entryId: 'e2' as unknown as AuditEntryId, actorType: 'system', actorEmail: 'system@causeflow.ai' });
        const repo: IAuditRepository = {
            create: vi.fn(),
            findByTenant: vi.fn().mockResolvedValue({ items: [userEntry, systemEntry], cursor: undefined }),
            findByAction: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
            getLastEntry: vi.fn().mockResolvedValue(null),
            pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
            findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
            deleteBatch: vi.fn(() => Promise.resolve(0)),
        };
        const useCase = new ListAuditEntriesUseCase(repo);

        const result = await useCase.execute({ tenantId: T1 });

        expect(result.items).toHaveLength(2);
    });
});
