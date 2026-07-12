import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { Severity } from '../../../shared/domain/types.js';

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export class UpdateIncidentSeverityUseCase {
  repo;
  eventBus;
  constructor(repo: IIncidentRepository, eventBus: IEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }
  async execute(tenantId: TenantId, incidentId: IncidentId, newSeverity: string): Promise<void> {
    if (!VALID_SEVERITIES.includes(newSeverity as Severity)) {
      throw new ValidationError(
        `Invalid severity: ${newSeverity}. Must be one of: critical, high, medium, low, info`,
      );
    }
    const incident = await this.repo.findById(tenantId, incidentId);
    if (!incident) {
      throw new NotFoundError('Incident', incidentId);
    }
    const previousSeverity = incident.severity;
    if (previousSeverity === newSeverity) {
      return; // No change — no event needed
    }
    await this.repo.update(tenantId, incidentId, {
      severity: newSeverity as Severity,
      updatedAt: new Date().toISOString(),
    });
    await this.eventBus.publish({
      eventType: 'incident.severity_changed',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: {
        incidentId,
        severity: newSeverity,
        previousSeverity,
        title: incident.title ?? 'Incident',
      },
    });
  }
}
