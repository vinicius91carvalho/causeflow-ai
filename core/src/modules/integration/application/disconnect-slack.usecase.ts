import { NotFoundError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface DisconnectSlackInput {
    tenantId: TenantId;
}

export class DisconnectSlackUseCase {
    private readonly tenantRepo: ITenantRepository;

    constructor(tenantRepo: ITenantRepository) {
        this.tenantRepo = tenantRepo;
    }

    async execute(input: DisconnectSlackInput): Promise<void> {
        const { tenantId } = input;

        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new NotFoundError('Tenant', String(tenantId));
        }

        const slackConfig = tenant.settings.slackConfig;

        // Best-effort: revoke Slack token before clearing config
        if (slackConfig?.accessToken) {
            try {
                await fetch('https://slack.com/api/auth.revoke', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ token: slackConfig.accessToken }).toString(),
                });
                // Log without token
                logger.info(
                    { tenantId: String(tenantId), workspaceId: slackConfig.workspaceId },
                    'Slack token revoked',
                );
            } catch (err) {
                // Swallow errors — revocation is best-effort
                logger.warn(
                    { tenantId: String(tenantId), err: err instanceof Error ? err.message : 'unknown' },
                    'Slack token revocation failed (swallowed)',
                );
            }
        }

        // Remove slackConfig from tenant settings
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slackConfig: _removed, ...remainingSettings } = tenant.settings;
        await this.tenantRepo.update(tenantId, {
            settings: remainingSettings,
        });

        logger.info({ tenantId: String(tenantId) }, 'Slack integration disconnected');
    }
}
