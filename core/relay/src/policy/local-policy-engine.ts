import type { IPolicyEvaluator, PolicyDecision, PolicyInput } from './policy.port.js';
import type { ResourceConfig } from '../config/schema.js';

export class LocalPolicyEngine implements IPolicyEvaluator {
  private resources: Map<string, ResourceConfig>;

  constructor(resources: ResourceConfig[]) {
    this.resources = new Map(resources.map((r) => [r.id, r]));
  }

  async evaluate(input: PolicyInput): Promise<PolicyDecision> {
    const resource = this.resources.get(input.resourceId);
    if (!resource) return { allowed: false, reason: `Unknown resource: ${input.resourceId}` };

    if (resource.allowedOperations.length > 0 && !resource.allowedOperations.includes(input.command.operation)) {
      return { allowed: false, reason: `Operation ${input.command.operation} not allowed` };
    }

    const tableName = this.extractTable(input);
    if (tableName) {
      if (resource.blockedTables?.includes(tableName)) {
        return { allowed: false, reason: `Table ${tableName} is blocked` };
      }
      if (resource.allowedTables && resource.allowedTables.length > 0 && !resource.allowedTables.includes(tableName)) {
        return { allowed: false, reason: `Table ${tableName} is not in the allowlist` };
      }
    }

    let requiresApproval = false;
    if (tableName && resource.approvalThresholds.sensitiveTables.includes(tableName)) {
      requiresApproval = true;
    }

    const rowLimitRaw = input.command.params['limit'];
    const rowLimit = typeof rowLimitRaw === 'number' ? rowLimitRaw : Number(rowLimitRaw ?? resource.maxRowsPerQuery);
    const clampRowLimit = Number.isFinite(rowLimit) && rowLimit > resource.maxRowsPerQuery
      ? resource.maxRowsPerQuery
      : undefined;
    if (resource.approvalThresholds.rowCount !== undefined && rowLimit > resource.approvalThresholds.rowCount) {
      requiresApproval = true;
    }

    return { allowed: true, requiresApproval, clampRowLimit };
  }

  getResource(resourceId: string): ResourceConfig | undefined {
    return this.resources.get(resourceId);
  }

  listResources(): ResourceConfig[] {
    return Array.from(this.resources.values());
  }

  private extractTable(input: PolicyInput): string | undefined {
    const params = input.command.params;
    const t = params['tableName'] ?? params['table'] ?? params['collection'];
    return typeof t === 'string' ? t : undefined;
  }
}
