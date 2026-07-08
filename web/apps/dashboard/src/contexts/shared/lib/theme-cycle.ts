/**
 * Theme cycling utility — cycles through light → dark → system → light.
 * Pure function, no React dependencies.
 */

export const THEME_CYCLE = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_CYCLE)[number];

export function getNextTheme(current: string): ThemeMode {
  const index = THEME_CYCLE.indexOf(current as ThemeMode);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length]!;
}
