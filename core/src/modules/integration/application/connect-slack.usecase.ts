import { ValidationError, NotFoundError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { SlackConfig, SlackConfigResponse } from '../../tenant/domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TokenEncryption } from '../../../shared/application/ports/token-encryption.port.js';

export interface ConnectSlackInput {
  code: string;
  tenantId: TenantId;
}

export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface SlackOAuthV2Response {
  ok: boolean;
  error?: string;
  access_token?: string;
  incoming_webhook?: {
    url: string;
    channel: string;
    channel_id: string;
    configuration_url?: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

export class ConnectSlackUseCase {
  private readonly tenantRepo: ITenantRepository;
  private readonly oauthConfig: SlackOAuthConfig;
  private readonly tokenEncryption: TokenEncryption;

  constructor(
    tenantRepo: ITenantRepository,
    oauthConfig: SlackOAuthConfig,
    tokenEncryption: TokenEncryption,
  ) {
    this.tenantRepo = tenantRepo;
    this.oauthConfig = oauthConfig;
    this.tokenEncryption = tokenEncryption;
  }

  async execute(input: ConnectSlackInput): Promise<SlackConfigResponse> {
    const { tenantId } = input;

    // Find tenant (ensure it exists before calling Slack API)
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant', String(tenantId));
    }

    // Exchange OAuth code with Slack
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      code: input.code,
      redirect_uri: this.oauthConfig.redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new ValidationError(`Slack OAuth HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as SlackOAuthV2Response;

    if (!data.ok) {
      throw new ValidationError(`Slack OAuth exchange failed: ${data.error ?? 'unknown_error'}`);
    }

    if (!data.access_token || !data.incoming_webhook || !data.team) {
      throw new ValidationError('Slack OAuth response missing required fields');
    }

    const now = new Date().toISOString();

    // Encrypt the access token before storing
    const encryptedPayload = await this.tokenEncryption.encrypt(data.access_token);
    const accessToken = JSON.stringify(encryptedPayload);

    // Build SlackConfig — access_token is stored encrypted, never logged
    const slackConfig: SlackConfig = {
      accessToken,
      webhookUrl: data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
      channelId: data.incoming_webhook.channel_id,
      workspaceId: data.team.id,
      workspaceName: data.team.name,
      installedAt: now,
      ...(data.incoming_webhook.configuration_url && {
        configurationUrl: data.incoming_webhook.configuration_url,
      }),
    };

    // Persist to tenant settings — only log safe fields
    await this.tenantRepo.update(tenantId, {
      settings: {
        ...tenant.settings,
        slackConfig,
      },
    });

    logger.info(
      {
        tenantId: String(tenantId),
        workspaceId: slackConfig.workspaceId,
        channel: slackConfig.channel,
      },
      'Slack integration connected',
    );

    return {
      connected: true,
      channel: slackConfig.channel,
      workspaceName: slackConfig.workspaceName,
      installedAt: slackConfig.installedAt,
    };
  }
}
