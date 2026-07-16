#!/usr/bin/env node
const BASE = 'http://127.0.0.1:5181';
const PAGES = [
  '/billing/plans',
  '/billing/usage-and-credits',
  '/billing/manage-subscription',
  '/getting-started/quickstart',
  '/api-reference/billing/plans',
];

const PAID_PATTERNS = [
  { id: 'pricing_href', re: /causeflow\.ai\/pricing/i },
  { id: 'price_99', re: /\$99\b/ },
  { id: 'price_499', re: /\$499\b/ },
  { id: 'choose_plan', re: /choose a plan/i },
  { id: 'stripe_checkout_cta', re: /(start checkout|go to checkout|complete checkout|stripe checkout)/i },
  { id: 'paid_tier_table', re: /Starter[\s\S]{0,200}\$99[\s\S]{0,200}Business/i },
];

const OSS_PATTERNS = [
  { id: 'self_host', re: /self-host|self host|open-source|open source/i },
  { id: 'github_pages_or_init', re: /vinicius91carvalho\.github\.io\/causeflow-ai|init\.sh|github\.com\/causeflow/i },
];

async function probe(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.text();
  const paidHits = PAID_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.id);
  const ossHits = OSS_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.id);
  const stripeMentions = (body.match(/stripe/gi) || []).length;
  const hasCommercialStripePath =
    /stripe checkout/i.test(body) &&
    !/not part of the open-source|return \*\*410 Gone\*\*|not part of the OSS/i.test(body);
  return {
    path,
    status: res.status,
    body_len: body.length,
    paid_hits: paidHits,
    oss_hits: ossHits,
    stripe_mentions: stripeMentions,
    has_commercial_stripe_path: hasCommercialStripePath,
    title_snippet: body.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null,
  };
}

const pages = [];
for (const path of PAGES) {
  pages.push(await probe(path));
}

const out = {
  base: BASE,
  branch: 'plan/opensource-docker',
  pages,
  eval: {
    all_200: pages.every((p) => p.status === 200),
    no_paid_hits: pages.every((p) => p.paid_hits.length === 0),
    no_commercial_stripe_path: pages.every((p) => !p.has_commercial_stripe_path),
    all_have_oss_copy: pages.every((p) => p.oss_hits.length >= 1),
    page_fails: pages
      .filter(
        (p) =>
          p.status !== 200 ||
          p.paid_hits.length > 0 ||
          p.has_commercial_stripe_path ||
          p.oss_hits.length < 1,
      )
      .map((p) => ({
        path: p.path,
        status: p.status,
        paid_hits: p.paid_hits,
        has_commercial_stripe_path: p.has_commercial_stripe_path,
        oss_hits: p.oss_hits,
      })),
  },
};

const outPath = new URL('./wi-ac-080-iv-http.json', import.meta.url);
await import('node:fs/promises').then((fs) => fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`));
console.log(JSON.stringify(out, null, 2));
