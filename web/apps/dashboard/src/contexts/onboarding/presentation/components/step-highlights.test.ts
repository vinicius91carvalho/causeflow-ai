import { describe, expect, it } from 'vitest';
import { STEP_HIGHLIGHT_CONFIGS } from './step-highlights';

describe('Step Highlights', () => {
  it('exports highlight configs', () => {
    expect(STEP_HIGHLIGHT_CONFIGS).toBeDefined();
  });

  it('has configs for navigable steps', () => {
    expect(STEP_HIGHLIGHT_CONFIGS.integrations).toBeDefined();
    expect(STEP_HIGHLIGHT_CONFIGS.relay).toBeDefined();
    expect(STEP_HIGHLIGHT_CONFIGS.firstIncident).toBeDefined();
    expect(STEP_HIGHLIGHT_CONFIGS.receiveEvents).toBeDefined();
    expect(STEP_HIGHLIGHT_CONFIGS.billing).toBeUndefined();
  });

  it('each config has element, title, description', () => {
    for (const config of Object.values(STEP_HIGHLIGHT_CONFIGS)) {
      expect(config.element).toBeDefined();
      expect(config.title).toBeDefined();
      expect(config.description).toBeDefined();
    }
  });

  it('element selectors target data-tour attributes', () => {
    for (const config of Object.values(STEP_HIGHLIGHT_CONFIGS)) {
      expect(config.element).toContain('data-tour');
    }
  });
});
