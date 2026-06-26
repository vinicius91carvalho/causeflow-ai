import type { TenantId } from '../../../../../shared/domain/value-objects.js';
import type { IIncidentRepository } from '../../../../ingestion/domain/incident.repository.js';

/**
 * Threshold below which a tenant is considered "cold-start" — not enough
 * historical incidents for Hindsight memory to carry meaningful signal.
 *
 * 10 is a rough ceiling: below this, memory recalls are empty or noisy,
 * and the seeker's quality ceiling is bounded by pure LLM reasoning +
 * the patterns catalog. Above this, the tenant has enough signal for
 * Sonnet + memory to keep pace.
 */
export const COLD_START_INCIDENT_THRESHOLD = 10;

/**
 * Returns true when the tenant has fewer than the cold-start threshold
 * of incidents. Implemented as a bounded page query — cheap even on
 * tenants with thousands of incidents (we only ever fetch up to 10).
 *
 * Kept deliberately narrow in scope — this is NOT a full tenant-maturity
 * score. It is specifically the signal that says "we should invest more
 * model quality in the seeker because memory won't carry weight yet".
 */
export async function isColdStartTenant(
    incidentRepo: IIncidentRepository,
    tenantId: TenantId,
    threshold = COLD_START_INCIDENT_THRESHOLD,
): Promise<boolean> {
    const page = await incidentRepo.listByCreatedAt(tenantId, { limit: threshold });
    return page.items.length < threshold;
}

/**
 * Resolves which model the seeker should use for this tenant on this
 * investigation. Cold-start tenants get the stronger model because the
 * quality of the hypothesis set bounds the entire investigation, and
 * cold-start has the least supporting signal.
 */
export async function resolveSeekerModel(
    incidentRepo: IIncidentRepository,
    tenantId: TenantId,
    defaults: { matureModel: string; coldStartModel: string },
): Promise<string> {
    const cold = await isColdStartTenant(incidentRepo, tenantId);
    return cold ? defaults.coldStartModel : defaults.matureModel;
}
