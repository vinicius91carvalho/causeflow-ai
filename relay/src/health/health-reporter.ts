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
  private drivers: Map<string, IReadOnlyDriver>;

  constructor(drivers: Map<string, IReadOnlyDriver>) {
    this.drivers = drivers;
  }

  async checkAll(): Promise<HealthStatus[]> {
    const results: HealthStatus[] = [];

    for (const [resourceId, driver] of this.drivers) {
      const start = Date.now();
      try {
        const healthy = await driver.healthCheck();
        results.push({
          resourceId,
          type: driver.type,
          healthy,
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        logger.warn({ err, resourceId }, 'Health check failed');
        results.push({
          resourceId,
          type: driver.type,
          healthy: false,
          latencyMs: Date.now() - start,
        });
      }
    }

    return results;
  }
}
