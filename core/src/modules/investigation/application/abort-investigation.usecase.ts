import { AppError } from '../../../shared/domain/errors.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { InvestigationRegistry } from './investigation-registry.js';
export class AbortInvestigationUseCase {
    incidentRepo;
    eventBus;
    registry;
    constructor(incidentRepo: IIncidentRepository, eventBus: IEventBus, registry: InvestigationRegistry) {
        this.incidentRepo = incidentRepo;
        this.eventBus = eventBus;
        this.registry = registry;
    }
    async execute(tenantId: TenantId, incidentId: IncidentId, abortedBy: string) {
        const incident = await this.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            throw new AppError('Incident not found', 'INCIDENT_NOT_FOUND', 404);
        }
        if (incident.status !== 'investigating' && incident.status !== 'triaging') {
            throw new AppError(`Cannot abort investigation — incident status is "${incident.status}"`, 'INVALID_STATUS_TRANSITION', 409);
        }
        // Signal the AbortController (agents will stop on next iteration)
        const wasActive = this.registry.abort(tenantId, incidentId);
        // Update status regardless of whether the investigation was tracked in registry
        // (it might be running in a different process via SQS consumer)
        const updated = await this.incidentRepo.updateStatus(tenantId, incidentId, 'aborted');
        await this.eventBus.publish({
            eventType: 'investigation.aborted',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId,
                abortedBy,
                wasActiveInRegistry: wasActive,
            },
        });
        return { incidentId: updated.incidentId, status: updated.status };
    }
}
