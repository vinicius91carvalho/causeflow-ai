import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/pt-br', { waitUntil: 'networkidle', timeout: 60000 });
// capture during typewriter stream
await p.waitForTimeout(900);
await p.screenshot({
  path: '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1610/hero-typing.png',
  clip: { x: 0, y: 0, width: 1440, height: 900 },
});
await b.close();
console.log('ok');
