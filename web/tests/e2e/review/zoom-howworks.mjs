import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1200);
const el = await p.$('#product');
if (el) {
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await el.screenshot({
    path: '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1530-pixel-v3/how-works-zoom.png',
  });
}
await b.close();
console.log('ok');
