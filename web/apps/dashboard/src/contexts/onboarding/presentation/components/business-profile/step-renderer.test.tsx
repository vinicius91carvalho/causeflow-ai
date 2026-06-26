import { describe, expect, it } from 'vitest';

describe('StepRenderer', () => {
  it('exports StepRenderer component', async () => {
    const mod = await import('./step-renderer');
    expect(mod.StepRenderer).toBeDefined();
    expect(typeof mod.StepRenderer).toBe('function');
  });

  it('renders step title and description (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./step-renderer.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('step.title');
    expect(source).toContain('step.description');
  });

  it('iterates over fields (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./step-renderer.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('step.fields');
    expect(source).toContain('FieldRenderer');
  });
});
