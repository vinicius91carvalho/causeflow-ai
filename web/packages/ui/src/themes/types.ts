export interface ThemeDefinition {
  id: string;
  name: string;
  description?: string;
  identity?: string;
  supportsDarkMode: boolean;
  cssFiles: { light: string; dark?: string };
  images?: { logo?: string; ogImage?: string; favicon?: string };
  fonts?: { sans?: string; mono?: string; display?: string; drama?: string };
  imageMood?: string;
  heroPattern?: string;
  palette?: {
    primary?: string;
    accent?: string;
    background?: string;
    dark?: string;
  };
}

export type ThemeId = 'original' | (string & {});

export type ColorMode = 'light' | 'dark' | 'system';
