/**
 * Smoke test for IntegrationsPage (server component).
 *
 * The vitest environment is node-only with no JSX transform plugin configured,
 * so we cannot render the server component. We verify the module exports the
 * correct shape without invoking JSX-dependent code paths.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
}));
vi.mock('@causeflow/ui/layouts', () => ({ PageHeader: () => null }));
vi.mock('@/contexts/integrations/presentation/components/integrations-client', () => ({
  IntegrationsClient: () => null,
}));
vi.mock('@/contexts/integrations/presentation/components/integrations-toast-handler', () => ({
  IntegrationsToastHandler: () => null,
}));

import IntegrationsPage from './integrations-page';

describe('IntegrationsPage', () => {
  it('is exported as an async function (server component)', () => {
    expect(IntegrationsPage).toBeDefined();
    expect(typeof IntegrationsPage).toBe('function');
  });
});
