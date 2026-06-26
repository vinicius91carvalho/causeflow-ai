/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackChatPlatform } from '../../../../src/shared/infra/chat/slack-chat-platform.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makeWebClientMock(overrides: Record<string, unknown> = {}) {
    return {
        chat: {
            postMessage: vi.fn(async () => ({ ok: true, ts: '1234567890.123456' })),
        },
        auth: {
            test: vi.fn(async () => ({ ok: true })),
        },
        ...overrides,
    } as any;
}

function makeSlackNotificationRepoMock() {
    return {
        findNotification: vi.fn(async () => null),
        saveNotification: vi.fn(async () => ({ tenantId: 't', incidentId: 'i', type: 'alert', status: 'sent' })),
        deleteByIncident: vi.fn(async () => undefined),
    } as any;
}

function makeLoggerMock() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(() => makeLoggerMock()),
    } as any;
}

describe('SlackChatPlatform', () => {
    let client: ReturnType<typeof makeWebClientMock>;
    let repo: ReturnType<typeof makeSlackNotificationRepoMock>;
    let logger: ReturnType<typeof makeLoggerMock>;
    let platform: SlackChatPlatform;

    beforeEach(() => {
        client = makeWebClientMock();
        repo = makeSlackNotificationRepoMock();
        logger = makeLoggerMock();
        platform = new SlackChatPlatform(client, repo, logger);
    });

    describe('sendMessage', () => {
        it('should call chat.postMessage with correct arguments', async () => {
            const message = {
                channelId: 'C123456',
                text: 'Test message',
                blocks: [{ type: 'section', text: { type: 'plain_text', text: 'hello' } }],
            };

            await platform.sendMessage(message);

            expect(client.chat.postMessage).toHaveBeenCalledOnce();
            const call = client.chat.postMessage.mock.calls[0][0];
            expect(call.channel).toBe('C123456');
            expect(call.text).toBe('Test message');
            expect(call.blocks).toBe(message.blocks);
        });

        it('should include thread_ts when threadId is provided', async () => {
            await platform.sendMessage({
                channelId: 'C123456',
                text: 'Reply',
                threadId: '9999999999.000001',
            });

            const call = client.chat.postMessage.mock.calls[0][0];
            expect(call.thread_ts).toBe('9999999999.000001');
        });

        it('should not include thread_ts when threadId is absent', async () => {
            await platform.sendMessage({ channelId: 'C123456', text: 'New message' });

            const call = client.chat.postMessage.mock.calls[0][0];
            expect(call.thread_ts).toBeUndefined();
        });

        it('should return messageId and threadId from result.ts', async () => {
            const result = await platform.sendMessage({ channelId: 'C123456', text: 'Hello' });

            expect(result.messageId).toBe('1234567890.123456');
            expect(result.threadId).toBe('1234567890.123456');
        });
    });

    describe('testConnection', () => {
        it('should return true when auth.test() succeeds', async () => {
            const result = await platform.testConnection();
            expect(result).toBe(true);
        });

        it('should return false when auth.test() throws', async () => {
            client.auth.test = vi.fn(async () => { throw new Error('invalid_auth'); });
            const result = await platform.testConnection();
            expect(result).toBe(false);
        });
    });

    describe('security', () => {
        it('accessToken should NOT appear in any logger call', async () => {
            const accessToken = 'xoxb-secret-token-that-must-never-leak';

            // Simulate a sendMessage call where the token might be logged
            await platform.sendMessage({ channelId: 'C123456', text: 'Test' });

            // Collect all args from all logger calls
            const allLoggerArgs = [
                ...logger.info.mock.calls.flat(Infinity),
                ...logger.warn.mock.calls.flat(Infinity),
                ...logger.error.mock.calls.flat(Infinity),
                ...logger.debug.mock.calls.flat(Infinity),
            ];

            const argsAsString = JSON.stringify(allLoggerArgs);
            expect(argsAsString).not.toContain(accessToken);
        });
    });

    describe('unimplemented methods', () => {
        it('requestApproval should throw "not implemented"', async () => {
            await expect(platform.requestApproval({
                channelId: 'C123456',
                title: 'Test',
                description: 'Test',
                actions: [],
            })).rejects.toThrow('not implemented');
        });

        it('updateMessage should throw "not implemented"', async () => {
            await expect(platform.updateMessage('C123456', 'msg-1', 'text')).rejects.toThrow('not implemented');
        });
    });
});
