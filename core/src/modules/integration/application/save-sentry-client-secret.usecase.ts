import { ValidationError } from '../../../shared/domain/errors.js';
import type { TokenEncryption } from '../../../shared/application/ports/token-encryption.port.js';
import type { ISentryIntegrationRepository } from '../domain/sentry-integration.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface SaveSentryClientSecretInput {
    tenantId: TenantId;
    /** Raw Sentry Client Secret from the dashboard form. Min 10 chars. */
    clientSecret: string;
}

export interface SaveSentryClientSecretOutput {
    hasClientSecret: true;
    /** Always false after save — tenant must receive a valid webhook to verify. */
    verified: false;
}

/**
 * Saves the Sentry Internal Integration Client Secret for HMAC webhook verification.
 *
 * Security contract:
 * - The plaintext secret is encrypted before any persistence call.
 * - The plaintext never leaves this method scope (not logged, not returned).
 * - Saving a new secret resets the `verified` flag to false (re-verification required).
 */
export class SaveSentryClientSecretUseCase {
    constructor(
        private readonly encryption: TokenEncryption,
        private readonly sentryRepo: ISentryIntegrationRepository,
    ) {}

    async execute(input: SaveSentryClientSecretInput): Promise<SaveSentryClientSecretOutput> {
        const { tenantId, clientSecret } = input;

        if (!clientSecret || clientSecret.length < 10) {
            throw new ValidationError('clientSecret is required and must be at least 10 characters');
        }

        // Encrypt before any persistence — plaintext must not leave this scope
        const encrypted = await this.encryption.encrypt(clientSecret);

        // Persist encrypted secret; impl must also reset verified=false
        await this.sentryRepo.setClientSecret(String(tenantId), encrypted);

        return { hasClientSecret: true, verified: false };
    }
}
