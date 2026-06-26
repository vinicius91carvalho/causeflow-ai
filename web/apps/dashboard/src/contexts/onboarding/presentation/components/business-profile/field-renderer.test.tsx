import { describe, expect, it } from 'vitest';

describe('FieldRenderer', () => {
  it('exports FieldRenderer component', async () => {
    const mod = await import('./field-renderer');
    expect(mod.FieldRenderer).toBeDefined();
    expect(typeof mod.FieldRenderer).toBe('function');
  });

  it('handles all field types (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./field-renderer.tsx', import.meta.url), 'utf-8');
    // All field types must be handled
    expect(source).toContain("'text'");
    expect(source).toContain("'textarea'");
    expect(source).toContain("'select'");
    expect(source).toContain("'multiselect'");
    expect(source).toContain("'radio'");
    expect(source).toContain("'checkbox-group'");
    expect(source).toContain("'tags'");
  });

  it('renders help text when present (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./field-renderer.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('field.help');
  });

  it('uses visibleWhen to conditionally render (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./field-renderer.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('visibleWhen');
  });
});
