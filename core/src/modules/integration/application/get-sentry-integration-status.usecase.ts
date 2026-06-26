import type { ISentryIntegrationRepository, SentryIntegrationStatus } from '../domain/sentry-integration.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

/**
 * Returns the Sentry integration public status for the dashboard.
 *
 * Security contract: never returns clientSecret, clientSecretEncrypted, or any
 * derived cryptographic material. Response is safe to serialize to API consumers.
 */
export class GetSentryIntegrationStatusUseCase {
    constructor(
        private readonly sentryRepo: ISentryIntegrationRepository,
    ) {}

    async execute(tenantId: TenantId): Promise<SentryIntegrationStatus> {
        return this.sentryRepo.getSentryStatus(String(tenantId));
    }
}
