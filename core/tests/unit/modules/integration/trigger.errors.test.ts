import { describe, it, expect } from 'vitest';
import { TriggerAlreadyExistsError } from '../../../../src/modules/integration/domain/trigger.errors.js';

describe('TriggerAlreadyExistsError', () => {
    it('is an instance of Error', () => {
        const err = new TriggerAlreadyExistsError('SENTRY_NEW_ISSUE', 'tenant-123');
        expect(err).toBeInstanceOf(Error);
    });

    it('has the correct name', () => {
        const err = new TriggerAlreadyExistsError('SENTRY_NEW_ISSUE', 'tenant-123');
        expect(err.name).toBe('TriggerAlreadyExistsError');
    });

    it('has the correct code', () => {
        const err = new TriggerAlreadyExistsError('SENTRY_NEW_ISSUE', 'tenant-123');
        expect(err.code).toBe('TRIGGER_ALREADY_EXISTS');
    });

    it('exposes triggerSlug and tenantId', () => {
        const err = new TriggerAlreadyExistsError('SENTRY_NEW_ISSUE', 'tenant-123');
        expect(err.triggerSlug).toBe('SENTRY_NEW_ISSUE');
        expect(err.tenantId).toBe('tenant-123');
    });

    it('generates an informative message', () => {
        const err = new TriggerAlreadyExistsError('SENTRY_NEW_ISSUE', 'tenant-123');
        expect(err.message).toContain('SENTRY_NEW_ISSUE');
        expect(err.message).toContain('already exists');
    });
});
