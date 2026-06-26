import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'api-keys-tab.tsx'), 'utf-8');

describe('ApiKeysTab — primary CTA pattern', () => {
  it('Create API Key button uses standard primary CTA pattern (no focus-ring override)', () => {
    expect(source).toContain(
      'inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors',
    );
  });
});
