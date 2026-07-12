import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import { config } from '../../../shared/config/index.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';

export interface IntegrationSummary {
  provider: string;
  source: 'credential';
  status: string;
  displayName: string;
  connectedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export class ListAllIntegrationsUseCase {
  constructor(private readonly ossIntegrationRepo?: IIntegrationRepository) {}

  async execute(tenantId: TenantId): Promise<IntegrationSummary[]> {
    if (config.isOss() && this.ossIntegrationRepo) {
      const records = await this.ossIntegrationRepo.listByTenant(tenantId);
      return records.map((item) => ({
        provider: item.provider,
        source: 'credential' as const,
        status: item.status,
        displayName: item.displayName,
        connectedBy: item.connectedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    }

    const results: IntegrationSummary[] = [];
    const credentialIntegrations = await IntegrationEntity.query.primary({ tenantId }).go();
    for (const item of credentialIntegrations.data) {
      results.push({
        provider: item.provider,
        source: 'credential',
        status: item.status,
        displayName: item.displayName,
        connectedBy: item.connectedBy ?? undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
    return results;
  }
}
