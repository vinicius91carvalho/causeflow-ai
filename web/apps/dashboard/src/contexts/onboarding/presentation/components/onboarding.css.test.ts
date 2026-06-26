import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('onboarding.css', () => {
  const css = readFileSync(resolve(__dirname, './onboarding.css'), 'utf-8');

  it('contains modal wizard styles', () => {
    expect(css).toContain('.onboarding-modal');
    expect(css).toContain('.onboarding-modal__nav');
    expect(css).toContain('.onboarding-modal__dots');
  });

  it('does not contain removed checklist/step-card styles', () => {
    expect(css).not.toContain('.onboarding-checklist');
    expect(css).not.toContain('.onboarding-step-card');
  });

  it('uses CSS variables for theme compatibility', () => {
    expect(css).toContain('var(--primary)');
    expect(css).toContain('var(--card)');
  });

  it('includes mobile responsive styles', () => {
    expect(css).toContain('@media');
  });

  it('includes reduced motion media query', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});
