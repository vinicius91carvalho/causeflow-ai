import { describe, expect, it } from 'vitest';
import { dashboardMessagesEn, dashboardMessagesPtBr } from './compose';

describe('i18n Compose', () => {
  it('includes onboarding namespace in English messages', () => {
    const messages = dashboardMessagesEn as Record<string, unknown>;
    const dashboard = messages.dashboard as Record<string, unknown>;
    expect(dashboard.onboarding).toBeDefined();
  });

  it('includes onboarding namespace in Portuguese messages', () => {
    const messages = dashboardMessagesPtBr as Record<string, unknown>;
    const dashboard = messages.dashboard as Record<string, unknown>;
    expect(dashboard.onboarding).toBeDefined();
  });
});
