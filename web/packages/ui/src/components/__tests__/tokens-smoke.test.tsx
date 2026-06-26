/**
 * Smoke test: verifies the cleric theme token files contain the expected
 * CSS custom properties. The ui vitest project runs in a node environment
 * (no DOM), so we validate by reading the CSS files directly — same pattern
 * as provider.test.tsx.
 *
 * This test does NOT verify computed color values (that's a Playwright E2E
 * concern in later sprints). It only confirms the CSS declarations are
 * physically present, preventing accidental deletion.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const lightCss = readFileSync(
  fileURLToPath(new URL('../../themes/cleric/tokens/light.css', import.meta.url)),
  'utf-8',
);

const darkCss = readFileSync(
  fileURLToPath(new URL('../../themes/cleric/tokens/dark.css', import.meta.url)),
  'utf-8',
);

describe('cleric theme — token smoke test', () => {
  describe('light.css', () => {
    it('declares --primary', () => {
      expect(lightCss).toMatch(/--primary:/);
    });

    it('declares --accent', () => {
      expect(lightCss).toMatch(/--accent:/);
    });

    it('declares --warning', () => {
      expect(lightCss).toMatch(/--warning:/);
    });

    it('declares --success', () => {
      expect(lightCss).toMatch(/--success:/);
    });

    it('declares --background', () => {
      expect(lightCss).toMatch(/--background:/);
    });

    it('has no hsl() wrappers — bare HSL values only', () => {
      expect(lightCss).not.toMatch(/hsl\(/);
    });

    it('has Tailwind-compatible bg-warning class anchor: --warning-foreground', () => {
      expect(lightCss).toMatch(/--warning-foreground:/);
    });

    it('has Tailwind-compatible bg-success class anchor: --success-foreground', () => {
      expect(lightCss).toMatch(/--success-foreground:/);
    });

    it('scopes tokens under [data-theme="cleric"] selector', () => {
      expect(lightCss).toMatch(/\[data-theme="cleric"\]/);
    });
  });

  describe('dark.css', () => {
    it('declares --primary', () => {
      expect(darkCss).toMatch(/--primary:/);
    });

    it('declares --accent', () => {
      expect(darkCss).toMatch(/--accent:/);
    });

    it('declares --warning', () => {
      expect(darkCss).toMatch(/--warning:/);
    });

    it('declares --success', () => {
      expect(darkCss).toMatch(/--success:/);
    });

    it('declares --background', () => {
      expect(darkCss).toMatch(/--background:/);
    });

    it('has no hsl() wrappers — bare HSL values only', () => {
      expect(darkCss).not.toMatch(/hsl\(/);
    });

    it('scopes tokens under [data-theme="cleric"].dark selector', () => {
      expect(darkCss).toMatch(
        /\[data-theme="cleric"\]\.dark|\.dark\s*\[data-theme="cleric"\]|\[data-theme="cleric"\]\s*\{/,
      );
    });
  });

  describe('themes registry', () => {
    it('exports cleric theme from index.ts', async () => {
      const { themes } = await import('../../themes/index');
      expect(themes).toHaveProperty('cleric');
      expect(themes.cleric.id).toBe('cleric');
      expect(themes.cleric.supportsDarkMode).toBe(true);
    });

    it('cleric theme has correct font definitions', async () => {
      const { themes } = await import('../../themes/index');
      expect(themes.cleric.fonts?.sans).toBe('Plus Jakarta Sans');
      expect(themes.cleric.fonts?.display).toBe('Space Grotesk');
      expect(themes.cleric.fonts?.mono).toBe('JetBrains Mono');
    });
  });
});
