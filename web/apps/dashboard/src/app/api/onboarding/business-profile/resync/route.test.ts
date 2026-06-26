/**
 * Structural test: confirms the resync route re-export wires are correct.
 * The full handler logic is tested in business-profile-resync-handler.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/onboarding/business-profile/resync', () => {
  it('exports a POST handler function', () => {
    expect(typeof POST).toBe('function');
  });
});
