import { tenantId as toTenantId, incidentId as toIncidentId } from '../../domain/value-objects.js';
import {
  formatIncidentBlocks,
  formatInvestigationStartedBlocks,
  formatResolutionBlocks,
} from '../../infra/chat/slack-message-formatter.js';
import { config } from '../../config/index.js';
import type { DomainEvent } from '../../domain/events.js';
import type { ITenantRepository } from '../../../modules/tenant/domain/tenant.repository.js';
import type { IIncidentRepository } from '../../../modules/ingestion/domain/incident.repository.js';
import type { SlackNotificationRepository } from '../../../modules/integration/infra/slack-notification.repository.js';
import type { Logger } from '../../infra/logger.js';
import type { TokenEncryption, EncryptedPayload } from '../ports/token-encryption.port.js';

/**
 * Subscribes to domain events and posts Slack notifications.
 *
 * Architecture note: WebClient is instantiated per-call (not injected) because
 * each tenant has its own accessToken stored in DynamoDB. The subscriber lives in
 * the application layer; the import of WebClient here is the accepted pragmatic
 * exception documented in the Sprint 2 spec.
 *
 * SECURITY: accessToken MUST NEVER appear in any logger call.
 */
export class SlackNotificationSubscriber {
  constructor(
    private readonly tenantRepo: Pick<ITenantRepository, 'findById'>,
    private readonly incidentRepo: Pick<IIncidentRepository, 'findById' | 'update'>,
    private readonly slackNotificationRepo: SlackNotificationRepository,
    private readonly logger: Logger,
    private readonly tokenEncryption: TokenEncryption,
  ) {}

  /** Decrypt a stored Slack access token (handles both encrypted and legacy plaintext). */
  private async decryptToken(raw: string): Promise<string> {
    try {
      const encrypted: EncryptedPayload = JSON.parse(raw);
      if (encrypted.ciphertext && encrypted.encryptedDek) {
        return await this.tokenEncryption.decrypt(encrypted);
      }
    } catch {
      // Not JSON or not an EncryptedPayload — treat as legacy plaintext
    }
    return raw;
  }

  async onIncidentCreated(event: DomainEvent): Promise<void> {
    try {
      const tenantId = event.tenantId;
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      const severity = (event.payload['severity'] as string) ?? '';

      if (!['critical', 'high'].includes(severity)) {
        return;
      }

      const tenant = await this.tenantRepo.findById(toTenantId(tenantId));
      if (!tenant?.settings?.slackConfig) {
        this.logger.info(
          { tenantId, incidentId },
          'slack.notification.skipped reason=not_configured',
        );
        return;
      }

      const { slackConfig } = tenant.settings;

      // Deduplication check
      const existing = await this.slackNotificationRepo.findNotification(
        tenantId,
        incidentId,
        'alert',
      );
      if (existing) {
        this.logger.info({ tenantId, incidentId }, 'slack.notification.skipped reason=dedup');
        return;
      }

      const incident = await this.incidentRepo.findById(
        toTenantId(tenantId),
        toIncidentId(incidentId),
      );
      if (!incident) {
        this.logger.warn(
          { tenantId, incidentId },
          'slack.notification.skipped reason=incident_not_found',
        );
        return;
      }

      const blocks = formatIncidentBlocks({
        severity: incident.severity,
        title: incident.title,
        service: incident.sourceProvider,
        environment: 'production',
        investigationUrl: `${config.dashboardUrl}/investigations/${incidentId}`,
        triggeredAt: event.occurredAt,
      });

      const plainToken = await this.decryptToken(slackConfig.accessToken);
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(plainToken);
      const result = await client.chat.postMessage({
        channel: slackConfig.channelId,
        text: `[${incident.severity.toUpperCase()}] ${incident.title}`,
        blocks,
      });

      await this.slackNotificationRepo.saveNotification({
        tenantId,
        incidentId,
        type: 'alert',
        messageTs: result.ts!,
        channel: slackConfig.channelId,
        status: 'sent',
      });

      // Save the messageTs to the incident for threading resolution replies
      await this.incidentRepo.update(toTenantId(tenantId), toIncidentId(incidentId), {
        slackNotificationTs: result.ts!,
      });

      this.logger.info(
        { tenantId, incidentId, channel: slackConfig.channelId },
        'slack.notification.sent',
      );
    } catch (err) {
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      this.logger.error(
        { incidentId, error: err instanceof Error ? err.message : 'unknown' },
        'slack.notification.failed',
      );
    }
  }

  async onInvestigationStarted(event: DomainEvent): Promise<void> {
    try {
      const tenantId = event.tenantId;
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      const severity = (event.payload['severity'] as string) ?? '';

      const tenant = await this.tenantRepo.findById(toTenantId(tenantId));
      if (!tenant?.settings?.slackConfig) {
        this.logger.info(
          { tenantId, incidentId },
          'slack.notification.skipped reason=not_configured',
        );
        return;
      }

      const { slackConfig } = tenant.settings;

      const existing = await this.slackNotificationRepo.findNotification(
        tenantId,
        incidentId,
        'investigation_started',
      );
      if (existing) {
        this.logger.info({ tenantId, incidentId }, 'slack.notification.skipped reason=dedup');
        return;
      }

      const incident = await this.incidentRepo.findById(
        toTenantId(tenantId),
        toIncidentId(incidentId),
      );
      if (!incident) {
        this.logger.warn(
          { tenantId, incidentId },
          'slack.notification.skipped reason=incident_not_found',
        );
        return;
      }

      const blocks = formatInvestigationStartedBlocks({
        incidentTitle: incident.title,
        severity: severity || incident.severity,
        investigationUrl: `${config.dashboardUrl}/investigations/${incidentId}`,
        startedAt: event.occurredAt,
      });

      const slackNotificationTs = incident.slackNotificationTs;

      const plainToken = await this.decryptToken(slackConfig.accessToken);
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(plainToken);
      const result = await client.chat.postMessage({
        channel: slackConfig.channelId,
        text: `🔍 AI Investigation Started — ${incident.title}`,
        blocks,
        ...(slackNotificationTs ? { thread_ts: slackNotificationTs } : {}),
      });

      await this.slackNotificationRepo.saveNotification({
        tenantId,
        incidentId,
        type: 'investigation_started',
        messageTs: result.ts!,
        channel: slackConfig.channelId,
        status: 'sent',
      });

      this.logger.info(
        { tenantId, incidentId, channel: slackConfig.channelId },
        'slack.investigation_started.sent',
      );
    } catch (err) {
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      this.logger.error(
        { incidentId, error: err instanceof Error ? err.message : 'unknown' },
        'slack.notification.failed',
      );
    }
  }

  async onInvestigationCompleted(event: DomainEvent): Promise<void> {
    try {
      const tenantId = event.tenantId;
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      const rootCause = (event.payload['rootCause'] as string) ?? '';
      const recommendedActions =
        (event.payload['recommendedActions'] as Array<{ description?: string; action?: string }>) ??
        [];
      const investigationDurationMs = (event.payload['investigationDurationMs'] as number) ?? 0;

      const tenant = await this.tenantRepo.findById(toTenantId(tenantId));
      if (!tenant?.settings?.slackConfig) {
        this.logger.info(
          { tenantId, incidentId },
          'slack.notification.skipped reason=not_configured',
        );
        return;
      }

      const { slackConfig } = tenant.settings;

      // Deduplication check
      const existing = await this.slackNotificationRepo.findNotification(
        tenantId,
        incidentId,
        'resolution',
      );
      if (existing) {
        this.logger.info({ tenantId, incidentId }, 'slack.notification.skipped reason=dedup');
        return;
      }

      const incident = await this.incidentRepo.findById(
        toTenantId(tenantId),
        toIncidentId(incidentId),
      );
      if (!incident) {
        this.logger.warn(
          { tenantId, incidentId },
          'slack.notification.skipped reason=incident_not_found',
        );
        return;
      }

      const actionDescriptions = recommendedActions
        .slice(0, 2)
        .map((a) => a.description ?? a.action ?? '');

      const blocks = formatResolutionBlocks({
        incidentTitle: incident.title,
        rootCause,
        recommendedActions: actionDescriptions,
        durationMs: investigationDurationMs,
        reportUrl: `${config.dashboardUrl}/investigations/${incidentId}`,
      });

      const slackNotificationTs = incident.slackNotificationTs;

      const plainToken = await this.decryptToken(slackConfig.accessToken);
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(plainToken);
      const result = await client.chat.postMessage({
        channel: slackConfig.channelId,
        text: `✅ Incident Resolved — ${incident.title}`,
        blocks,
        ...(slackNotificationTs ? { thread_ts: slackNotificationTs } : {}),
      });

      await this.slackNotificationRepo.saveNotification({
        tenantId,
        incidentId,
        type: 'resolution',
        messageTs: result.ts!,
        channel: slackConfig.channelId,
        status: 'sent',
      });

      this.logger.info(
        { tenantId, incidentId, channel: slackConfig.channelId },
        'slack.resolution.sent',
      );
    } catch (err) {
      const incidentId = (event.payload['incidentId'] as string) ?? '';
      this.logger.error(
        { incidentId, error: err instanceof Error ? err.message : 'unknown' },
        'slack.notification.failed',
      );
    }
  }
}
