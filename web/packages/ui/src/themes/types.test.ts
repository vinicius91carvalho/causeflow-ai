import { describe, expectTypeOf, it } from 'vitest';
import type { ColorMode, ThemeId } from './types';

describe('theme types', () => {
  it('ThemeId accepts original literal', () => {
    expectTypeOf<'original'>().toMatchTypeOf<ThemeId>();
  });

  it('ColorMode union has expected members', () => {
    expectTypeOf<'light'>().toMatchTypeOf<ColorMode>();
    expectTypeOf<'dark'>().toMatchTypeOf<ColorMode>();
    expectTypeOf<'system'>().toMatchTypeOf<ColorMode>();
  });
});
