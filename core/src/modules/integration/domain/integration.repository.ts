import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IntegrationRecord } from './integration.entity.js';

export interface IIntegrationRepository {
  upsert(record: IntegrationRecord): Promise<IntegrationRecord>;
  findByProvider(tenantId: TenantId, provider: string): Promise<IntegrationRecord | null>;
  listByTenant(tenantId: TenantId): Promise<IntegrationRecord[]>;
  updateHealthCheck(tenantId: TenantId, integrationId: string, checkedAt: string): Promise<void>;
}
