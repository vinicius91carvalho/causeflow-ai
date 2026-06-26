import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1700/';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();

// home duo section + paranoid
await p.goto('http://localhost:3000/pt-br', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
const duo = await p.locator('section:has-text("Problemas de tech")').first();
await duo.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await duo.screenshot({ path: `${OUT}duo.png` });

const par = await p.locator('section:has-text("Paranoico")').first();
await par.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await par.screenshot({ path: `${OUT}paranoid-home.png` });

// security page
await p.goto('http://localhost:3000/pt-br/security', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1500);
const sp = await p.locator('section:has-text("Paranoico")').first();
await sp.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await sp.screenshot({ path: `${OUT}paranoid-security.png` });

await b.close();
console.log('ok', OUT);
