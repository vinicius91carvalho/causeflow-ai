// Original theme — animation components

export { AnimateOnScroll } from './original/animations/components/animate-on-scroll';
export { CountUp } from './original/animations/components/count-up';
export { TypingAnimation } from './original/animations/components/typing-animation';
// Original theme — animation hooks
export { useAnimateOnScroll } from './original/animations/hooks/use-animate-on-scroll';
export type { ThemeProviderProps } from './provider';
export { ThemeProvider, useTheme } from './provider';
export { ThemeSwitcher } from './theme-switcher';
export type { ColorMode, ThemeDefinition, ThemeId } from './types';

import themeConfig from './config.json';
// Theme registry — config.json is the source of truth for production defaults
import type { ThemeDefinition } from './types';

const originalTheme: ThemeDefinition = {
  id: 'original',
  name: 'Original',
  description: 'Deep Indigo + Electric Teal — CauseFlow AI default',
  identity: 'Clean, professional SaaS identity with a modern tech feel.',
  supportsDarkMode: true,
  cssFiles: {
    light: 'original/tokens/light.css',
    dark: 'original/tokens/dark.css',
  },
  fonts: {
    sans: 'Plus Jakarta Sans',
    display: 'Plus Jakarta Sans',
    mono: 'JetBrains Mono',
  },
};

const clericTheme: ThemeDefinition = {
  id: 'cleric',
  name: 'Cleric',
  description: 'Deep Indigo + Electric Teal — Space Grotesk display edition',
  identity: 'Modern, bold SaaS identity with Space Grotesk display type.',
  supportsDarkMode: true,
  cssFiles: {
    light: 'cleric/tokens/light.css',
    dark: 'cleric/tokens/dark.css',
  },
  fonts: {
    sans: 'Plus Jakarta Sans',
    display: 'Space Grotesk',
    mono: 'JetBrains Mono',
  },
};

export const themes: Record<string, ThemeDefinition> = {
  original: originalTheme,
  cleric: clericTheme,
};

/** Default theme ID from config.json — change config.json to switch the production theme */
export const defaultThemeId = (themeConfig.defaultTheme || 'original') as string;
