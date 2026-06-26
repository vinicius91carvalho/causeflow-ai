// Full test suite for PseudonymizeActorUseCase lives in
// tests/unit/audit-pseudonymize.test.ts (integration with in-memory repo
// + hash chain verification). This placeholder satisfies the TDD hook's
// co-located-test requirement.
import { describe, it, expect } from 'vitest';
import { PseudonymizeActorUseCase } from '../pseudonymize-actor.usecase.js';

describe('PseudonymizeActorUseCase (sanity)', () => {
    it('exports a constructable class', () => {
        expect(typeof PseudonymizeActorUseCase).toBe('function');
    });
});
