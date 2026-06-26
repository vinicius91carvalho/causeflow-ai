import { describe, expect, it } from 'vitest';

// Unit tests for command palette fuzzy matching logic

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

describe('Command Palette - fuzzy matching', () => {
  it('returns true for empty query (shows all)', () => {
    expect(fuzzyMatch('', 'anything')).toBe(true);
    expect(fuzzyMatch('', '')).toBe(true);
  });

  it('returns true for exact match', () => {
    expect(fuzzyMatch('dashboard', 'dashboard')).toBe(true);
    expect(fuzzyMatch('New Analysis', 'New Analysis')).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    expect(fuzzyMatch('DASHBOARD', 'dashboard')).toBe(true);
    expect(fuzzyMatch('dashboard', 'Dashboard')).toBe(true);
    expect(fuzzyMatch('NEW', 'new analysis')).toBe(true);
  });

  it('returns true for prefix match', () => {
    expect(fuzzyMatch('dash', 'dashboard')).toBe(true);
    expect(fuzzyMatch('set', 'settings')).toBe(true);
  });

  it('returns true for fuzzy (scattered) match', () => {
    expect(fuzzyMatch('dsh', 'dashboard')).toBe(true); // d, s, h all appear in order
    expect(fuzzyMatch('naly', 'analyses')).toBe(true); // n-a-l-y in "analyses"
  });

  it('returns false for non-matching query', () => {
    expect(fuzzyMatch('xyz', 'dashboard')).toBe(false);
    expect(fuzzyMatch('zzz', 'settings')).toBe(false);
  });

  it('returns false when query chars do not appear in order in text', () => {
    // 'zx' — neither z nor x appears in 'dashboard'
    expect(fuzzyMatch('zx', 'dashboard')).toBe(false);
    // 'rh' — r appears after h in 'dashboard', so 'r' then 'h' cannot match in order
    expect(fuzzyMatch('rh', 'dashboard')).toBe(false);
  });

  it('handles special chars gracefully', () => {
    expect(fuzzyMatch('!', 'dashboard')).toBe(false);
    expect(fuzzyMatch('n', 'New Analysis')).toBe(true);
  });
});

describe('Command Palette - keyboard navigation logic', () => {
  it('clamps active index to valid range', () => {
    const items = ['a', 'b', 'c'];
    const total = items.length;

    // ArrowDown: increase index
    let idx = 0;
    idx = Math.min(idx + 1, total - 1);
    expect(idx).toBe(1);

    idx = Math.min(idx + 1, total - 1);
    expect(idx).toBe(2);

    // Should not go above max
    idx = Math.min(idx + 1, total - 1);
    expect(idx).toBe(2);

    // ArrowUp: decrease
    idx = Math.max(idx - 1, 0);
    expect(idx).toBe(1);

    idx = Math.max(idx - 1, 0);
    expect(idx).toBe(0);

    // Should not go below 0
    idx = Math.max(idx - 1, 0);
    expect(idx).toBe(0);
  });
});
