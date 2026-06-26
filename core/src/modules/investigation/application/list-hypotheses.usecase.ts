import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { Hypothesis } from '../domain/hypothesis.entity.js';
import type { IHypothesisRepository } from '../domain/hypothesis.repository.js';

/**
 * Returns every Hypothesis attached to an incident, sorted so the
 * confirmed winner (if any) appears first and remaining entries follow
 * in descending finalScore order. Intended for the UI's debate view.
 *
 * Tenant isolation is enforced at the repository layer — `tenantId` is
 * a required partition key in DynamoDB and the request handler must
 * pass the caller's authenticated tenantId (never a query param).
 */
export class ListHypothesesUseCase {
    constructor(private readonly hypothesisRepo: IHypothesisRepository) {}

    async execute(tenantId: TenantId, incidentId: IncidentId): Promise<Hypothesis[]> {
        const hypotheses = await this.hypothesisRepo.listByIncident(tenantId, incidentId);

        return [...hypotheses].sort((a, b) => {
            // Confirmed winner first — only one should exist per incident
            if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
            if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
            // Then descending finalScore (undefined → 0)
            const aScore = a.finalScore ?? 0;
            const bScore = b.finalScore ?? 0;
            if (aScore !== bScore) return bScore - aScore;
            // Tie-breaker: prior confidence descending
            return b.confidence - a.confidence;
        });
    }
}
