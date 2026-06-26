import type { EncryptedPayload } from '../../../shared/application/ports/token-encryption.port.js';

export interface SentryIntegrationStatus {
    configured: boolean;
    verified: boolean;
    verifiedAt: string | null;
    lastEventAt: string | null;
}

/**
 * Sentry Integration Repository Port — domain interface for persisting
 * Sentry Client Secret and tracking webhook verification state.
 *
 * One Sentry integration per tenant.
 */
export interface ISentryIntegrationRepository {
    /**
     * Retrieve the decrypted Sentry Client Secret for HMAC verification.
     * Returns null if no integration is configured for this tenant.
     */
    findSentryClientSecret(tenantId: string): Promise<string | null>;

    /**
     * Persist the encrypted Client Secret for a tenant, resetting verified=false.
     */
    setClientSecret(tenantId: string, encrypted: EncryptedPayload): Promise<void>;

    /**
     * Flip verified=true and set verifiedAt=now() on first valid HMAC event.
     * No-op if already verified (idempotent).
     */
    markVerified(tenantId: string): Promise<void>;

    /**
     * Update lastEventAt=now() on every valid HMAC event.
     */
    markEventReceived(tenantId: string): Promise<void>;

    /**
     * Return the public status for the dashboard (no secrets).
     */
    getSentryStatus(tenantId: string): Promise<SentryIntegrationStatus>;
}
