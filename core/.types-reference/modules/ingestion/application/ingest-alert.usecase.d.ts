import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ProviderRegistry } from '../../../shared/application/provider-registry.js';
import type { RawAlert } from '../../../shared/application/ports/alert-source.port.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class IngestAlertUseCase {
    private readonly repo;
    private readonly eventBus;
    private readonly providerRegistry;
    private readonly messageQueue?;
    private readonly alertQueueUrl?;
    constructor(repo: IIncidentRepository, eventBus: IEventBus, providerRegistry: ProviderRegistry, messageQueue?: MessageQueue | undefined, alertQueueUrl?: string | undefined);
    execute(tenantId: TenantId, rawAlert: RawAlert): Promise<Incident>;
}
