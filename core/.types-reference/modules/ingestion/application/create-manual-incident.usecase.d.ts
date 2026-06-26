import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { Severity } from '../../../shared/domain/types.js';
export interface CreateManualIncidentInput {
    tenantId: TenantId;
    title: string;
    description: string;
    severity?: Severity;
    suggestedAgents?: string[];
    createdBy: string;
}
export declare class CreateManualIncidentUseCase {
    private readonly repo;
    private readonly eventBus;
    private readonly messageQueue?;
    private readonly alertQueueUrl?;
    private readonly investigationQueueUrl?;
    constructor(repo: IIncidentRepository, eventBus: IEventBus, messageQueue?: MessageQueue | undefined, alertQueueUrl?: string | undefined, investigationQueueUrl?: string | undefined);
    execute(input: CreateManualIncidentInput): Promise<Incident>;
}
