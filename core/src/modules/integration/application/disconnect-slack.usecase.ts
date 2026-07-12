import { NotFoundError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type {
  TokenEncryption,
  EncryptedPayload,
} from '../../../shared/application/ports/token-encryption.port.js';

export interface DisconnectSlackInput {
  tenantId: TenantId;
}

export class DisconnectSlackUseCase {
  private readonly tenantRepo: ITenantRepository;
  private readonly tokenEncryption: TokenEncryption;

  constructor(tenantRepo: ITenantRepository, tokenEncryption: TokenEncryption) {
    this.tenantRepo = tenantRepo;
    this.tokenEncryption = tokenEncryption;
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
        // Decrypt the stored token for revocation
        let plainToken: string;
        try {
          const encrypted: EncryptedPayload = JSON.parse(slackConfig.accessToken);
          plainToken = await this.tokenEncryption.decrypt(encrypted);
        } catch {
          // Fallback: assume stored as plaintext (e.g. from before encryption was added)
          plainToken = slackConfig.accessToken;
        }
        await fetch('https://slack.com/api/auth.revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: plainToken }).toString(),
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
