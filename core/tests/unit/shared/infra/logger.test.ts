import { describe, expect, it } from 'vitest';
import { logger, rootLogger } from '@shared/infra/logger.js';

describe('logger', () => {
    it('exports rootLogger as a pino instance', () => {
        expect(rootLogger).toBeDefined();
        expect(typeof rootLogger.info).toBe('function');
        expect(typeof rootLogger.error).toBe('function');
    });

    it('exports logger as an alias for rootLogger (backwards-compat)', () => {
        expect(logger).toBe(rootLogger);
    });

    it('rootLogger.child() returns a child logger with provided bindings', () => {
        const child = rootLogger.child({ requestId: 'test-123' });
        expect(child.bindings()['requestId']).toBe('test-123');
    });
});
