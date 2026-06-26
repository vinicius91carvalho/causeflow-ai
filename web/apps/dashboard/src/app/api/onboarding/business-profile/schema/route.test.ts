/**
 * Structural test: confirms the schema route re-export wires are correct.
 * The full handler logic is tested in business-profile-schema-handler.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/onboarding/business-profile/schema', () => {
  it('exports a GET handler function', () => {
    expect(typeof GET).toBe('function');
  });
});
