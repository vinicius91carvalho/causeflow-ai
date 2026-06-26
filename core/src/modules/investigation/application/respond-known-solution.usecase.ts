import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';

export interface RespondKnownSolutionInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    response: 'accepted' | 'declined';
    actor: string;
    rootCauseHash?: string;
}

export class RespondKnownSolutionUseCase {
    incidentRepo;
    eventBus;
    runbookRegistry;
    constructor(incidentRepo: IIncidentRepository, eventBus: IEventBus, runbookRegistry?: IRunbookRegistryRepository) {
        this.incidentRepo = incidentRepo;
        this.eventBus = eventBus;
        this.runbookRegistry = runbookRegistry;
    }
    async execute(input: RespondKnownSolutionInput) {
        const { tenantId, incidentId, response, actor } = input;
        const incident = await this.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            throw new NotFoundError('Incident', incidentId);
        }
        if (incident.knownSolutionStatus !== 'pending') {
            throw new ValidationError('Incident does not have a pending known solution', {
                currentStatus: incident.knownSolutionStatus ?? 'none',
            });
        }
        if (response === 'accepted') {
            await this.incidentRepo.update(tenantId, incidentId, {
                knownSolutionStatus: 'accepted',
                status: 'resolved',
                resolution: `Resolved via known solution (memory-matched)`,
                resolvedAt: new Date().toISOString(),
            });
            // Increment runbook registry confirmations if hash provided
            if (input.rootCauseHash && this.runbookRegistry) {
                const existing = await this.runbookRegistry.findByHash(tenantId, input.rootCauseHash);
                if (existing) {
                    await this.runbookRegistry.upsert({
                        ...existing,
                        occurrences: existing.occurrences + 1,
                        confirmations: existing.confirmations + 1,
                        lastSeen: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                }
            }
            await this.eventBus.publish({
                eventType: 'investigation.known_solution_accepted',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: { incidentId, actor },
            });
            return { status: 'accepted' };
        }
        // Declined — mark and let normal investigation pipeline continue
        await this.incidentRepo.update(tenantId, incidentId, {
            knownSolutionStatus: 'declined',
        });
        await this.eventBus.publish({
            eventType: 'investigation.known_solution_declined',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { incidentId, actor },
        });
        return { status: 'declined' };
    }
}
