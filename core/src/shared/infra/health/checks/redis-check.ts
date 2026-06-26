import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
export class RedisHealthCheck {
    getClient;
    name = 'redis';
    constructor(getClient: () => any) {
        this.getClient = getClient;
    }
    async check(): Promise<HealthCheckResult> {
        const start = Date.now();
        try {
            const client = this.getClient();
            if (!client) {
                return { name: this.name, status: 'ok', latencyMs: 0, details: { message: 'Not configured' } };
            }
            await client.ping();
            return {
                name: this.name,
                status: 'ok',
                latencyMs: Date.now() - start,
            };
        }
        catch (err) {
            return {
                name: this.name,
                status: 'degraded',
                latencyMs: Date.now() - start,
                details: { error: err instanceof Error ? err.message : 'Unknown' },
            };
        }
    }
}
