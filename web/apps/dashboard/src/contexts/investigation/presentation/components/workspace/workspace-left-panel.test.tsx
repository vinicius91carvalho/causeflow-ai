import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'workspace-left-panel.tsx'), 'utf-8');

describe('WorkspaceLeftPanel — source guards', () => {
  it('selected item uses lighter primary/5 background', () => {
    expect(source).toContain("'bg-primary/5 text-foreground'");
    expect(source).not.toContain("'bg-primary/10 text-foreground'");
  });
});
