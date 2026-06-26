import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const routes = ['/', '/integrations', '/use-cases', '/product', '/pricing', '/security'];
const outDir = 'screenshots/sprint-06-p0-verify';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
await context.route(/(google-analytics|googletagmanager|clarity|intercom)/, (r) => r.abort());
const page = await context.newPage();

for (const route of routes) {
  const url = `http://localhost:3000${route}`;
  const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log(`ok ${route}`);
  } catch (e) {
    console.error(`fail ${route}: ${e.message}`);
  }
}

await browser.close();
