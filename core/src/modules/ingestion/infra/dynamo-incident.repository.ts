import { incidentId } from '../../../shared/domain/value-objects.js';
import { IncidentEntity } from '../../../shared/infra/db/entities/IncidentEntity.js';
import type { IIncidentRepository, ListOptions } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IncidentStatus, Severity } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, unknown>): Incident {
    return {
        incidentId: incidentId(raw['incidentId'] as string),
        tenantId: raw['tenantId'],
        title: raw['title'],
        description: (raw['description'] ?? '') as string,
        severity: raw['severity'],
        status: raw['status'],
        sourceProvider: raw['sourceProvider'],
        sourceAlertId: (raw['sourceAlertId'] ?? '') as string,
        assignedAgents: raw['assignedAgents'],
        rootCause: raw['rootCause'],
        recommendedActions: raw['recommendedActions'],
        totalCostUsd: raw['totalCostUsd'],
        costBreakdown: raw['costBreakdown'],
        investigationDurationMs: raw['investigationDurationMs'],
        investigationMode: raw['investigationMode'],
        shadowInvestigationMode: raw['shadowInvestigationMode'],
        resolution: raw['resolution'],
        resolvedAt: raw['resolvedAt'],
        slackNotificationTs: raw['slackNotificationTs'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    } as Incident;
}
export class DynamoIncidentRepository {
    async create(incident: Incident): Promise<Incident> {
        const result = await IncidentEntity.create({
            tenantId: incident.tenantId,
            incidentId: incident.incidentId,
            title: incident.title,
            description: incident.description,
            severity: incident.severity,
            status: incident.status,
            sourceProvider: incident.sourceProvider,
            sourceAlertId: incident.sourceAlertId,
            assignedAgents: incident.assignedAgents,
            investigationMode: incident.investigationMode,
        }).go();
        return toDomain(result.data as unknown as Record<string, unknown>);
    }
    async findById(tenantId: TenantId, id: IncidentId): Promise<Incident | null> {
        const result = await IncidentEntity.get({ tenantId, incidentId: id }).go();
        if (!result.data)
            return null;
        return toDomain(result.data as unknown as Record<string, unknown>);
    }
    async findBySourceAlert(tenantId: TenantId, sourceProvider: string, sourceAlertId: string): Promise<Incident | null> {
        const result = await IncidentEntity.query.bySourceAlert({ tenantId, sourceProvider, sourceAlertId }).go();
        if (result.data.length === 0)
            return null;
        return toDomain(result.data[0] as unknown as Record<string, unknown>);
    }
    async update(tenantId: TenantId, id: IncidentId, data: Partial<Omit<Incident, 'incidentId' | 'tenantId' | 'createdAt'>>): Promise<Incident> {
        const result = await IncidentEntity.patch({ tenantId, incidentId: id })
            .set(data as Record<string, unknown>)
            .go({ response: 'all_new' });
        return toDomain(result.data as unknown as Record<string, unknown>);
    }
    async updateStatus(tenantId: TenantId, id: IncidentId, status: IncidentStatus, resolvedAt?: string): Promise<Incident> {
        const setData: Record<string, unknown> = { status };
        if (resolvedAt) {
            setData['resolvedAt'] = resolvedAt;
        }
        const result = await IncidentEntity.patch({ tenantId, incidentId: id })
            .set(setData)
            .go({ response: 'all_new' });
        return toDomain(result.data as unknown as Record<string, unknown>);
    }
    async listByTenant(tenantId: TenantId, options?: ListOptions) {
        const result = await IncidentEntity.query.primary({ tenantId }).go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
        });
        return {
            items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
            cursor: result.cursor ?? undefined,
        };
    }
    async findBySeverity(tenantId: TenantId, severity: Severity, options?: ListOptions) {
        const result = await IncidentEntity.query.bySeverityStatus({ tenantId, severity }).go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
        });
        return {
            items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
            cursor: result.cursor ?? undefined,
        };
    }
    async findByStatus(tenantId: TenantId, severity: Severity, status: IncidentStatus, options?: ListOptions) {
        const result = await IncidentEntity.query.bySeverityStatus({ tenantId, severity, status }).go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
        });
        return {
            items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
            cursor: result.cursor ?? undefined,
        };
    }
    async findAll(tenantId: TenantId): Promise<Incident[]> {
        const all: Incident[] = [];
        let cursor: string | null | undefined;
        do {
            const result = await IncidentEntity.query.primary({ tenantId }).go({
                limit: 100,
                ...(cursor && { cursor }),
            });
            all.push(...result.data.map((item: Record<string, unknown>) => toDomain(item as unknown as Record<string, unknown>)));
            cursor = result.cursor;
        } while (cursor);
        return all;
    }
    async listByCreatedAt(tenantId: TenantId, options?: ListOptions & { order?: 'asc' | 'desc' }) {
        const result = await IncidentEntity.query.byCreatedAt({ tenantId }).go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
            ...(options?.order && { order: options.order }),
        });
        return {
            items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
            cursor: result.cursor ?? undefined,
        };
    }
}
