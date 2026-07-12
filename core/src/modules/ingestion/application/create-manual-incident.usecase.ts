import { v4 as uuidv4 } from 'uuid';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident, InvestigationMode } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { Severity } from '../../../shared/domain/types.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface CreateManualIncidentInput {
  tenantId: TenantId;
  title: string;
  description: string;
  severity?: Severity;
  suggestedAgents?: string[];
  createdBy: string;
  actorUserId?: string;
  actorEmail?: string;
  /**
   * Staff-only: stamps the reasoning strategy on the incident at
   * creation time. Route handler MUST validate the caller is staff
   * (email ending in `@causeflow.ai`) before forwarding — the use
   * case itself trusts its inputs.
   */
  investigationMode?: InvestigationMode;
  sourceProvider?: string;
}

export class CreateManualIncidentUseCase {
  repo;
  eventBus;
  messageQueue;
  alertQueueUrl;
  investigationQueueUrl;
  constructor(
    repo: IIncidentRepository,
    eventBus: IEventBus,
    messageQueue?: MessageQueue,
    alertQueueUrl?: string,
    investigationQueueUrl?: string,
  ) {
    this.repo = repo;
    this.eventBus = eventBus;
    this.messageQueue = messageQueue;
    this.alertQueueUrl = alertQueueUrl;
    this.investigationQueueUrl = investigationQueueUrl;
  }
  async execute(input: CreateManualIncidentInput): Promise<Incident> {
    if (input.title.length < 5) {
      throw new ValidationError('Title must be at least 5 characters');
    }
    if (input.description.length < 10) {
      throw new ValidationError('Description must be at least 10 characters');
    }
    const now = new Date().toISOString();
    const status = input.severity ? 'triaging' : 'open';
    const incident = {
      incidentId: incidentId(uuidv4()),
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      severity: input.severity ?? 'medium',
      status,
      sourceProvider: input.sourceProvider ?? 'chat',
      sourceAlertId: `${input.sourceProvider ?? 'chat'}-${uuidv4()}`,
      assignedAgents: input.suggestedAgents,
      investigationMode: input.investigationMode,
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.repo.create(incident as Incident);
    await this.eventBus.publish({
      eventType: 'incident.created',
      occurredAt: now,
      tenantId: input.tenantId,
      payload: {
        incidentId: created.incidentId,
        severity: created.severity,
        title: created.title,
        source: input.sourceProvider ?? 'chat',
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
      },
    });
    if (this.messageQueue) {
      if (input.severity && this.investigationQueueUrl) {
        // With severity: skip triage, go directly to investigation.
        // Defer enqueue so HTTP clients can open SSE / poll status=running first.
        const investigationJob = {
          incidentId: created.incidentId,
          tenantId: input.tenantId,
          severity: created.severity,
          suggestedAgents: input.suggestedAgents,
        };
        const queue = this.messageQueue;
        const investigationQueueUrl = this.investigationQueueUrl;
        queueMicrotask(() => {
          void queue.send(investigationQueueUrl, investigationJob);
        });
      } else if (this.alertQueueUrl) {
        // Without severity: normal triage flow
        const triageJob = {
          incidentId: created.incidentId,
          tenantId: input.tenantId,
          severity: created.severity,
        };
        const queue = this.messageQueue;
        const alertQueueUrl = this.alertQueueUrl;
        queueMicrotask(() => {
          void queue.send(alertQueueUrl, triageJob);
        });
      }
    }
    // When severity is provided, status is set to 'triaging' directly (skipping triage).
    // Emit status_changed so in-process pipeline can trigger investigation.
    if (input.severity) {
      await this.eventBus.publish({
        eventType: 'incident.status_changed',
        occurredAt: now,
        tenantId: input.tenantId,
        payload: {
          incidentId: created.incidentId,
          from: 'open',
          to: 'triaging',
          title: created.title,
          actorUserId: input.actorUserId,
          actorEmail: input.actorEmail,
        },
      });
    }
    return created;
  }
}
