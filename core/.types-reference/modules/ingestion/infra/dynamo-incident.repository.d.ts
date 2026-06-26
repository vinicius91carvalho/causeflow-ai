import type { IIncidentRepository, ListOptions } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IncidentStatus, Severity } from '../../../shared/domain/types.js';
export declare class DynamoIncidentRepository implements IIncidentRepository {
    create(incident: Incident): Promise<Incident>;
    findById(tenantId: TenantId, id: IncidentId): Promise<Incident | null>;
    findBySourceAlert(tenantId: TenantId, sourceProvider: string, sourceAlertId: string): Promise<Incident | null>;
    update(tenantId: TenantId, id: IncidentId, data: Partial<Omit<Incident, 'incidentId' | 'tenantId' | 'createdAt'>>): Promise<Incident>;
    updateStatus(tenantId: TenantId, id: IncidentId, status: IncidentStatus, resolvedAt?: string): Promise<Incident>;
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
    findAll(tenantId: TenantId): Promise<Incident[]>;
    listByCreatedAt(tenantId: TenantId, options?: ListOptions & {
        order?: 'asc' | 'desc';
    }): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
}
