import { tenantId } from '../../../shared/domain/value-objects.js';
import { TenantEntity } from '../../../shared/infra/db/entities/TenantEntity.js';
import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

function toDomain(raw: Record<string, any>): Tenant {
    return {
        tenantId: tenantId(raw['tenantId']),
        name: raw['name'],
        slug: raw['slug'],
        ownerEmail: raw['ownerEmail'],
        plan: raw['plan'],
        status: raw['status'],
        settings: raw['settings'] ?? {
            maxIncidentsPerMonth: 50,
            autoRemediation: false,
            notificationChannels: [],
        },
        renewDate: raw['renewDate'],
        stripeCustomerId: raw['stripeCustomerId'],
        stripeSubscriptionId: raw['stripeSubscriptionId'],
        subscriptionStatus: raw['subscriptionStatus'],
        currentPeriodEnd: raw['currentPeriodEnd'],
        cancelAtPeriodEnd: raw['cancelAtPeriodEnd'] ?? false,
        websiteUrl: raw['websiteUrl'],
        teamSize: raw['teamSize'],
        customDomain: raw['customDomain'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoTenantRepository implements ITenantRepository {
    async create(tenant: Tenant): Promise<Tenant> {
        const result = await TenantEntity.create({
            tenantId: tenant.tenantId,
            name: tenant.name,
            slug: tenant.slug,
            ownerEmail: tenant.ownerEmail,
            plan: tenant.plan,
            status: tenant.status,
            settings: tenant.settings,
            renewDate: tenant.renewDate,
            websiteUrl: tenant.websiteUrl,
            teamSize: tenant.teamSize,
        }).go();
        return toDomain(result.data);
    }
    async findById(id: TenantId): Promise<Tenant | null> {
        const result = await TenantEntity.get({ tenantId: id }).go();
        if (!result.data)
            return null;
        return toDomain(result.data);
    }
    async findBySlug(slug: string): Promise<Tenant | null> {
        const result = await TenantEntity.query.bySlug({ slug }).go();
        const first = result.data[0];
        if (!first)
            return null;
        return toDomain(first);
    }
    async findByCustomDomain(domain: string): Promise<Tenant | null> {
        const result = await TenantEntity.query.byCustomDomain({ customDomain: domain }).go();
        const first = result.data[0];
        if (!first) return null;
        return toDomain(first);
    }
    async update(id: TenantId, data: Partial<Omit<Tenant, 'tenantId' | 'createdAt'>>): Promise<Tenant> {
        const result = await TenantEntity.patch({ tenantId: id })
            .set(data)
            .go({ response: 'all_new' });
        return toDomain(result.data);
    }
    async listByOwner(ownerEmail: string, options?: { limit?: number; cursor?: string }) {
        const result = await TenantEntity.query.byOwner({ ownerEmail }).go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
        });
        return {
            items: result.data.map((item) => toDomain(item)),
            cursor: result.cursor ?? undefined,
        };
    }
}
