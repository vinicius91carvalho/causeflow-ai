import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT_DIR = '/root/projects/causeflow/web/.artifacts/template-extract/2026-04-19';
mkdirSync(OUT_DIR, { recursive: true });

const TEMPLATE_URL = 'file:///root/projects/causeflow/causeflow-new-home.html';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  if (m.type() === 'error') console.log('BROWSER ERR:', m.text().slice(0, 200));
});

await page.goto(TEMPLATE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Wait for bundler thumbnail/loading to disappear and real DOM to be there.
try {
  await page.waitForFunction(
    () => !document.querySelector('#__bundler_loading') || document.body.children.length > 5,
    null,
    { timeout: 45000 },
  );
} catch {}

// Let React settle
await page.waitForTimeout(3000);

// Dump HTML
const html = await page.content();
writeFileSync(resolve(OUT_DIR, 'rendered.html'), html);

// Full-page screenshot
await page.screenshot({ path: resolve(OUT_DIR, 'template-full.png'), fullPage: true });
await page.screenshot({ path: resolve(OUT_DIR, 'template-viewport.png'), fullPage: false });

// Extract computed styles of key elements
const computed = await page.evaluate(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    out._classes = el.className;
    out._tag = el.tagName.toLowerCase();
    out._text = (el.innerText || '').slice(0, 200);
    return out;
  };
  const BASE = [
    'color',
    'background',
    'background-color',
    'background-image',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'padding',
    'margin',
    'border',
    'border-radius',
    'box-shadow',
    'display',
    'flex-direction',
    'gap',
    'grid-template-columns',
    'width',
    'height',
    'max-width',
    'min-width',
    'min-height',
    'position',
    'z-index',
    'overflow',
    'transform',
    'transition',
    'text-align',
    'text-transform',
    'opacity',
  ];

  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));

  // Hero
  const heroSection = q('[class*=hero]') || q('header') || q('main > section:first-of-type');
  const heroBg = pick(heroSection, BASE);
  const heroH1 = pick(q('h1'), BASE);
  const heroP = pick(q('h1 + p, .hero p:first-of-type'), BASE);

  // CTAs in hero
  const ctaButtons = qa(
    'a[class*=btn], button[class*=btn], .cta-row a, .cta-row button, [class*=cta] a, [class*=cta] button',
  )
    .slice(0, 6)
    .map((el) => pick(el, BASE));

  // Body + html
  const htmlBg = pick(document.documentElement, ['background', 'background-color', 'font-family']);
  const bodyBg = pick(document.body, ['background', 'background-color', 'font-family', 'color']);

  // How-it-works cards — find 3-card section
  const howSection = qa('section').find(
    (s) => /how|funciona|conecta|works/i.test(s.innerText || '') && s.innerText.length < 3000,
  );
  const howCards = howSection
    ? qa('article, .card, [class*=card]', howSection)
        .slice(0, 5)
        .map((el) => pick(el, BASE))
    : [];

  // Mini dashboard / browser frame
  const frame = q('[class*=browser-frame], [class*=browser], [class*=dash], [class*=mini-dash]');
  const frameInfo = pick(frame, BASE);

  // CTA "stop" section — match by text
  const allSections = qa('section');
  const ctaStop = allSections.find((s) => /stop|caçar|chasing|pare/i.test(s.innerText || ''));
  const ctaStopInfo = pick(ctaStop, BASE);
  const ctaStopCard = ctaStop ? pick(ctaStop.querySelector('div,article'), BASE) : null;
  const ctaStopH = ctaStop ? pick(ctaStop.querySelector('h1,h2,h3'), BASE) : null;

  // All h1 h2 font details
  const headings = qa('h1,h2,h3')
    .slice(0, 12)
    .map((el) => ({
      tag: el.tagName,
      text: el.innerText.slice(0, 60),
      ...pick(el, [
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'letter-spacing',
        'color',
      ]),
    }));

  // Any gradient backgrounds on page
  const gradients = qa('*')
    .filter((el) => {
      const bi = getComputedStyle(el).backgroundImage;
      return bi && bi !== 'none' && bi.includes('gradient');
    })
    .slice(0, 40)
    .map((el) => ({
      tag: el.tagName,
      classes: (el.className || '').slice(0, 80),
      text: (el.innerText || '').slice(0, 80),
      bg: getComputedStyle(el).backgroundImage,
    }));

  // All CSS rules with gradients
  const allStyleRules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.cssText && /gradient/i.test(rule.cssText)) {
          allStyleRules.push(rule.cssText.slice(0, 300));
        }
      }
    } catch {}
  }

  // Section inventory (what sections exist in order)
  const sections = allSections.map((s) => ({
    tag: s.tagName,
    classes: (s.className || '').slice(0, 100),
    firstH: s.querySelector('h1,h2,h3')?.innerText?.slice(0, 80) || '',
    firstText: (s.innerText || '').split('\n').filter(Boolean)[0]?.slice(0, 100) || '',
  }));

  return {
    html: htmlBg,
    body: bodyBg,
    hero: { section: heroBg, h1: heroH1, lead: heroP, ctas: ctaButtons },
    how: { cards: howCards },
    frame: frameInfo,
    ctaStop: { section: ctaStopInfo, card: ctaStopCard, heading: ctaStopH },
    headings,
    gradients,
    gradientRules: allStyleRules.slice(0, 50),
    sections,
  };
});

writeFileSync(resolve(OUT_DIR, 'computed.json'), JSON.stringify(computed, null, 2));

// Capture element-specific screenshots
const snap = async (selector, name) => {
  const el = await page.$(selector);
  if (el) {
    try {
      await el.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
    } catch (e) {
      console.log('snap fail', name, String(e).slice(0, 80));
    }
  } else {
    console.log('no element for', selector);
  }
};

await snap('h1', 'hero-h1');
await snap('[class*=browser-frame]', 'dash-frame');
await snap('[class*=hero]', 'hero-section');

await browser.close();

console.log('DONE. artifacts in', OUT_DIR);
console.log('sections:', computed.sections.length);
console.log('headings:', computed.headings.length);
console.log('gradients:', computed.gradients.length);
