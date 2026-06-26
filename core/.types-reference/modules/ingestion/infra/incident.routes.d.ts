import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { GetIncidentUseCase } from '../application/get-incident.usecase.js';
import type { ListIncidentsUseCase } from '../application/list-incidents.usecase.js';
import type { UpdateIncidentStatusUseCase } from '../application/update-incident-status.usecase.js';
import type { CreateManualIncidentUseCase } from '../application/create-manual-incident.usecase.js';
import type { DeductCreditUseCase } from '../../tenant/application/deduct-credit.usecase.js';
import type { RefundCreditUseCase } from '../../tenant/application/refund-credit.usecase.js';
import type { CheckQuotaUseCase } from '../../billing/application/check-quota.usecase.js';
import type { RecordUsageUseCase } from '../../billing/application/record-usage.usecase.js';
export interface IncidentUseCases {
    getIncident: GetIncidentUseCase;
    listIncidents: ListIncidentsUseCase;
    updateIncidentStatus: UpdateIncidentStatusUseCase;
    createManualIncident: CreateManualIncidentUseCase;
    incidentRepo: IIncidentRepository;
    /** @deprecated Use checkQuota + recordUsage instead */
    deductCredit?: DeductCreditUseCase;
    /** @deprecated Use checkQuota + recordUsage instead */
    refundCredit?: RefundCreditUseCase;
    checkQuota?: CheckQuotaUseCase;
    recordUsage?: RecordUsageUseCase;
}
export declare function createIncidentRoutes(useCases: IncidentUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
