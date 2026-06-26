import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT_DIR =
  '/root/projects/causeflow/web/.artifacts/playwright/screenshots/2026-04-19_1500-pixel-rebuild-v2';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

const VIEWPORTS = [
  { w: 1440, h: 900, name: 'desktop' },
  { w: 375, h: 812, name: 'mobile' },
];

const URLS = [
  ['home-en', 'http://localhost:3000'],
  ['home-pt', 'http://localhost:3000/pt-br'],
  ['integrations-en', 'http://localhost:3000/integrations'],
];

const errorsByPage = {};

for (const [name, url] of URLS) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errs.push(`pageerror: ${String(e).slice(0, 200)}`));
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: resolve(OUT_DIR, `${name}-${vp.name}.png`),
        fullPage: true,
      });
    } catch (e) {
      errs.push(`goto: ${String(e).slice(0, 200)}`);
    }
    errorsByPage[`${name}-${vp.name}`] = errs;
    await ctx.close();
  }
}

// Content assertions on home/en
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

const checks = await page.evaluate(() => {
  const r = {};
  const body = document.body;
  r.bodyBg = getComputedStyle(body).backgroundColor;
  const h1 = document.querySelector('h1');
  r.h1FontFamily = getComputedStyle(h1).fontFamily;
  r.h1Uses = /Space Grotesk/.test(r.h1FontFamily);
  const text = body.innerText;
  r.heroHasCta1 = /Agendar demo|Schedule a demo/.test(text);
  r.hasMemory = /\bMemory\b/.test(text);
  r.hasAgentesAtivos = /Agentes ativos|Active agents/.test(text);
  r.urlDash = text.includes('dashboard.causeflow.ai/investigations');
  r.howConnects = /Connects\.|Conecta\./.test(text);
  r.howInvestigates = /Investigates\.|Investiga\./.test(text);
  r.duo = /framework|Dois produtos/.test(text);
  r.timeSaved = /Tempo do seu time|YOUR TEAM|tempo do/i.test(text);
  r.ctaStop = /Stop\b|Pare de/.test(text);
  r.knowledgeBank = /banco de conhecimento|knowledge bank/i.test(text);

  // Position check — integrations carousel between how and duo
  const idxConecta = text.search(/Conecta\.|Connects\./);
  const idxDuo = text.search(/Dois produtos|Two products|framework/);
  const idxDatadog = text.indexOf('Datadog');
  r.orderOk = idxConecta > 0 && idxDatadog > idxConecta && idxDuo > idxDatadog;

  return r;
});

await browser.close();

console.log('=== CHECKS ===');
for (const [k, v] of Object.entries(checks)) console.log(' ', k, '→', v);
console.log('=== ERRORS ===');
let total = 0;
for (const [p, errs] of Object.entries(errorsByPage)) {
  if (errs.length) {
    console.log('FAIL', p);
    for (const e of errs) console.log('   -', e);
    total += errs.length;
  } else {
    console.log('OK  ', p);
  }
}
console.log('total errors:', total);
console.log('screenshots:', OUT_DIR);
