import { UsageRecordEntity } from '../../../shared/infra/db/entities/UsageRecordEntity.js';
import type {
  IUsageRecordRepository,
  ListUsageOptions,
} from '../domain/usage-record.repository.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
  return {
    tenantId: raw['tenantId'],
    recordId: raw['recordId'],
    type: raw['type'],
    incidentId: raw['incidentId'],
    costUsd: raw['costUsd'],
    agentBreakdown: raw['agentBreakdown'],
    createdAt: raw['createdAt'],
  };
}
export class DynamoUsageRecordRepository {
  async create(record: UsageRecord): Promise<UsageRecord> {
    const result = await UsageRecordEntity.create({
      tenantId: record.tenantId,
      recordId: record.recordId,
      type: record.type,
      incidentId: record.incidentId,
      costUsd: record.costUsd,
      ...(record.agentBreakdown && { agentBreakdown: record.agentBreakdown }),
    }).go();
    return toDomain(result.data);
  }
  async listByTenant(tenantId: TenantId, options?: ListUsageOptions) {
    if (options?.type) {
      const result = await UsageRecordEntity.query.byType({ tenantId, type: options.type }).go({
        limit: options?.limit ?? 50,
        ...(options?.cursor && { cursor: options.cursor }),
        order: 'desc',
      });
      return {
        items: result.data.map((item) => toDomain(item)),
        cursor: result.cursor ?? undefined,
      };
    }
    const result = await UsageRecordEntity.query.primary({ tenantId }).go({
      limit: options?.limit ?? 50,
      ...(options?.cursor && { cursor: options.cursor }),
      order: 'desc',
    });
    return {
      items: result.data.map((item) => toDomain(item)),
      cursor: result.cursor ?? undefined,
    };
  }
}
