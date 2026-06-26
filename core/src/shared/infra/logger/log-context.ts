import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from 'pino';
import { rootLogger } from '../logger.js';

export interface LogContext {
    requestId: string;
    traceId?: string;
    spanId?: string;
    tenantId?: string;
    actorUserId?: string;
    clientIp?: string;
    userAgent?: string;
    jobId?: string;
    jobType?: string;
    queueName?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
    return storage.run(ctx, fn);
}

export function getLogContext(): LogContext | undefined {
    return storage.getStore();
}

export function getLogger(): Logger {
    const ctx = storage.getStore();
    return ctx ? rootLogger.child(ctx) : rootLogger;
}
