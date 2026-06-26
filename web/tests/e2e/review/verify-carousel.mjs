import { chromium } from 'playwright';

const OUT = '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1015';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console.error: ${m.text()}`);
  });

  console.log('[nav] /');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${OUT}/01-home-top.png`, fullPage: false });

  const h1Before = await page.locator('h1').first().innerText();
  console.log('[h1 eng]', JSON.stringify(h1Before));

  const opsBtn = page.getByRole('button', { name: /customer ops|ops|l2\/l3|support/i }).first();
  if ((await opsBtn.count()) > 0) {
    await opsBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    const h1After = await page.locator('h1').first().innerText();
    console.log('[h1 ops]', JSON.stringify(h1After));
    console.log('[swap worked]', h1Before !== h1After);
  } else {
    console.log('[ops toggle not found]');
  }

  await page.screenshot({ path: `${OUT}/02-home-ops.png`, fullPage: false });

  await page.locator('#use-cases').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-usecases-idx0.png` });

  const nextBtn = page
    .locator('#use-cases button[aria-label*="next" i], #use-cases button[aria-label*="Next" i]')
    .first();
  const hasNext = await nextBtn.count();
  console.log('[next btn count]', hasNext);
  if (hasNext > 0) {
    await nextBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/04-usecases-idx1.png` });
    await nextBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/05-usecases-idx2.png` });
    const track = page.locator('#use-cases .overflow-hidden > div').first();
    const transform = await track.evaluate((el) => getComputedStyle(el).transform);
    console.log('[track transform]', transform);
  }

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/06-home-full.png`, fullPage: true });

  const darkClass = await page.locator('html').getAttribute('class');
  console.log('[html class]', darkClass);

  console.log('[errors]', errs.length);
  errs.forEach((e) => console.log('  -', e));

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
