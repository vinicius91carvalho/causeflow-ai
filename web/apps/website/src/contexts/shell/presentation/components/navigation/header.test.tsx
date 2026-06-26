import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const headerSource = readFileSync(fileURLToPath(new URL('./header.tsx', import.meta.url)), 'utf-8');

describe('Header', () => {
  it('does not import or render DevThemeSwitcher', () => {
    expect(headerSource).not.toMatch(/DevThemeSwitcher/);
  });
});
