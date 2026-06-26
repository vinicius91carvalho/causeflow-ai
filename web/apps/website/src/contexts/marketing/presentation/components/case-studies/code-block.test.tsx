/**
 * Source-guard contract tests for CodeBlock.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./code-block.tsx', import.meta.url)), 'utf-8');

describe('CodeBlock component contract', () => {
  it('exports CodeBlock function', () => {
    expect(source).toMatch(/export function CodeBlock/);
  });

  it('consumes highlight.js server-side', () => {
    expect(source).toMatch(/highlight\.js/);
    expect(source).toMatch(/hljs\.highlight/);
  });

  it('accepts code, language, title, and tone props', () => {
    expect(source).toMatch(/code:\s*string/);
    expect(source).toMatch(/language:\s*string/);
    expect(source).toMatch(/title\?:\s*string/);
    expect(source).toMatch(/tone\?:\s*CodeBlockTone/);
  });

  it('uses design tokens (no raw hex values)', () => {
    expect(source).toMatch(/bg-card|bg-background|border-border/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('falls back to escaped plain text for unknown languages', () => {
    expect(source).toMatch(/getLanguage/);
    expect(source).toMatch(/escapeHtml/);
  });
});
