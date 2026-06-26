import type { TenantId } from '../../domain/value-objects.js';

export interface RelayCommand {
    resourceId: string;
    operation: string;
    params: Record<string, unknown>;
}

export interface RelayDetection {
    detector: string;
    count: number;
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
    detections?: RelayDetection[];
    warnings?: string[];
    requiresApproval?: boolean;
}

export interface RelayResource {
    resourceId: string;
    type: string;
    name: string;
    database: string;
    readOnly: boolean;
    capabilities?: string[];
}

export type RelayErrorCode =
    | 'not_connected'
    | 'session_denied'
    | 'approval_required'
    | 'rate_limited'
    | 'policy_denied'
    | 'validation_failed'
    | 'unknown_resource'
    | 'relay_timeout'
    | 'internal';

export class RelayGatewayError extends Error {
    constructor(
        message: string,
        readonly code: RelayErrorCode,
        readonly rpcCode?: number,
        readonly retriable: boolean = false,
        readonly data?: unknown,
    ) {
        super(message);
        this.name = 'RelayGatewayError';
    }
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
