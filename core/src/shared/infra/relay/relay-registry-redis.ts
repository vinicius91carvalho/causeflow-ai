/**
 * Redis-backed coordinator for relay presence across multiple API instances.
 *
 * In single-instance deployments keep using the in-memory `RelayRegistry`.
 * When you scale the API horizontally, wrap it with this coordinator so
 * all pods share which tenant is connected and where.
 *
 * Each pod still owns the actual WebSocket handle for the relays connected
 * to it. What this layer provides is a shared directory of
 * `{tenantId -> {relayId -> podId}}` so routing and load-aware discovery
 * can locate the owning pod.
 */
import type { Redis } from 'ioredis';
import { logger } from '../logger.js';

const PRESENCE_TTL_SECONDS = 60;
const REFRESH_INTERVAL_MS = 20_000;

export interface RedisRegistryEntry {
    tenantId: string;
    relayId: string;
    podId: string;
    connectedAt: number;
}

export class RedisRelayCoordinator {
    private refreshTimer: ReturnType<typeof setInterval> | null = null;
    private owned = new Set<string>();

    constructor(
        private readonly redis: Redis,
        private readonly podId: string,
        private readonly keyPrefix = 'causeflow:relay',
    ) {}

    private presenceKey(tenantId: string, relayId: string): string {
        return `${this.keyPrefix}:presence:${tenantId}:${relayId}`;
    }

    private tenantSetKey(tenantId: string): string {
        return `${this.keyPrefix}:tenant:${tenantId}`;
    }

    async register(tenantId: string, relayId: string): Promise<void> {
        const key = this.presenceKey(tenantId, relayId);
        await this.redis
            .multi()
            .set(key, JSON.stringify({ podId: this.podId, connectedAt: Date.now() }), 'EX', PRESENCE_TTL_SECONDS)
            .sadd(this.tenantSetKey(tenantId), relayId)
            .exec();
        this.owned.add(`${tenantId}:${relayId}`);
        if (!this.refreshTimer) this.startRefreshLoop();
    }

    async unregister(tenantId: string, relayId: string): Promise<void> {
        await this.redis
            .multi()
            .del(this.presenceKey(tenantId, relayId))
            .srem(this.tenantSetKey(tenantId), relayId)
            .exec();
        this.owned.delete(`${tenantId}:${relayId}`);
    }

    async findOwner(tenantId: string): Promise<{ podId: string; relayId: string } | null> {
        const relays = await this.redis.smembers(this.tenantSetKey(tenantId));
        for (const relayId of relays) {
            const raw = await this.redis.get(this.presenceKey(tenantId, relayId));
            if (!raw) {
                await this.redis.srem(this.tenantSetKey(tenantId), relayId).catch(() => undefined);
                continue;
            }
            try {
                const parsed = JSON.parse(raw) as { podId: string };
                return { podId: parsed.podId, relayId };
            } catch {
                /* skip malformed */
            }
        }
        return null;
    }

    private startRefreshLoop(): void {
        this.refreshTimer = setInterval(() => {
            void this.refreshAll();
        }, REFRESH_INTERVAL_MS);
    }

    private async refreshAll(): Promise<void> {
        for (const key of this.owned) {
            const [tenantId, relayId] = key.split(':');
            if (!tenantId || !relayId) continue;
            await this.redis
                .set(
                    this.presenceKey(tenantId, relayId),
                    JSON.stringify({ podId: this.podId, connectedAt: Date.now() }),
                    'EX',
                    PRESENCE_TTL_SECONDS,
                )
                .catch((err) => logger.warn({ err, tenantId, relayId }, 'Presence refresh failed'));
        }
    }

    async shutdown(): Promise<void> {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        for (const key of this.owned) {
            const [tenantId, relayId] = key.split(':');
            if (tenantId && relayId) await this.unregister(tenantId, relayId);
        }
    }
}
