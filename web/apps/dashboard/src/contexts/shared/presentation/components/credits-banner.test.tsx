import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'credits-banner.tsx'), 'utf-8');

describe('CreditsBanner — brand-color source guards', () => {
  it('nominal-state icon uses brand-green tokens', () => {
    expect(source).toContain("'bg-brand-green/10 text-brand-green'");
    expect(source).not.toContain("'bg-primary/10 text-primary'");
  });

  it('nominal-state progress bar uses bg-brand-green', () => {
    expect(source).toMatch(
      /isCritical \? 'bg-destructive\/50' : isWarning \? 'bg-warning\/50' : 'bg-brand-green'/,
    );
  });

  it('nominal-state upgrade link uses brand-purple (violet)', () => {
    expect(source).toContain("'bg-brand-purple text-white hover:bg-brand-purple/90'");
  });
});
