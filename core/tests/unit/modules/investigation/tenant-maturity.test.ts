import { describe, it, expect, vi } from 'vitest';
import {
    isColdStartTenant,
    resolveSeekerModel,
    COLD_START_INCIDENT_THRESHOLD,
} from '../../../../src/modules/investigation/application/modes/shared/tenant-maturity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';
import type { TenantId } from '../../../../src/shared/domain/value-objects.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';

function repoReturning(count: number): IIncidentRepository {
    const items = Array.from({ length: count }, (_, i) => ({ incidentId: `inc-${i}` }) as unknown as Incident);
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findBySourceAlert: vi.fn(),
        update: vi.fn(),
        updateStatus: vi.fn(),
        listByTenant: vi.fn(),
        findBySeverity: vi.fn(),
        findByStatus: vi.fn(),
        listByCreatedAt: vi.fn(
            async (_t: TenantId, opts?: { limit?: number; cursor?: string; order?: 'asc' | 'desc' }) => {
                const limit = opts?.limit ?? 20;
                return { items: items.slice(0, Math.min(count, limit)), cursor: undefined };
            },
        ),
        findAll: vi.fn(),
    };
}

describe('isColdStartTenant', () => {
    it('returns true when tenant has 0 incidents', async () => {
        await expect(isColdStartTenant(repoReturning(0), tenantId('t-new'))).resolves.toBe(true);
    });

    it('returns true when tenant has less than threshold incidents', async () => {
        const below = COLD_START_INCIDENT_THRESHOLD - 1;
        await expect(isColdStartTenant(repoReturning(below), tenantId('t-growing'))).resolves.toBe(true);
    });

    it('returns false when tenant has threshold or more', async () => {
        const at = COLD_START_INCIDENT_THRESHOLD;
        await expect(isColdStartTenant(repoReturning(at), tenantId('t-mature'))).resolves.toBe(false);
    });

    it('respects a custom threshold', async () => {
        await expect(isColdStartTenant(repoReturning(5), tenantId('t'), 3)).resolves.toBe(false);
        await expect(isColdStartTenant(repoReturning(2), tenantId('t'), 3)).resolves.toBe(true);
    });

    it('caps the DB page query at the threshold (bounded cost)', async () => {
        const repo = repoReturning(1000);
        await isColdStartTenant(repo, tenantId('t-huge'));
        expect(repo.listByCreatedAt).toHaveBeenCalledWith(
            tenantId('t-huge'),
            { limit: COLD_START_INCIDENT_THRESHOLD },
        );
    });
});

describe('resolveSeekerModel', () => {
    it('returns coldStartModel for cold-start tenants', async () => {
        const model = await resolveSeekerModel(
            repoReturning(2),
            tenantId('t-new'),
            { matureModel: 'sonnet', coldStartModel: 'opus' },
        );
        expect(model).toBe('opus');
    });

    it('returns matureModel for tenants past the threshold', async () => {
        const model = await resolveSeekerModel(
            repoReturning(COLD_START_INCIDENT_THRESHOLD),
            tenantId('t-mature'),
            { matureModel: 'sonnet', coldStartModel: 'opus' },
        );
        expect(model).toBe('sonnet');
    });
});
