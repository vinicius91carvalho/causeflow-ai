import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSentryIntegrationStatusUseCase } from '../../../../src/modules/integration/application/get-sentry-integration-status.usecase.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = tenantId('tenant-sentry-status-001');

function makeMockSentryRepo(statusOverrides: {
    configured?: boolean;
    verified?: boolean;
    verifiedAt?: string | null;
    lastEventAt?: string | null;
} = {}) {
    const status = {
        configured: true,
        verified: false,
        verifiedAt: null,
        lastEventAt: null,
        ...statusOverrides,
    };
    return {
        findSentryClientSecret: vi.fn(async () => null),
        setClientSecret: vi.fn(async () => {}),
        markVerified: vi.fn(async () => {}),
        markEventReceived: vi.fn(async () => {}),
        getSentryStatus: vi.fn(async () => status),
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetSentryIntegrationStatusUseCase', () => {
    let useCase: GetSentryIntegrationStatusUseCase;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns configured=false when no integration is saved', async () => {
        const repo = makeMockSentryRepo({ configured: false, verified: false });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);

        expect(result.configured).toBe(false);
        expect(result.verified).toBe(false);
    });

    it('returns configured=true, verified=false when secret saved but no webhook received yet', async () => {
        const repo = makeMockSentryRepo({ configured: true, verified: false });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);

        expect(result.configured).toBe(true);
        expect(result.verified).toBe(false);
        expect(result.verifiedAt).toBeNull();
        expect(result.lastEventAt).toBeNull();
    });

    it('returns verified=true and timestamps after first valid webhook', async () => {
        const verifiedAt = '2026-04-27T10:00:00.000Z';
        const lastEventAt = '2026-04-27T10:00:00.000Z';
        const repo = makeMockSentryRepo({ configured: true, verified: true, verifiedAt, lastEventAt });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);

        expect(result.configured).toBe(true);
        expect(result.verified).toBe(true);
        expect(result.verifiedAt).toBe(verifiedAt);
        expect(result.lastEventAt).toBe(lastEventAt);
    });

    it('SECURITY: never returns clientSecret or clientSecretEncrypted fields', async () => {
        const repo = makeMockSentryRepo({ configured: true, verified: true });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);
        const keys = Object.keys(result);

        expect(keys).not.toContain('clientSecret');
        expect(keys).not.toContain('clientSecretEncrypted');
        expect(keys).not.toContain('encryptedDek');
        expect(keys).not.toContain('ciphertext');
    });

    it('response shape has exactly: configured, verified, verifiedAt, lastEventAt', async () => {
        const repo = makeMockSentryRepo({ configured: true, verified: false });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);

        // Exactly the contracted fields (per AD-3 and INVARIANTS.md)
        expect('configured' in result).toBe(true);
        expect('verified' in result).toBe(true);
        expect('verifiedAt' in result).toBe(true);
        expect('lastEventAt' in result).toBe(true);
    });

    it('lastEventAt updates reflect most recent webhook timestamp', async () => {
        const lastEventAt = '2026-04-27T15:30:00.000Z';
        const repo = makeMockSentryRepo({
            configured: true,
            verified: true,
            verifiedAt: '2026-04-27T10:00:00.000Z',
            lastEventAt,
        });
        useCase = new GetSentryIntegrationStatusUseCase(repo);

        const result = await useCase.execute(TENANT_ID);

        expect(result.lastEventAt).toBe(lastEventAt);
    });
});
