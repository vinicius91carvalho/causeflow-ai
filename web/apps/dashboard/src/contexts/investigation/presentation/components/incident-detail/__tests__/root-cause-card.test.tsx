import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'root-cause-card.tsx'), 'utf-8');

describe('RootCauseCard — source guards', () => {
  it('badge always uses success (green) classes when root cause exists', () => {
    expect(source).toContain("'border-success/60 bg-success/10 text-success'");
    expect(source).not.toMatch(/isResolved\s*\?\s*'border-success/);
  });

  it('has no dead RESOLVED_STATUSES branch gating the badge color', () => {
    const badgeBlockMatch = source.match(/badgeClasses\s*=\s*([^;]+);/);
    expect(badgeBlockMatch).not.toBeNull();
    expect(badgeBlockMatch?.[1]).not.toContain('isResolved');
  });
});
