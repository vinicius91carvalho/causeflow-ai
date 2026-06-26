/**
 * extract-template.js
 * Extracts rendered content from a bundler-based HTML file using Playwright.
 * Usage: node tests/e2e/tools/extract-template.js <html-file> <output-dir>
 */

const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const htmlFile = process.argv[2] || '/root/projects/causeflow/causeflow-new-home.html';
const outputDir =
  process.argv[3] || '/root/projects/causeflow/web/docs/redesign-review/template-extract';

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const fileUrl = `file://${path.resolve(htmlFile)}`;
  console.log(`Loading: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  // Wait for bundler to unpack — poll until sections >= 3 OR body children > 100, timeout 15s
  console.log('Waiting for bundler to render...');
  try {
    await page.waitForFunction(
      () => {
        const sections = document.querySelectorAll('section').length;
        const bodyChildren = document.body ? document.body.children.length : 0;
        return sections >= 3 || bodyChildren > 100;
      },
      { timeout: 15000, polling: 200 },
    );
    console.log('Render condition met.');
  } catch {
    console.warn('Render wait timed out (15s), proceeding with current DOM state.');
  }

  // Extra settle time for async renders
  await page.waitForTimeout(1000);

  // ── 1. rendered.html ──────────────────────────────────────────────────────
  const renderedHtml = await page.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(outputDir, 'rendered.html'), renderedHtml, 'utf8');
  console.log(`rendered.html written (${(renderedHtml.length / 1024).toFixed(1)} KB)`);

  // ── 2. all-css.css ────────────────────────────────────────────────────────
  const cssContent = await page.evaluate(() => {
    const parts = [];

    // Inline <style> tags
    for (const style of document.querySelectorAll('style')) {
      parts.push(`/* === inline <style> === */\n${style.textContent}`);
    }

    // <link rel="stylesheet"> — attempt to read via CSSOM
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const href = link.href || link.getAttribute('href');
      parts.push(`/* === external: ${href} === */`);
      // Try to get rules via CSSOM
      try {
        for (const sheet of document.styleSheets) {
          if (sheet.href === href) {
            try {
              const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
              parts.push(rules);
            } catch (e) {
              parts.push(`/* CSSOM blocked for ${href}: ${e.message} */`);
            }
          }
        }
      } catch (e) {
        parts.push(`/* styleSheets error: ${e.message} */`);
      }
    }

    // All styleSheets (catches dynamically injected ones too)
    try {
      for (const sheet of document.styleSheets) {
        const alreadyDone = parts.some((p) => p.includes(sheet.href || '__inline'));
        if (!alreadyDone || !sheet.href) {
          try {
            const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
            parts.push(`/* === sheet: ${sheet.href || 'dynamic'} === */\n${rules}`);
          } catch {
            // cross-origin, skip
          }
        }
      }
    } catch {
      /* ignore */
    }

    return parts.join('\n\n');
  });
  fs.writeFileSync(path.join(outputDir, 'all-css.css'), cssContent, 'utf8');
  console.log(`all-css.css written (${(cssContent.length / 1024).toFixed(1)} KB)`);

  // ── 3. fonts.json ─────────────────────────────────────────────────────────
  const fontsData = await page.evaluate(() => {
    const map = new Map(); // fontFamily -> selector
    const walk = (el, depth) => {
      if (depth > 50) return;
      try {
        const ff = getComputedStyle(el).fontFamily;
        if (ff && !map.has(ff)) {
          // build a simple selector
          let selector = el.tagName.toLowerCase();
          if (el.id) selector += `#${el.id}`;
          else if (el.className && typeof el.className === 'string') {
            const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
            if (cls) selector += `.${cls}`;
          }
          map.set(ff, selector);
        }
      } catch {
        /* skip */
      }
      for (const child of el.children) walk(child, depth + 1);
    };
    walk(document.body, 0);
    const result = {};
    for (const [ff, sel] of map) result[ff] = sel;
    return result;
  });
  fs.writeFileSync(path.join(outputDir, 'fonts.json'), JSON.stringify(fontsData, null, 2), 'utf8');
  const fontFamilies = Object.keys(fontsData);
  console.log(`fonts.json written — ${fontFamilies.length} distinct font families`);
  console.log('Font families:', fontFamilies.join(' | '));

  // ── 4. sections.json ──────────────────────────────────────────────────────
  const sectionsData = await page.evaluate(() => {
    const container = document.querySelector('main') || document.body;
    const children = [...container.children];
    return children.map((el) => ({
      tag: el.tagName.toLowerCase(),
      classes: el.className || '',
      id: el.id || '',
      innerText_first_100_chars: (el.innerText || '').slice(0, 100).replace(/\s+/g, ' ').trim(),
      childCount: el.children.length,
    }));
  });
  fs.writeFileSync(
    path.join(outputDir, 'sections.json'),
    JSON.stringify(sectionsData, null, 2),
    'utf8',
  );
  console.log(`sections.json written — ${sectionsData.length} sections`);

  // ── 5. assets.json ────────────────────────────────────────────────────────
  const assetsData = await page.evaluate(() => {
    const images = new Set();
    const fonts = new Set();

    // DOM images
    for (const img of document.querySelectorAll('img')) {
      if (img.src) images.add(img.src);
      if (img.getAttribute('data-src')) images.add(img.getAttribute('data-src'));
    }

    // CSS background images + font-face src
    const cssText = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');

    // Also grab inline style text
    const inlineCss = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const allCss = `${cssText}\n${inlineCss}`;

    // background-image URLs
    const bgMatches = allCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
    for (const m of bgMatches) {
      const url = m[1];
      if (/\.(png|jpg|jpeg|gif|svg|webp|avif)(\?|$)/i.test(url)) {
        images.add(url);
      } else if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) {
        fonts.add(url);
      }
    }

    // @font-face src
    const fontMatches = allCss.matchAll(/@font-face\s*\{[^}]*src\s*:[^;]+;/g);
    for (const fm of fontMatches) {
      const urlMatches = fm[0].matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
      for (const um of urlMatches) fonts.add(um[1]);
    }

    // Inline style attributes
    for (const el of document.querySelectorAll('[style]')) {
      const s = el.getAttribute('style') || '';
      const matches = s.matchAll(/url\(['"]?([^'")]+)['"]?\)/g);
      for (const m of matches) images.add(m[1]);
    }

    return {
      images: [...images],
      fonts: [...fonts],
    };
  });
  fs.writeFileSync(
    path.join(outputDir, 'assets.json'),
    JSON.stringify(assetsData, null, 2),
    'utf8',
  );
  console.log(
    `assets.json written — ${assetsData.images.length} images, ${assetsData.fonts.length} font URLs`,
  );

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== EXTRACTION COMPLETE ===');
  console.log(`Section count: ${sectionsData.length}`);
  console.log(`Distinct font families (${fontFamilies.length}):`);
  fontFamilies.forEach((f, i) => {
    console.log(`  [${i}] ${f}`);
  });
  console.log(`Font URLs (${assetsData.fonts.length}):`);
  assetsData.fonts.forEach((f) => {
    console.log(`  ${f}`);
  });
  console.log(`Output dir: ${outputDir}`);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
