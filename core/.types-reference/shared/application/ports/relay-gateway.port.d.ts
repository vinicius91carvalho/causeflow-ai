import type { TenantId } from '../../domain/value-objects.js';
export interface RelayCommand {
    resourceId: string;
    operation: 'query' | 'describe_table' | 'list_tables' | 'explain';
    params: Record<string, unknown>;
}
export interface RelayQueryResult {
    rows: Record<string, unknown>[];
    rowCount: number;
    fields?: Array<{
        name: string;
        type: string;
    }>;
    executionTimeMs: number;
    masked: boolean;
    maskedFieldCount: number;
}
export interface RelayResource {
    resourceId: string;
    type: 'postgres' | 'mongodb';
    name: string;
    database: string;
    readOnly: boolean;
}
export interface IRelayGateway {
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
}
