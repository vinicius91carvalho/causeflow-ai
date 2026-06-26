import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveSentryClientSecretUseCase } from '../../../../src/modules/integration/application/save-sentry-client-secret.usecase.js';
import type { TokenEncryption, EncryptedPayload } from '../../../../src/shared/application/ports/token-encryption.port.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = tenantId('tenant-sentry-save-001');
const CLIENT_SECRET = 'sntrys_abc123def456_very_long_secret_value';

const ENCRYPTED_PAYLOAD: EncryptedPayload = {
    ciphertext: 'enc-ciphertext-abc',
    encryptedDek: 'enc-dek-abc',
    iv: 'enc-iv-abc',
    tag: 'enc-tag-abc',
};

function makeMockEncryption(): TokenEncryption {
    return {
        encrypt: vi.fn(async (_plaintext: string) => ENCRYPTED_PAYLOAD),
        decrypt: vi.fn(async (_payload: EncryptedPayload) => CLIENT_SECRET),
    };
}

function makeMockSentryRepo() {
    return {
        findSentryClientSecret: vi.fn(async (_tenantId: string): Promise<string | null> => null),
        setClientSecret: vi.fn(async (_tenantId: string, _encrypted: EncryptedPayload): Promise<void> => {}),
        markVerified: vi.fn(async (_tenantId: string): Promise<void> => {}),
        markEventReceived: vi.fn(async (_tenantId: string): Promise<void> => {}),
        getSentryStatus: vi.fn(async (_tenantId: string) => ({
            configured: false,
            verified: false,
            verifiedAt: null as string | null,
            lastEventAt: null as string | null,
        })),
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SaveSentryClientSecretUseCase', () => {
    let encryption: TokenEncryption;
    let repo: ReturnType<typeof makeMockSentryRepo>;
    let useCase: SaveSentryClientSecretUseCase;

    beforeEach(() => {
        encryption = makeMockEncryption();
        repo = makeMockSentryRepo();
        useCase = new SaveSentryClientSecretUseCase(encryption, repo);
    });

    it('encrypts the client secret before persisting', async () => {
        await useCase.execute({ tenantId: TENANT_ID, clientSecret: CLIENT_SECRET });

        expect(encryption.encrypt).toHaveBeenCalledOnce();
        expect(encryption.encrypt).toHaveBeenCalledWith(CLIENT_SECRET);
        expect(repo.setClientSecret).toHaveBeenCalledOnce();
        // Must call setClientSecret with the encrypted payload, NOT plaintext
        const [, encArg] = vi.mocked(repo.setClientSecret).mock.calls[0]!;
        expect(encArg).toEqual(ENCRYPTED_PAYLOAD);
    });

    it('returns { hasClientSecret: true, verified: false }', async () => {
        const result = await useCase.execute({ tenantId: TENANT_ID, clientSecret: CLIENT_SECRET });

        expect(result).toEqual({ hasClientSecret: true, verified: false });
    });

    it('throws ValidationError when clientSecret is empty string', async () => {
        await expect(
            useCase.execute({ tenantId: TENANT_ID, clientSecret: '' }),
        ).rejects.toThrow(/clientSecret/i);
    });

    it('throws ValidationError when clientSecret is too short (< 10 chars)', async () => {
        await expect(
            useCase.execute({ tenantId: TENANT_ID, clientSecret: 'short' }),
        ).rejects.toThrow();
    });

    it('SECURITY: plaintext clientSecret is never passed to setClientSecret', async () => {
        await useCase.execute({ tenantId: TENANT_ID, clientSecret: CLIENT_SECRET });

        const calls = vi.mocked(repo.setClientSecret).mock.calls;
        for (const call of calls) {
            // setClientSecret receives (tenantId, EncryptedPayload) — not plaintext string
            const secondArg = call[1];
            // Verify it's an EncryptedPayload object, not the plaintext
            expect(typeof secondArg).toBe('object');
            expect(secondArg).not.toBe(CLIENT_SECRET);
            // EncryptedPayload has ciphertext property
            expect(secondArg.ciphertext).toBeDefined();
        }
    });

    it('resets verified=false when a new secret is saved (re-verification required)', async () => {
        const result = await useCase.execute({ tenantId: TENANT_ID, clientSecret: CLIENT_SECRET });

        // The response must always return verified=false when saving a new secret
        expect(result.verified).toBe(false);
    });
});
