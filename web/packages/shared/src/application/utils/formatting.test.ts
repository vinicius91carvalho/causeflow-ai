import { describe, expect, it } from 'vitest';
import { formatNumber, formatPrice } from './formatting';

describe('formatPrice', () => {
  it('formats zero as $0', () => {
    expect(formatPrice(0)).toBe('$0');
  });

  it('formats 149 as $149', () => {
    expect(formatPrice(149)).toBe('$149');
  });

  it('formats 1299 with comma separator', () => {
    expect(formatPrice(1299)).toBe('$1,299');
  });

  it('returns string values as-is', () => {
    expect(formatPrice('Custom')).toBe('Custom');
  });
});

describe('formatNumber', () => {
  it('formats 1000 with comma', () => {
    expect(formatNumber(1000)).toBe('1,000');
  });

  it('formats 0 as "0"', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats 1234567 with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
