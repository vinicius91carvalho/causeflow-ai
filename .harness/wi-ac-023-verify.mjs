#!/usr/bin/env node
/**
 * WI-AC-023 — HTTP probe for canonical Test Application (OSS) docs page.
 *
 * Expects mint (or docs server) on PORT (default 5171).
 * Pass: GET /integrations/test-application returns 200 and body includes
 * scope, demo failure catalog markers, and Incidents golden-path language.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 5171);
const BASE = `http://127.0.0.1:${PORT}`;
const PATH = '/integrations/test-application';
const OUT = resolve(
  new URL('.', import.meta.url).pathname,
  'wi-ac-023-verify-first.json',
);

const required = [
  'Test Application (OSS)',
  'scope',
  'pool exhaustion',
  'payment',
  'timeout',
  'CPU',
  'latency',
  'degraded',
  'v2.4.1-ac058',
  'Incidents',
  'golden',
];

function fail(notes, extra = {}) {
  const payload = {
    id: 'WI-AC-023',
    phase: 'verify',
    acceptance_check_id: 'AC-023',
    ac023_pass: false,
    url: `${BASE}${PATH}`,
    notes,
    ...extra,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const res = await fetch(`${BASE}${PATH}`, {
  signal: AbortSignal.timeout(15_000),
});
const body = await res.text();
const lower = body.toLowerCase();

if (res.status !== 200) {
  fail(`Expected HTTP 200, got ${res.status}`, { status: res.status });
}

const missing = required.filter((needle) => {
  if (needle === 'scope') return !lower.includes('scope');
  if (needle === 'golden') {
    return !(lower.includes('golden path') || lower.includes('golden-path'));
  }
  return !body.includes(needle) && !lower.includes(needle.toLowerCase());
});

if (missing.length > 0) {
  fail(`Missing required content markers: ${missing.join(', ')}`, {
    status: res.status,
    missing,
  });
}

const payload = {
  id: 'WI-AC-023',
  phase: 'verify',
  acceptance_check_id: 'AC-023',
  observation_method: 'http',
  ac023_pass: true,
  url: `${BASE}${PATH}`,
  status: res.status,
  markers: required,
  notes:
    'Canonical Test Application (OSS) docs page serves scope, fixed demo failure catalog (pool exhaustion, payment timeout, CPU/latency/health degradation, deploy v2.4.1-ac058), and Incidents golden-path steps.',
};
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
