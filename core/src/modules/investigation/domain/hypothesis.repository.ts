import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { Hypothesis } from './hypothesis.entity.js';

/**
 * Port for persisting and querying Hypothesis aggregates. The repository
 * is incident-scoped — there is no tenant-wide listing because hypotheses
 * are always retrieved in the context of an incident.
 */
export interface IHypothesisRepository {
    create(hypothesis: Hypothesis): Promise<Hypothesis>;
    findById(
        tenantId: TenantId,
        incidentId: IncidentId,
        hypothesisId: string,
    ): Promise<Hypothesis | null>;
    listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Hypothesis[]>;
    update(
        tenantId: TenantId,
        incidentId: IncidentId,
        hypothesisId: string,
        patch: Partial<Omit<Hypothesis, 'hypothesisId' | 'tenantId' | 'incidentId' | 'createdAt'>>,
    ): Promise<Hypothesis>;
}
