import type { ResourceConfig } from '../config/schema.js';
import type { DriverCommand } from '../drivers/driver.port.js';

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export class PolicyEngine {
  private resources: Map<string, ResourceConfig>;

  constructor(resources: ResourceConfig[]) {
    this.resources = new Map(resources.map((r) => [r.id, r]));
  }

  evaluate(resourceId: string, command: DriverCommand): PolicyDecision {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return { allowed: false, reason: `Unknown resource: ${resourceId}` };
    }

    if (!resource.allowedOperations.includes(command.operation as any)) {
      return { allowed: false, reason: `Operation ${command.operation} not allowed on resource ${resourceId}` };
    }

    if (command.operation === 'query') {
      const limit = (command.params['limit'] as number) ?? resource.maxRowsPerQuery;
      if (limit > resource.maxRowsPerQuery) {
        return { allowed: false, reason: `Row limit ${limit} exceeds maximum ${resource.maxRowsPerQuery}` };
      }
    }

    return { allowed: true };
  }

  getResource(resourceId: string): ResourceConfig | undefined {
    return this.resources.get(resourceId);
  }

  listResources(): ResourceConfig[] {
    return Array.from(this.resources.values());
  }
}
