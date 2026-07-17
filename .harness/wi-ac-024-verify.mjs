#!/usr/bin/env node
/**
 * WI-AC-024 — HTTP probe: public-docs OSS narrative (no commercial product path).
 *
 * Expects mint (or docs server) on PORT (default 5171).
 * Pass: key OSS pages return 200, describe free self-host + Docs/GitHub, and do
 * not present paid tiers / Stripe checkout / choose-a-plan / Dashboard Billing
 * as the OSS product path.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 5171);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(
  new URL('.', import.meta.url).pathname,
  'wi-ac-024-verify-first.json',
);

const positivePaths = [
  '/billing/plans',
  '/billing/usage-and-credits',
  '/billing/manage-subscription',
  '/getting-started/quickstart',
];

const probePaths = [
  ...positivePaths,
  '/integrations/overview',
  '/dashboard/analyses',
  '/api-reference/billing/plans',
  '/api-reference/billing/purchase',
  '/api-reference/billing/subscription',
  '/api-reference/billing/credits',
  '/api-reference/billing/usage',
  '/api-reference/introduction',
  '/security/rbac',
];

const forbidden = [
  [/Dashboard\s*(?:>|&gt;)\s*Billing/i, 'Dashboard Billing guidance'],
  [/\/dashboard\/billing/i, 'dashboard billing route'],
  [/choose[- ]a[- ]plan/i, 'choose-a-plan'],
  [/onboarding\/choose-plan/i, 'choose-plan route'],
  [/Stripe checkout/i, 'Stripe checkout'],
  [/POST\s+\/v1\/billing\/checkout/i, 'billing checkout API as product path'],
  [/Buy Quota/i, 'Buy Quota'],
  [/Buy more/i, 'Buy more'],
  [/causeflow\.ai\/pricing/i, 'hosted pricing URL'],
  [/All plans\s*[—-]\s*Starter,\s*Pro,\s*Business/i, 'paid tier list as product path'],
  [/Starter\s*\/\s*Pro\s*\/\s*Business/i, 'paid tier slash list'],
  [/\$99|\$349|\$899|\$499/, 'paid price points'],
  [/410 Gone/i, '410 billing facade narrative'],
  [/plan_pro|plan_business|plan_starter|plan_enterprise/i, 'paid planId examples'],
];

const requiredAny = [
  [/self[- ]host|Docker Compose|\.\/init\.sh/i, 'self-host instructions'],
  [
    /github\.com\/causeflow|GitHub Pages|vinicius91carvalho\.github\.io/i,
    'Docs/GitHub pointer',
  ],
  [/free|open[- ]source|open source/i, 'free/OSS framing'],
];

function fail(notes, extra = {}) {
  const payload = {
    id: 'WI-AC-024',
    phase: 'verify',
    acceptance_check_id: 'AC-024',
    observation_method: 'http',
    ac024_pass: false,
    port: PORT,
    notes,
    ...extra,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'wi-ac-024-verify' },
  });
  const body = await res.text();
  return { status: res.status, body };
}

const failures = [];
const results = [];

for (const path of probePaths) {
  let status;
  let body;
  try {
    ({ status, body } = await fetchText(path));
  } catch (err) {
    failures.push(`${path}: HTTP fetch failed: ${err?.message ?? err}`);
    results.push({ path, ok: false, error: String(err?.message ?? err) });
    continue;
  }
  const hits = forbidden
    .filter(([re]) => re.test(body))
    .map(([, label]) => label);
  if (status !== 200) failures.push(`${path}: expected 200 got ${status}`);
  if (hits.length) {
    failures.push(
      `${path}: forbidden product-path narrative: ${hits.join(', ')}`,
    );
  }
  results.push({ path, status, forbidden_hits: hits, len: body.length });
}

let agg = '';
for (const path of positivePaths) {
  try {
    const { body } = await fetchText(path);
    agg += body;
  } catch (err) {
    failures.push(`${path}: positive fetch failed: ${err?.message ?? err}`);
  }
}
for (const [re, label] of requiredAny) {
  if (!re.test(agg)) failures.push(`OSS pages collectively missing: ${label}`);
}

if (failures.length) {
  fail(`AC-024 failed with ${failures.length} defect(s)`, { failures, results });
}

const payload = {
  id: 'WI-AC-024',
  phase: 'verify',
  acceptance_check_id: 'AC-024',
  observation_method: 'http',
  ac024_pass: true,
  port: PORT,
  probed: probePaths,
  notes:
    'Public-docs OSS pages describe free self-host usage and Docs/GitHub pointers; no paid tiers, Stripe checkout, choose-a-plan, or Dashboard Billing as the OSS product path.',
};
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
