import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requestLoggerMiddleware } from '@shared/infra/http/middleware/request-logger.middleware.js';

// vi.hoisted ensures these are initialized before vi.mock hoisting runs
const { mockLoggerInstance } = vi.hoisted(() => {
    const instance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(),
        bindings: vi.fn(() => ({})),
        isLevelEnabled: vi.fn(() => true),
    };
    // child() returns the same instance so getLogger() child calls land on the same spies
    instance.child.mockReturnValue(instance);
    return { mockLoggerInstance: instance };
});

vi.mock('@shared/infra/logger.js', () => ({
    rootLogger: mockLoggerInstance,
    logger: mockLoggerInstance,
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);
});

describe('requestLoggerMiddleware', () => {
    describe('log level selection by status', () => {
        it('calls logger.info for 200 responses', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/test', (c) => c.text('ok', 200));

            await app.request('/test', {
                method: 'GET',
                headers: { 'user-agent': 'vitest-agent' },
            });

            // info is called for both http.request.started and http.request.completed
            expect(mockLoggerInstance.info).toHaveBeenCalled();
            expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
            expect(mockLoggerInstance.error).not.toHaveBeenCalled();
        });

        it('calls logger.warn for 400 responses', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/test', (c) => c.text('bad request', 400));

            await app.request('/test');

            expect(mockLoggerInstance.warn).toHaveBeenCalled();
            expect(mockLoggerInstance.error).not.toHaveBeenCalled();
        });

        it('calls logger.warn for 404 responses', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/test', (c) => c.text('not found', 404));

            await app.request('/test');

            expect(mockLoggerInstance.warn).toHaveBeenCalled();
            expect(mockLoggerInstance.error).not.toHaveBeenCalled();
        });

        it('calls logger.error for 500 responses', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/test', (c) => c.text('internal error', 500));

            await app.request('/test');

            expect(mockLoggerInstance.error).toHaveBeenCalled();
            expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
        });
    });

    describe('http.request.started emitted', () => {
        it('emits http.request.started before http.request.completed', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/hello', (c) => c.text('ok', 200));

            await app.request('/hello');

            const calls = mockLoggerInstance.info.mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(2);
            const messages = calls.map((c: unknown[]) => c[1]);
            expect(messages).toContain('http.request.started');
            expect(messages.some((m: unknown) => typeof m === 'string' && m.includes('200'))).toBe(true);
        });
    });

    describe('log data shape for completed requests', () => {
        it('includes method, path, status, duration in completed log', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/hello', (c) => c.text('ok', 200));

            await app.request('/hello', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-browser/1.0',
                    'x-forwarded-for': '1.2.3.4, 5.6.7.8',
                },
            });

            // Find completed call — last info call
            const infoCalls = mockLoggerInstance.info.mock.calls;
            const completedCall = infoCalls[infoCalls.length - 1] as unknown[];
            const [logData, msg] = completedCall as [Record<string, unknown>, string];

            expect(logData).toMatchObject({
                method: 'GET',
                path: '/hello',
                status: 200,
            });
            expect(typeof logData['duration']).toBe('number');
            expect(msg).toMatch(/GET \/hello 200 \d+ms/);
        });
    });

    describe('user-agent truncation', () => {
        it('passes through user-agent strings <= 200 characters unchanged', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/ua', (c) => c.text('ok', 200));

            const shortUA = 'A'.repeat(200);
            await app.request('/ua', { headers: { 'user-agent': shortUA } });

            // userAgent is captured in LogContext and passed to child()
            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs['userAgent']).toBe(shortUA);
        });

        it('truncates user-agent strings longer than 200 characters', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/ua', (c) => c.text('ok', 200));

            const longUA = 'B'.repeat(300);
            await app.request('/ua', { headers: { 'user-agent': longUA } });

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect((childCallArgs['userAgent'] as string).length).toBe(200);
            expect(childCallArgs['userAgent']).toBe('B'.repeat(200));
        });
    });

    describe('clientIp redaction for sensitive paths', () => {
        it('omits clientIp from LogContext for /auth/login', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/auth/login', (c) => c.text('ok'));

            await app.request('/auth/login', {
                headers: { 'x-forwarded-for': '1.2.3.4' },
            });

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs).not.toHaveProperty('clientIp');
        });

        it('omits clientIp from LogContext for /webhooks/clerk', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/webhooks/clerk', (c) => c.text('ok'));

            await app.request('/webhooks/clerk', {
                headers: { 'x-forwarded-for': '9.8.7.6' },
            });

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs).not.toHaveProperty('clientIp');
        });

        it('includes clientIp in LogContext for non-sensitive path /healthz', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/healthz', (c) => c.text('ok'));

            await app.request('/healthz', {
                headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
            });

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs['clientIp']).toBe('1.2.3.4');
        });

        it('uses "unknown" for clientIp when x-forwarded-for header is absent (non-sensitive)', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/healthz', (c) => c.text('ok'));

            await app.request('/healthz');

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs['clientIp']).toBe('unknown');
        });
    });

    describe('LogContext fields', () => {
        it('includes requestId in LogContext', async () => {
            const app = new Hono();
            app.use('*', (c, next) => {
                c.set('requestId' as any, 'req-id-123');
                return next();
            });
            app.use('*', requestLoggerMiddleware);
            app.get('/rid', (c) => c.text('ok', 200));

            await app.request('/rid');

            const childCallArgs = mockLoggerInstance.child.mock.calls[0]![0] as Record<string, unknown>;
            expect(childCallArgs['requestId']).toBe('req-id-123');
        });

        it('gracefully handles missing optional context (no throw)', async () => {
            const app = new Hono();
            app.use('*', requestLoggerMiddleware);
            app.get('/anon', (c) => c.text('ok', 200));

            const res = await app.request('/anon');
            expect(res.status).toBe(200);
        });
    });
});
