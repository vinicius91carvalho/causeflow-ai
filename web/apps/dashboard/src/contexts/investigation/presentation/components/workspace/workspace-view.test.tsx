import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'workspace-view.tsx'), 'utf-8');

describe('WorkspaceView — source guards', () => {
  it('left panel lateral bar has muted (light-gray) background', () => {
    expect(source).toMatch(/w-full md:w-\[280px\][^"]*bg-muted\/50/);
  });
});
