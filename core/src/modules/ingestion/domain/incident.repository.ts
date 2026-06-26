import type { Incident } from './incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IncidentStatus, Severity } from '../../../shared/domain/types.js';
export interface ListOptions {
    limit?: number;
    cursor?: string;
}
export interface IIncidentRepository {
    create(incident: Incident): Promise<Incident>;
    findById(tenantId: TenantId, incidentId: IncidentId): Promise<Incident | null>;
    findBySourceAlert(tenantId: TenantId, sourceProvider: string, sourceAlertId: string): Promise<Incident | null>;
    update(tenantId: TenantId, incidentId: IncidentId, data: Partial<Omit<Incident, 'incidentId' | 'tenantId' | 'createdAt'>>): Promise<Incident>;
    updateStatus(tenantId: TenantId, incidentId: IncidentId, status: IncidentStatus, resolvedAt?: string): Promise<Incident>;
    listByTenant(tenantId: TenantId, options?: ListOptions): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
    findBySeverity(tenantId: TenantId, severity: Severity, options?: ListOptions): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
    findByStatus(tenantId: TenantId, severity: Severity, status: IncidentStatus, options?: ListOptions): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
    listByCreatedAt(tenantId: TenantId, options?: ListOptions & {
        order?: 'asc' | 'desc';
    }): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
    findAll(tenantId: TenantId): Promise<Incident[]>;
}
