/**
 * Source-guard contract tests for MobileMenu.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./mobile-menu.tsx', import.meta.url)), 'utf-8');

describe('MobileMenu component contract', () => {
  it('exports MobileMenu function', () => {
    expect(source).toMatch(/export function MobileMenu/);
  });

  it('accepts navItems with optional external flag', () => {
    expect(source).toMatch(/external\?:\s*boolean/);
  });

  it('opens external links in a new tab with safe rel', () => {
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);
  });

  it('uses next-intl Link for internal items', () => {
    expect(source).toMatch(/from '@\/i18n\/navigation'/);
  });

  it('closes the sheet on item click', () => {
    expect(source).toMatch(/onClick=\{onClose\}/);
  });
});
