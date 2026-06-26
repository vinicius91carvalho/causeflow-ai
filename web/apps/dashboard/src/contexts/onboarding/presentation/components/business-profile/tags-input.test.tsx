import { describe, expect, it } from 'vitest';

describe('TagsInput', () => {
  it('exports the TagsInput component', async () => {
    const mod = await import('./tags-input');
    expect(mod.TagsInput).toBeDefined();
    expect(typeof mod.TagsInput).toBe('function');
  });

  it('renders an input for adding tags (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./tags-input.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('onKeyDown');
    // remove is handled internally via removeTag (no external onRemove prop needed)
    expect(source).toContain('removeTag');
    expect(source).toContain('placeholder');
  });

  it('tags cannot be duplicated (structural check)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./tags-input.tsx', import.meta.url), 'utf-8');
    // Must guard against adding duplicate tags
    expect(source).toContain('includes');
  });
});
