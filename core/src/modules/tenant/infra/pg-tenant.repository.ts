/**
 * Postgres Tenant repository implementation for the OSS runtime (AC-040).
 */
import type { ITenantRepository, ListOptions } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import {
  pgGet,
  pgInsert,
  pgUpdate,
  pgQueryJson,
} from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'tenants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): Tenant {
  return {
    tenantId: row.tenant_id as unknown as TenantId,
    name: row.data['name'] as string,
    slug: row.data['slug'] as string,
    ownerEmail: row.data['ownerEmail'] as string,
    plan: row.data['plan'] as Tenant['plan'],
    status: row.data['status'] as Tenant['status'],
    settings: row.data['settings'] as Tenant['settings'],
    stripeCustomerId: row.data['stripeCustomerId'] as string | undefined,
    stripeSubscriptionId: row.data['stripeSubscriptionId'] as string | undefined,
    subscriptionStatus: row.data['subscriptionStatus'] as Tenant['subscriptionStatus'],
    currentPeriodEnd: row.data['currentPeriodEnd'] as string | undefined,
    cancelAtPeriodEnd: row.data['cancelAtPeriodEnd'] as boolean | undefined,
    websiteUrl: row.data['websiteUrl'] as string | undefined,
    teamSize: row.data['teamSize'] as Tenant['teamSize'],
    customDomain: row.data['customDomain'] as string | undefined,
    renewDate: row.data['renewDate'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgTenantRepository implements ITenantRepository {
  async create(tenant: Tenant): Promise<Tenant> {
    const data: Record<string, unknown> = {
      name: tenant.name,
      slug: tenant.slug,
      ownerEmail: tenant.ownerEmail,
      plan: tenant.plan,
      status: tenant.status,
      settings: tenant.settings,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
      subscriptionStatus: tenant.subscriptionStatus,
      currentPeriodEnd: tenant.currentPeriodEnd,
      cancelAtPeriodEnd: tenant.cancelAtPeriodEnd,
      websiteUrl: tenant.websiteUrl,
      teamSize: tenant.teamSize,
      customDomain: tenant.customDomain,
      renewDate: tenant.renewDate,
    };
    const row = await pgInsert(TABLE, String(tenant.tenantId), 'tenant', data);
    return toDomain(row!);
  }

  async findById(tenantId: TenantId): Promise<Tenant | null> {
    const row = await pgGet(TABLE, String(tenantId), 'tenant');
    if (!row) return null;
    return toDomain(row!);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const rows = await pgQueryJson(TABLE, "data->>'slug' = $1", [slug], { limit: 1 });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async findByCustomDomain(domain: string): Promise<Tenant | null> {
    const rows = await pgQueryJson(TABLE, "data->>'customDomain' = $1", [domain], { limit: 1 });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async update(
    tenantId: TenantId,
    data: Partial<Omit<Tenant, 'tenantId' | 'createdAt'>>,
  ): Promise<Tenant> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.slug !== undefined) updateData['slug'] = data.slug;
    if (data.ownerEmail !== undefined) updateData['ownerEmail'] = data.ownerEmail;
    if (data.plan !== undefined) updateData['plan'] = data.plan;
    if (data.status !== undefined) updateData['status'] = data.status;
    if (data.settings !== undefined) updateData['settings'] = data.settings;
    if (data.stripeCustomerId !== undefined) updateData['stripeCustomerId'] = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined)
      updateData['stripeSubscriptionId'] = data.stripeSubscriptionId;
    const row = await pgUpdate(TABLE, String(tenantId), 'tenant', updateData);
    return toDomain(row!);
  }

  async listByOwner(
    ownerEmail: string,
    options?: ListOptions,
  ): Promise<{ items: Tenant[]; cursor?: string }> {
    const rows = await pgQueryJson(TABLE, "data->>'ownerEmail' = $1", [ownerEmail], {
      limit: options?.limit ?? 20,
    });
    return { items: rows.map(toDomain) };
  }
}
