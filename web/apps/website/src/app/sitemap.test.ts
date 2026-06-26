import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('generates entries for all pages in both locales', () => {
    const entries = sitemap();
    // 12 pages × 2 locales = 24 entries (/use-cases index + 3 case-study slugs added)
    expect(entries.length).toBe(24);
  });

  it('sets homepage priority to 1.0 for EN and 0.9 for PT-BR', () => {
    const entries = sitemap();
    const homepage = entries.find((e) => e.url.endsWith('causeflow.ai'));
    const ptbrHomepage = entries.find((e) => e.url.endsWith('ai/pt-br'));
    expect(homepage?.priority).toBe(1.0);
    expect(ptbrHomepage?.priority).toBe(0.9);
  });

  it('includes /use-cases index + 3 case-study slugs for both locales', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    for (const path of [
      '/use-cases',
      '/use-cases/stale-pricing',
      '/use-cases/broken-images',
      '/use-cases/cascading-500',
    ]) {
      expect(urls.some((u) => u.endsWith(path))).toBe(true);
      expect(urls.some((u) => u.endsWith(`/pt-br${path}`))).toBe(true);
    }
  });
});
