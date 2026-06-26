import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT_DIR =
  '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1530-pixel-v3';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

const URLS = [
  ['home-en', 'http://localhost:3000'],
  ['home-pt', 'http://localhost:3000/pt-br'],
];

for (const [name, url] of URLS) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: resolve(OUT_DIR, `${name}-desktop.png`),
    fullPage: true,
  });
  // Hero-only screenshot (first viewport)
  await page.screenshot({
    path: resolve(OUT_DIR, `${name}-hero.png`),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  await ctx.close();
}

await browser.close();
console.log('ok', OUT_DIR);
