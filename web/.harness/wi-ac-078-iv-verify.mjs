#!/usr/bin/env node
const DOCS_URL = 'https://vinicius91carvalho.github.io/causeflow-ai/';
const BASE = 'http://127.0.0.1:5170';

async function probe(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  const body = await res.text();
  const location = res.headers.get('location');
  const normalizedLocation = location?.replace(/\/$/, '');
  const normalizedDocs = DOCS_URL.replace(/\/$/, '');
  return {
    path,
    status: res.status,
    location,
    redirect_to_docs:
      normalizedLocation === normalizedDocs ||
      location === DOCS_URL ||
      location === `${DOCS_URL}/`,
    body_len: body.length,
    has_starter: /\bStarter\b/.test(body),
    has_pro: />\s*Pro\s*</.test(body) || /\bPro\b/.test(body),
    has_business: /\bBusiness\b/.test(body),
    has_99_price: /\$99/.test(body),
    body_has_docs_url: body.includes('vinicius91carvalho.github.io/causeflow-ai'),
    has_paid_plan_cards:
      /\bStarter\b/.test(body) && /\bBusiness\b/.test(body) && /\$99/.test(body),
  };
}

const routes = await Promise.all(['/pricing', '/pt-br/pricing'].map(probe));
const out = {
  base: BASE,
  docs_url: DOCS_URL,
  routes,
  eval: {
    all_redirect_to_docs: routes.every((r) => r.redirect_to_docs && [301, 302, 307, 308].includes(r.status)),
    no_paid_plan_cards: routes.every((r) => !r.has_paid_plan_cards),
    no_200_pricing_page: routes.every((r) => r.status !== 200 || r.body_len === 0),
  },
};
console.log(JSON.stringify(out, null, 2));
