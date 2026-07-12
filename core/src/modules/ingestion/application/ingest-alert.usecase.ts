import { v4 as uuidv4 } from 'uuid';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { config } from '../../../shared/config/index.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ProviderRegistry } from '../../../shared/application/provider-registry.js';
import type { RawAlert } from '../../../shared/application/ports/alert-source.port.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class IngestAlertUseCase {
  repo;
  eventBus;
  providerRegistry;
  messageQueue;
  alertQueueUrl;
  constructor(
    repo: IIncidentRepository,
    eventBus: IEventBus,
    providerRegistry: ProviderRegistry,
    messageQueue?: MessageQueue,
    alertQueueUrl?: string,
  ) {
    this.repo = repo;
    this.eventBus = eventBus;
    this.providerRegistry = providerRegistry;
    this.messageQueue = messageQueue;
    this.alertQueueUrl = alertQueueUrl;
  }
  async execute(tenantId: TenantId, rawAlert: RawAlert): Promise<Incident> {
    const parser = this.providerRegistry.getAlertParser(rawAlert.source);
    if (!parser) {
      throw new ValidationError(`No parser registered for source: ${rawAlert.source}`);
    }
    const normalized = parser.parse(rawAlert);
    const existing = await this.repo.findBySourceAlert(
      tenantId,
      normalized.source,
      normalized.externalId,
    );
    if (existing) {
      // Check dedup window: if the existing incident's createdAt is within
      // the configured window, return it (no duplicate). Otherwise treat
      // this as a new occurrence and create a fresh incident.
      const createdAt = new Date(existing.createdAt).getTime();
      const now = Date.now();
      const windowMs = config.ingestion.dedupWindowMinutes * 60 * 1000;
      if (now - createdAt < windowMs) {
        return existing;
      }
    }
    const now = new Date().toISOString();
    const incident = {
      incidentId: incidentId(uuidv4()),
      tenantId,
      title: normalized.title,
      description: normalized.description,
      severity: normalized.severity,
      status: 'open',
      sourceProvider: normalized.source,
      sourceAlertId: normalized.externalId,
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.repo.create(incident as Incident);
    await this.eventBus.publish({
      eventType: 'incident.created',
      occurredAt: now,
      tenantId,
      payload: { incidentId: created.incidentId, severity: created.severity, title: created.title },
    });
    if (this.messageQueue && this.alertQueueUrl) {
      await this.messageQueue.send(this.alertQueueUrl, {
        incidentId: created.incidentId,
        tenantId,
        severity: created.severity,
      });
    }
    return created;
  }
}
