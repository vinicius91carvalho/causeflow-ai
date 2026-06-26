import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/pt-br', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1500);

const shots = [
  ['hero', 'section:has(h1)'],
  ['product', '#product'],
];
const OUT = '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1610/';
const { mkdirSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });
for (const [name, sel] of shots) {
  const el = await p.$(sel);
  if (el) {
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await el.screenshot({ path: `${OUT + name}.png` });
  }
}
// Full page for overview
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}home-full.png`, fullPage: true });
await b.close();
console.log('ok', OUT);
