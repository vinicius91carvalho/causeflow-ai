import type { IRelayGateway, RelayCommand, RelayQueryResult, RelayResource } from '../../application/ports/relay-gateway.port.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { RelayRegistry } from './relay-registry.js';
export declare class WssRelayGateway implements IRelayGateway {
    private readonly registry;
    private pending;
    private readonly timeoutMs;
    constructor(registry: RelayRegistry, timeoutMs?: number);
    isConnected(tenantId: TenantId): boolean;
    listResources(tenantId: TenantId): Promise<RelayResource[]>;
    execute(tenantId: TenantId, command: RelayCommand): Promise<RelayQueryResult>;
    describeResource(tenantId: TenantId, resourceId: string): Promise<{
        tables: Array<{
            name: string;
            rowCount?: number;
        }>;
        type: string;
        database: string;
    }>;
    private sendRpc;
}
