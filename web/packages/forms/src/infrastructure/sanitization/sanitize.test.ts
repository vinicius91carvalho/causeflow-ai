import { describe, expect, it } from 'vitest';
import { sanitizeFormData, sanitizeInput } from './sanitize';

describe('sanitizeInput', () => {
  it('strips script tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('passes through normal text', () => {
    expect(sanitizeInput('normal text')).toBe('normal text');
  });

  it('strips bold and italic tags', () => {
    expect(sanitizeInput('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });
});

describe('sanitizeFormData', () => {
  it('sanitizes string fields and preserves non-string fields', () => {
    const result = sanitizeFormData({ name: '  <b>John</b>  ', age: 25 });
    expect(result).toEqual({ name: 'John', age: 25 });
  });
});
