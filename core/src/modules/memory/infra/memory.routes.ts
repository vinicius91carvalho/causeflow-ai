import { Hono } from 'hono';
import { z } from 'zod';
import { tenantId as toTenantId } from '../../../shared/domain/value-objects.js';
import { getRedisClient } from '../../../shared/infra/cache/redis-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { ChatUseCase } from '../application/chat.usecase.js';
import type { IChatHistoryRepository } from '../domain/chat-message.entity.js';

const SUMMARY_CACHE_TTL = 300; // 5 minutes

export interface MemoryUseCases {
    agentMemory: AgentMemory;
    runbookRegistry: IRunbookRegistryRepository;
    chat?: ChatUseCase;
    chatHistory?: IChatHistoryRepository;
}

const chatSchema = z.object({
    message: z.string().min(1).max(2000),
});
export function createMemoryRoutes(deps: MemoryUseCases) {
    const app = new Hono<AppEnv>();
    // ─── Chat: single unified endpoint ─────────────────────────────
    // The router agent classifies intent internally:
    //   - memory_only → Hindsight reflect (fast, free)
    //   - live_check  → agents query logs/metrics + memory (complete, uses credit)
    //   - general     → greeting/help response
    app.post('/chat', async (c) => {
        if (!deps.chat) {
            return c.json({ error: 'Chat not available' }, 503);
        }
        const body = await c.req.json();
        const { message } = chatSchema.parse(body);
        const tid = c.get('tenantId');
        const actorUserId = c.get('userId');
        const actorEmail = c.get('userEmail');
        const result = await deps.chat.execute({
            tenantId: toTenantId(tid),
            message,
            actorUserId,
            actorEmail,
        });
        return c.json(result);
    });
    // ─── Dashboard data endpoints ──────────────────────────────────
    // GET /insights — recall() with varied tags for Intelligence page
    app.get('/insights', async (c) => {
        const tid = c.get('tenantId');
        const [topologyMemories, investigationMemories, remediationMemories] = await Promise.all([
            deps.agentMemory.recall(tid, 'known services and dependencies', {
                maxResults: 10, tags: ['topology'], budget: 'low',
            }),
            deps.agentMemory.recall(tid, 'recent investigations and root causes', {
                maxResults: 10, tags: ['investigation'], budget: 'low',
            }),
            deps.agentMemory.recall(tid, 'remediation outcomes and effectiveness', {
                maxResults: 10, tags: ['remediation'], budget: 'low',
            }),
        ]);
        return c.json({
            topology: { services: topologyMemories.map((m) => ({ type: m.type, text: m.text })) },
            investigations: { recent: investigationMemories.map((m) => ({ type: m.type, text: m.text })) },
            remediations: { outcomes: remediationMemories.map((m) => ({ type: m.type, text: m.text })) },
        });
    });
    // GET /summary — reflect() for dashboard card (cached 5min per tenant)
    app.get('/summary', async (c) => {
        const tid = c.get('tenantId');
        const cacheKey = `memory:summary:${tid}`;
        const redis = getRedisClient();

        // Try cache first
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                return c.json({ ...data, cached: true });
            }
        } catch (err) {
            logger.warn({ err: err instanceof Error ? err.message : err }, 'Redis cache read failed — falling through to Hindsight');
        }

        const summary = await deps.agentMemory.reflect(tid, `Provide a brief status summary of this tenant's infrastructure. Include: ` +
            `number of incidents investigated, top recurring root causes, ` +
            `remediation success rate, and any concerning patterns. ` +
            `Keep it under 200 words. Format as plain text paragraphs.`, { budget: 'mid' });
        const result = { summary, generatedAt: new Date().toISOString() };

        // Cache result
        try {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', SUMMARY_CACHE_TTL);
        } catch (err) {
            logger.warn({ err: err instanceof Error ? err.message : err }, 'Redis cache write failed — non-critical');
        }

        return c.json(result);
    });
    // GET /topology — recall topology-tagged memories
    app.get('/topology', async (c) => {
        const tid = c.get('tenantId');
        const memories = await deps.agentMemory.recall(tid, 'all services, dependencies, and infrastructure topology', {
            maxResults: 20, tags: ['topology'], budget: 'mid',
        });
        return c.json({
            services: memories.map((m) => ({ type: m.type, text: m.text })),
            discoveredFrom: 'investigations',
        });
    });
    // ─── Chat History endpoints ─────────────────────────────────────
    app.get('/chat/history', async (c) => {
        if (!deps.chatHistory) {
            return c.json({ error: 'Chat history not available' }, 503);
        }
        const tid = c.get('tenantId');
        const limitParam = c.req.query('limit');
        const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20;
        const chats = await deps.chatHistory.listRecentChats(toTenantId(tid), limit);
        return c.json({ chats });
    });

    app.get('/chat/history/:chatId', async (c) => {
        if (!deps.chatHistory) {
            return c.json({ error: 'Chat history not available' }, 503);
        }
        const tid = c.get('tenantId');
        const chatId = c.req.param('chatId');
        const messages = await deps.chatHistory.getChat(toTenantId(tid), chatId);
        return c.json({ chatId, messages });
    });

    // GET /runbooks — list RunbookRegistry entries
    app.get('/runbooks', async (c) => {
        const tid = c.get('tenantId');
        const entries = await deps.runbookRegistry.listByTenant(toTenantId(tid));
        return c.json({
            runbooks: entries.map((e) => ({
                rootCauseHash: e.rootCauseHash,
                rootCauseSummary: e.rootCauseSummary,
                occurrences: e.occurrences,
                confirmations: e.confirmations,
                lastSeen: e.lastSeen,
                automated: e.automated,
                fixAction: e.fixAction,
            })),
        });
    });
    return app;
}
