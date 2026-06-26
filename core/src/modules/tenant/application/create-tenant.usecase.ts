import { v4 as uuidv4 } from 'uuid';
import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant, TenantSettings } from '../domain/tenant.entity.js';
import { DEFAULT_TENANT_SETTINGS } from '../domain/tenant.entity.js';
import { TenantSlugConflictError } from '../domain/tenant.errors.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan } from '../../../shared/domain/types.js';
import type { IEventBus } from '../../../shared/domain/events.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
  ownerEmail: string;
  plan?: TenantPlan;
  settings?: Partial<TenantSettings>;
  actorUserId?: string;
  actorEmail?: string;
}

export class CreateTenantUseCase {
  constructor(
    private readonly repo: ITenantRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: CreateTenantInput, externalTenantId?: string): Promise<Tenant> {
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new TenantSlugConflictError(input.slug);
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      tenantId: tenantId(externalTenantId ?? uuidv4()),
      name: input.name,
      slug: input.slug,
      ownerEmail: input.ownerEmail,
      plan: input.plan ?? 'starter',
      status: 'active',
      settings: { ...DEFAULT_TENANT_SETTINGS, ...input.settings },
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.repo.create(tenant);

    await this.eventBus.publish({
      eventType: 'tenant.created',
      occurredAt: now,
      tenantId: created.tenantId,
      payload: { tenantId: created.tenantId, slug: created.slug, plan: created.plan, actorUserId: input.actorUserId, actorEmail: input.actorEmail },
    });

    return created;
  }
}
