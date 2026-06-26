import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/pt-br', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1500);
const el = await p.locator('section:has-text("Paranoico")').first();
await el.scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await el.screenshot({
  path: '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1610/paranoid.png',
});
// also capture full
await p.screenshot({
  path: '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1610/home-full-v2.png',
  fullPage: true,
});
await b.close();
console.log('ok');
