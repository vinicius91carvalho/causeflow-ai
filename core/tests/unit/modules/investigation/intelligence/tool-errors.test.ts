import { describe, it, expect, vi } from 'vitest';
import { type ZodError, z } from 'zod';
import {
    classifyError,
    formatZodError,
    formatToolError,
    enrichErrorWithMemory,
} from '../../../../../src/modules/investigation/application/intelligence/tool-errors.js';

describe('classifyError', () => {
    it('classifies ZodError as validation', () => {
        const schema = z.object({ name: z.string() });
        try { schema.parse({ name: 123 }); } catch (err) {
            expect(classifyError(err)).toBe('validation');
        }
    });

    it('classifies 401 as auth', () => {
        const err = Object.assign(new Error('Unauthorized'), { status: 401 });
        expect(classifyError(err)).toBe('auth');
    });

    it('classifies 429 as rate_limit', () => {
        const err = Object.assign(new Error('Too many requests'), { status: 429 });
        expect(classifyError(err)).toBe('rate_limit');
    });

    it('classifies 404 as not_found', () => {
        const err = Object.assign(new Error('Not found'), { status: 404 });
        expect(classifyError(err)).toBe('not_found');
    });

    it('classifies timeout messages', () => {
        expect(classifyError(new Error('Request timed out'))).toBe('timeout');
        expect(classifyError(new Error('ETIMEDOUT'))).toBe('timeout');
    });

    it('classifies 500 as service_error', () => {
        const err = Object.assign(new Error('Internal'), { status: 500 });
        expect(classifyError(err)).toBe('service_error');
    });

    it('returns unknown for unrecognized errors', () => {
        expect(classifyError(new Error('something weird'))).toBe('unknown');
        expect(classifyError('string error')).toBe('unknown');
    });
});

describe('formatZodError', () => {
    it('formats invalid_type errors', () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        try { schema.parse({ name: 123, age: 'old' }); } catch (err) {
            const formatted = formatZodError(err as ZodError);
            expect(formatted).toContain('Input validation failed');
            expect(formatted).toContain('`name`');
            expect(formatted).toContain('expected');
        }
    });
});

describe('formatToolError', () => {
    it('formats generic errors with category and recovery hint', () => {
        const err = Object.assign(new Error('Service is down'), { status: 503 });
        const formatted = formatToolError('query_logs', err);
        expect(formatted).toContain('query_logs');
        expect(formatted).toContain('service_error');
        expect(formatted).toContain('Recovery hint');
    });

    it('truncates very long errors', () => {
        const longMsg = 'x'.repeat(20_000);
        const formatted = formatToolError('test', new Error(longMsg));
        expect(formatted.length).toBeLessThan(20_000);
        expect(formatted).toContain('truncated');
    });

    it('formats ZodErrors specially', () => {
        const schema = z.object({ service: z.string() });
        try { schema.parse({}); } catch (err) {
            const formatted = formatToolError('query_logs', err);
            expect(formatted).toContain('Input validation failed');
            expect(formatted).toContain('`service`');
        }
    });
});

describe('enrichErrorWithMemory', () => {
    it('returns base error when no memory available', async () => {
        const err = new Error('Connection refused');
        const result = await enrichErrorWithMemory('query_logs', err, undefined, 'tenant-1');
        expect(result).toContain('query_logs');
        expect(result).toContain('Connection refused');
    });

    it('appends past resolution when memory has matching entries', async () => {
        const mockMemory = {
            retain: vi.fn(),
            recall: vi.fn().mockResolvedValue([
                { text: 'Last time this happened, restarting the service fixed it', type: 'world' as const },
            ]),
            reflect: vi.fn(),
            configureBank: vi.fn(),
        };
        const err = new Error('Connection refused');
        const result = await enrichErrorWithMemory('query_logs', err, mockMemory, 'tenant-1');
        expect(result).toContain('Past resolution');
        expect(result).toContain('restarting the service');
    });

    it('handles memory recall failure gracefully', async () => {
        const mockMemory = {
            retain: vi.fn(),
            recall: vi.fn().mockRejectedValue(new Error('Hindsight down')),
            reflect: vi.fn(),
            configureBank: vi.fn(),
        };
        const err = new Error('Something broke');
        const result = await enrichErrorWithMemory('test_tool', err, mockMemory, 'tenant-1');
        expect(result).toContain('test_tool');
        expect(result).not.toContain('Past resolution');
    });
});
