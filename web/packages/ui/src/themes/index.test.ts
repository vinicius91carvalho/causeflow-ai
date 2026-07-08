import { describe, expect, it } from 'vitest';
import { defaultThemeId, themes } from './index';

describe('themes registry', () => {
  it('contains original and cleric themes', () => {
    expect(Object.keys(themes)).toContain('original');
    expect(Object.keys(themes)).toContain('cleric');
  });

  it('original theme is properly defined', () => {
    expect(themes.original!.id).toBe('original');
    expect(themes.original!.supportsDarkMode).toBe(true);
  });

  it('cleric theme is properly defined', () => {
    expect(themes.cleric!.id).toBe('cleric');
    expect(themes.cleric!.supportsDarkMode).toBe(true);
  });

  it('defaultThemeId resolves to cleric', () => {
    expect(defaultThemeId).toBe('cleric');
  });
});
