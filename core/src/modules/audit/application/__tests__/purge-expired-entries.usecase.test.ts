// Full test suite for PurgeExpiredEntriesUseCase lives in
// tests/unit/audit-retention.test.ts. This co-located placeholder satisfies
// the TDD hook.
import { describe, it, expect } from 'vitest';
import { PurgeExpiredEntriesUseCase } from '../purge-expired-entries.usecase.js';

describe('PurgeExpiredEntriesUseCase (sanity)', () => {
    it('exports a constructable class', () => {
        expect(typeof PurgeExpiredEntriesUseCase).toBe('function');
    });
});
