import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { SlackConfigResponse } from '../../tenant/domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface UpdateSlackConfigInput {
    tenantId: TenantId;
    channel: string;
}

/** Channel must start with '#' followed by 1-79 lowercase alphanumeric/hyphen/underscore chars */
const CHANNEL_REGEX = /^#[a-z0-9_-]{1,79}$/;

export class UpdateSlackConfigUseCase {
    private readonly tenantRepo: ITenantRepository;

    constructor(tenantRepo: ITenantRepository) {
        this.tenantRepo = tenantRepo;
    }

    async execute(input: UpdateSlackConfigInput): Promise<SlackConfigResponse> {
        const { tenantId, channel } = input;

        if (!CHANNEL_REGEX.test(channel)) {
            throw new ValidationError(
                'Invalid channel format. Must match ^#[a-z0-9_-]{1,79}$',
                { channel },
            );
        }

        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new NotFoundError('Tenant', String(tenantId));
        }

        if (!tenant.settings.slackConfig) {
            throw new ValidationError('Slack is not connected. Connect Slack first.');
        }

        const updatedConfig = {
            ...tenant.settings.slackConfig,
            channel,
        };

        await this.tenantRepo.update(tenantId, {
            settings: {
                ...tenant.settings,
                slackConfig: updatedConfig,
            },
        });

        logger.info(
            { tenantId: String(tenantId), channel },
            'Slack channel updated',
        );

        return {
            connected: true,
            channel: updatedConfig.channel,
            workspaceName: updatedConfig.workspaceName,
            installedAt: updatedConfig.installedAt,
        };
    }
}
