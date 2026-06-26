import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
export interface DisconnectIntegrationInput {
    tenantId: TenantId;
    provider: string;
    disconnectedBy?: string;
}
export declare class DisconnectIntegrationUseCase {
    private readonly eventBus?;
    constructor(eventBus?: IEventBus | undefined);
    execute(input: DisconnectIntegrationInput): Promise<{
        success: true;
    }>;
}
