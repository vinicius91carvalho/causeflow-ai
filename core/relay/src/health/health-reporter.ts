import type { IReadOnlyDriver } from '../drivers/driver.port.js';
import pino from 'pino';

const logger = pino({ name: 'relay-health' });

export interface HealthStatus {
  resourceId: string;
  type: string;
  healthy: boolean;
  latencyMs?: number;
}

export class HealthReporter {
  constructor(private drivers: Map<string, IReadOnlyDriver>) {}

  async checkAll(): Promise<HealthStatus[]> {
    const results = await Promise.all(
      Array.from(this.drivers.entries()).map(async ([resourceId, driver]) => {
        const start = Date.now();
        try {
          const healthy = await driver.healthCheck();
          return {
            resourceId,
            type: driver.type,
            healthy,
            latencyMs: Date.now() - start,
          } satisfies HealthStatus;
        } catch (err) {
          logger.warn({ err, resourceId }, 'Health check failed');
          return { resourceId, type: driver.type, healthy: false, latencyMs: Date.now() - start } satisfies HealthStatus;
        }
      }),
    );
    return results;
  }
}
