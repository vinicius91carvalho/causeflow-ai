import { IncidentNotFoundError, InvalidStatusTransitionError } from '../domain/incident.errors.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IncidentStatus } from '../../../shared/domain/types.js';
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['triaging', 'closed'],
  triaging: ['investigating', 'closed', 'resolved'],
  investigating: ['awaiting_approval', 'resolved', 'closed', 'failed', 'cost_exceeded'],
  awaiting_approval: ['remediating', 'investigating'],
  remediating: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
  aborted: [],
  cost_exceeded: [],
  failed: ['investigating', 'closed'],
  // inconclusive is a terminal state — no valid transitions out
  inconclusive: [],
};
export class UpdateIncidentStatusUseCase {
  repo;
  eventBus;
  constructor(repo: IIncidentRepository, eventBus: IEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }
  async execute(
    tenantId: TenantId,
    incidentId: IncidentId,
    newStatus: IncidentStatus,
    actorUserId?: string,
    actorEmail?: string,
  ): Promise<Incident> {
    const incident = await this.repo.findById(tenantId, incidentId);
    if (!incident) {
      throw new IncidentNotFoundError(incidentId);
    }
    const allowed = VALID_TRANSITIONS[incident.status];
    if (!allowed?.includes(newStatus)) {
      throw new InvalidStatusTransitionError(incident.status, newStatus);
    }
    const resolvedAt =
      newStatus === 'resolved' || newStatus === 'closed' ? new Date().toISOString() : undefined;
    const updated = await this.repo.updateStatus(tenantId, incidentId, newStatus, resolvedAt);
    await this.eventBus.publish({
      eventType: 'incident.status_changed',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: {
        incidentId,
        from: incident.status,
        to: newStatus,
        title: incident.title,
        actorUserId,
        actorEmail,
      },
    });
    return updated;
  }
}
