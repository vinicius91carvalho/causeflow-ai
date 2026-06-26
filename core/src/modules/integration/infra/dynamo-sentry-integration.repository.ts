import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import { integrationId } from '../../../shared/domain/value-objects.js';
import type { TokenEncryption, EncryptedPayload } from '../../../shared/application/ports/token-encryption.port.js';
import type { ISentryIntegrationRepository, SentryIntegrationStatus } from '../domain/sentry-integration.repository.js';

/** DynamoDB key used for all Sentry integration rows (one per tenant). */
const SENTRY_INTEGRATION_ID = integrationId('sentry-webhook');

/**
 * DynamoDB-backed implementation of ISentryIntegrationRepository.
 *
 * Uses the shared IntegrationEntity (single-table design). The Client Secret
 * is stored as an envelope-encrypted payload in four fields:
 *   clientSecretEncrypted, clientSecretDek, clientSecretIv, clientSecretTag
 *
 * The plaintext secret is only ever materialised in memory during:
 *   1. save — immediately after encrypt() and immediately before persist
 *   2. verify — inside the HMAC middleware, fetched via findSentryClientSecret()
 */
export class DynamoSentryIntegrationRepository implements ISentryIntegrationRepository {
    constructor(private readonly encryption: TokenEncryption) {}

    async findSentryClientSecret(tenantId: string): Promise<string | null> {
        const result = await IntegrationEntity.get({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
        }).go();
        const row = result.data;
        if (
            !row ||
            !row.clientSecretEncrypted ||
            !row.clientSecretDek ||
            !row.clientSecretIv ||
            !row.clientSecretTag
        ) {
            return null;
        }
        try {
            return await this.encryption.decrypt({
                ciphertext: row.clientSecretEncrypted,
                encryptedDek: row.clientSecretDek,
                iv: row.clientSecretIv,
                tag: row.clientSecretTag,
            });
        } catch {
            return null;
        }
    }

    async setClientSecret(tenantId: string, encrypted: EncryptedPayload): Promise<void> {
        await IntegrationEntity.upsert({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
            provider: 'sentry',
            category: 'observability',
            status: 'active',
            displayName: 'Sentry',
            clientSecretEncrypted: encrypted.ciphertext,
            clientSecretDek: encrypted.encryptedDek,
            clientSecretIv: encrypted.iv,
            clientSecretTag: encrypted.tag,
            // Reset verification state when a new secret is saved
            verified: false,
            verifiedAt: undefined,
        }).go();
    }

    async markVerified(tenantId: string): Promise<void> {
        // Idempotent — only flip if not yet verified
        const result = await IntegrationEntity.get({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
        }).go();
        if (!result.data || result.data.verified) return;

        await IntegrationEntity.patch({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
        }).set({
            verified: true,
            verifiedAt: new Date().toISOString(),
        }).go();
    }

    async markEventReceived(tenantId: string): Promise<void> {
        await IntegrationEntity.patch({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
        }).set({
            lastEventAt: new Date().toISOString(),
        }).go();
    }

    async getSentryStatus(tenantId: string): Promise<SentryIntegrationStatus> {
        const result = await IntegrationEntity.get({
            tenantId,
            integrationId: SENTRY_INTEGRATION_ID,
        }).go();
        const row = result.data;
        if (!row || !row.clientSecretEncrypted) {
            return { configured: false, verified: false, verifiedAt: null, lastEventAt: null };
        }
        return {
            configured: true,
            verified: row.verified ?? false,
            verifiedAt: row.verifiedAt ?? null,
            lastEventAt: row.lastEventAt ?? null,
        };
    }
}
