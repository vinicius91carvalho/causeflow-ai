import { v4 as uuidv4 } from 'uuid';
import { evidenceId } from '../../../shared/domain/value-objects.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { getLogger } from '../../../shared/infra/logger/log-context.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface AddInvestigationContextInput {
  tenantId: TenantId;
  incidentId: IncidentId;
  context: string;
  intent?: 'correction' | 'additional_context';
  addedBy: string;
  reinvestigate?: boolean;
  suggestedAgents?: string[];
}

export interface AddInvestigationContextDeps {
  incidentRepo: IIncidentRepository;
  evidenceRepo: IEvidenceRepository;
  eventBus: IEventBus;
  messageQueue?: MessageQueue;
  investigationQueueUrl?: string;
}

export class AddInvestigationContextUseCase {
  deps;
  constructor(deps: AddInvestigationContextDeps) {
    this.deps = deps;
  }
  async execute(input: AddInvestigationContextInput) {
    if (input.context.length < 5) {
      throw new ValidationError('Context must be at least 5 characters');
    }
    const incident = await this.deps.incidentRepo.findById(input.tenantId, input.incidentId);
    if (!incident) {
      throw new NotFoundError('Incident', input.incidentId);
    }
    // Save evidence with user context
    const eid = evidenceId(uuidv4());
    await this.deps.evidenceRepo.create({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      evidenceId: eid,
      agentRole: 'operator',
      evidenceType: 'user_context',
      content: input.context,
      metadata: {
        source: `user:${input.addedBy}`,
        label: input.intent === 'correction' ? 'Operator Correction' : 'Operator Context',
        category: input.intent ?? 'additional_context',
      },
      createdAt: new Date().toISOString(),
    });
    // Append context to incident description
    await this.deps.incidentRepo.update(input.tenantId, input.incidentId, {
      description:
        input.intent === 'correction'
          ? `${incident.description}\n\n[CORRECTION] ${input.context}`
          : `${incident.description}\n\n[Operator Context] ${input.context}`,
      updatedAt: new Date().toISOString(),
    });
    let reinvestigationTriggered = false;
    if (input.reinvestigate) {
      // Reinvestigate from terminal/waiting states + triaging (stuck from crashed worker).
      // Never from 'investigating' (worker is actively running).
      const reinvestigatableStatuses = ['triaging', 'awaiting_approval', 'resolved', 'closed'];
      if (reinvestigatableStatuses.includes(incident.status)) {
        // Bypass state machine — conscious user action
        await this.deps.incidentRepo.updateStatus(input.tenantId, input.incidentId, 'triaging');
        await this.deps.eventBus.publish({
          eventType: 'incident.status_changed',
          occurredAt: new Date().toISOString(),
          tenantId: input.tenantId,
          payload: {
            incidentId: input.incidentId,
            from: incident.status,
            to: 'triaging',
            title: incident.title,
          },
        });
        if (this.deps.messageQueue && this.deps.investigationQueueUrl) {
          await this.deps.messageQueue.send(this.deps.investigationQueueUrl, {
            incidentId: input.incidentId,
            tenantId: input.tenantId,
            severity: incident.severity,
            suggestedAgents: input.suggestedAgents ??
              incident.assignedAgents ?? [
                'log_analyst',
                'metric_analyst',
                'change_detector',
                'code_analyzer',
                'infra_inspector',
                'db_analyst',
              ],
          });
          getLogger().info(
            {
              event: 'investigation.enqueued',
              incidentId: input.incidentId,
              tenantId: input.tenantId,
              severity: incident.severity,
              agentCount: (input.suggestedAgents ?? incident.assignedAgents ?? []).length,
            },
            'investigation.enqueued',
          );
        }
        reinvestigationTriggered = true;
      }
    }
    return {
      evidenceId: eid,
      incidentId: input.incidentId,
      reinvestigationTriggered,
    };
  }
}
