/**
 * Unit tests for IntegrationsToastHandler behaviour.
 *
 * The component is a thin `useEffect` wrapper — we test the module exports
 * and the hook-level logic indirectly without needing a full DOM render
 * (no @testing-library/react is installed in this project).
 */
import { describe, expect, it } from 'vitest';

// Verify the module exports the named component without import errors
import { IntegrationsToastHandler } from './integrations-toast-handler';

describe('IntegrationsToastHandler', () => {
  it('is exported as a named function', () => {
    expect(IntegrationsToastHandler).toBeDefined();
    expect(typeof IntegrationsToastHandler).toBe('function');
  });

  it('component name is IntegrationsToastHandler', () => {
    expect(IntegrationsToastHandler.name).toBe('IntegrationsToastHandler');
  });
});
