import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TokenEncryption } from '../../../shared/application/ports/token-encryption.port.js';
import type { IEventBus } from '../../../shared/domain/events.js';
export interface ConnectCredentialInput {
    tenantId: TenantId;
    provider: string;
    credentials: Record<string, string>;
    connectedBy: string;
}
export interface ConnectCredentialOutput {
    integrationId: string;
    provider: string;
    status: string;
    connectedBy: string;
    createdAt: string;
}
export declare class ConnectCredentialUseCase {
    private readonly encryption;
    private readonly eventBus?;
    constructor(encryption: TokenEncryption, eventBus?: IEventBus | undefined);
    execute(input: ConnectCredentialInput): Promise<ConnectCredentialOutput>;
}
