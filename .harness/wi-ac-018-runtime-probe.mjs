#!/usr/bin/env node
/**
 * WI-AC-018 / AC-018 runtime proof (compose Core :3099).
 *
 * bad active Investigation LLM + healthy Ornith fallbackProfileId →
 * investigation must NOT fail closed in ~1s via shared CircuitBreakerOpenError;
 * it should proceed on the fallback (or, if chain exhausted, clear configure/fix-LLM error).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CORE = process.env.AC018_CORE_URL ?? 'http://127.0.0.1:3099';
const stamp = Date.now();
const email = process.env.AC018_EMAIL ?? `ac018-rt-${stamp}@causeflow.local`;
const pass = process.env.AC018_PASS ?? 'TestPass123!';
const outPath = process.env.AC018_OUT ?? path.join(ROOT, '.harness/wi-ac-018-runtime.json');

const out = {
  id: 'WI-AC-018',
  phase: 'runtime-proof',
  core: CORE,
  email,
  steps: [],
  eval: {},
};

function step(name, data) {
  out.steps.push({ step: name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 400));
}

async function req(url, opts = {}) {
  const res = await fetch(url, { ...opts });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body, text };
}

async function waitHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await req(`${CORE}/health`);
      if (h.ok) return h.body;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Core health not ready at ${CORE}`);
}

await waitHealth();
step('health', { ok: true });

const reg = await req(`${CORE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password: pass,
    tenantName: `AC018 RT ${stamp}`,
    name: 'AC018 Runtime',
  }),
});
step('register', { status: reg.status, body: reg.body });
let token = reg.body?.token;
if (!token) {
  const login = await req(`${CORE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  step('login', { status: login.status });
  token = login.body?.token;
}
if (!token) throw new Error('no auth token');
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const good = await req(`${CORE}/v1/oss/investigation-llm-profiles`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    label: `AC018 Ornith fallback ${stamp}`,
    baseUrl: 'http://host.docker.internal:8081/v1',
    model: 'Ornith-1.0-9B-code',
  }),
});
step('create_good_fallback', { status: good.status, id: good.body?.id, body: good.body });
const fallbackId = good.body?.id;
if (!good.ok || !fallbackId) throw new Error('failed to create Ornith fallback profile');

const bad = await req(`${CORE}/v1/oss/investigation-llm-profiles`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    label: `AC018 bad active ${stamp}`,
    baseUrl: 'http://127.0.0.1:1/v1',
    model: 'bad-model',
    fallbackProfileId: fallbackId,
  }),
});
step('create_bad_active', { status: bad.status, id: bad.body?.id, body: bad.body });
const badId = bad.body?.id;
if (!bad.ok || !badId) throw new Error('failed to create bad active profile');

const activate = await req(`${CORE}/v1/oss/investigation-llm-profiles/${badId}/activate`, {
  method: 'POST',
  headers: auth,
  body: '{}',
});
step('activate_bad_with_fallback', { status: activate.status, body: activate.body });
if (!activate.ok) throw new Error('activate failed');

const connect = await req(`${CORE}/v1/integrations/stub/connect`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({}),
});
step('stub_connect', { status: connect.status, body: connect.body });
if (!connect.ok) throw new Error(`stub connect failed: ${connect.status}`);

const ingest = await req(`${CORE}/v1/integrations/stub/ingest`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    title: `AC018 fallback chain ${stamp}`,
    description: 'AC-018 bad-active + Ornith fallbackProfileId runtime proof',
    priority: 'P1',
  }),
});
step('ingest', { status: ingest.status, body: ingest.body });
const incidentId = ingest.body?.incidentId;
if (!ingest.ok || !incidentId) throw new Error('ingest failed');

// Ingest/triage may already enqueue investigation; also trigger manually.
const investigate = await req(`${CORE}/api/v1/investigation/${incidentId}`, {
  method: 'POST',
  headers: auth,
});
step('investigate_trigger', { status: investigate.status, body: investigate.body });

let earlyFailed = false;
let earlyFailureDetail = '';
let finalStatus = '';
let evidenceLen = 0;
let rootCause = '';
const pollStart = Date.now();
const maxMs = Number(process.env.AC018_POLL_MS ?? 240_000);

for (let i = 0; i < 120 && Date.now() - pollStart < maxMs; i++) {
  const inc = await req(`${CORE}/v1/incidents/${incidentId}`, { headers: auth });
  const inv = await req(`${CORE}/api/v1/investigation/${incidentId}`, { headers: auth });
  finalStatus = inc.body?.status || inv.body?.status || inv.body?.incident?.status || '';
  rootCause =
    inc.body?.rootCause ||
    inv.body?.rootCause ||
    inv.body?.finalSynthesis ||
    inv.body?.incident?.rootCause ||
    '';
  const evidence = inv.body?.evidenceByAgent ?? inc.body?.evidenceByAgent ?? null;
  evidenceLen = evidence ? JSON.stringify(evidence).length : 0;
  const elapsed = Date.now() - pollStart;

  if (i % 3 === 0) {
    step('poll', { i, elapsed, status: finalStatus, evidenceLen, rootPreview: String(rootCause).slice(0, 100) });
  }

  if (finalStatus === 'failed') {
    const blob = JSON.stringify({ inc: inc.body, inv: inv.body, rootCause });
    if (elapsed < 5_000 && /CircuitBreakerOpen|circuit breaker is open/i.test(blob)) {
      earlyFailed = true;
      earlyFailureDetail = blob.slice(0, 1500);
      break;
    }
    if (/CircuitBreakerOpen|circuit breaker is open/i.test(blob) && evidenceLen === 0) {
      earlyFailed = true;
      earlyFailureDetail = blob.slice(0, 1500);
      break;
    }
    // Fail-closed with clear configure/fix-LLM is acceptable only if Ornith also failed.
    if (/Configure or fix the Investigation LLM|fallbackProfileId chain/i.test(blob)) {
      step('fail_closed_clear_error', { elapsed, rootCause: String(rootCause).slice(0, 300) });
      break;
    }
    earlyFailureDetail = blob.slice(0, 1500);
    break;
  }

  if (['investigating', 'awaiting_approval', 'resolved', 'remediating'].includes(finalStatus)) {
    // Progressed past instant fail — fallback hop reached.
    if (elapsed >= 3_000 || evidenceLen > 2 || rootCause) {
      break;
    }
  }
  if (['awaiting_approval', 'resolved'].includes(finalStatus) && (rootCause || evidenceLen > 2)) {
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

const progressed =
  ['investigating', 'awaiting_approval', 'resolved', 'remediating'].includes(finalStatus) ||
  evidenceLen > 2 ||
  Boolean(rootCause && !/CircuitBreakerOpen/i.test(String(rootCause)));

const failClosedClear =
  finalStatus === 'failed' &&
  /Configure or fix the Investigation LLM|fallbackProfileId chain/i.test(
    `${rootCause} ${earlyFailureDetail}`,
  ) &&
  !/CircuitBreakerOpen/i.test(`${rootCause} ${earlyFailureDetail}`);

out.eval = {
  register_ok: Boolean(token),
  profiles_ok: Boolean(fallbackId && badId),
  activate_ok: activate.ok,
  stub_connect_ok: connect.ok,
  ingest_ok: Boolean(incidentId),
  not_instant_shared_breaker_fail: !earlyFailed,
  investigation_progressed_or_clear_fail_closed: progressed || failClosedClear,
  finalStatus,
  evidenceLen,
  earlyFailed,
};

out.passed = Object.entries(out.eval)
  .filter(([k]) => !['finalStatus', 'evidenceLen', 'earlyFailed'].includes(k))
  .every(([, v]) => Boolean(v));

if (earlyFailed) {
  out.defects = [
    `shared circuit breaker blocked fallback hops: ${earlyFailureDetail.slice(0, 500)}`,
  ];
} else if (!out.passed) {
  out.defects = Object.entries(out.eval)
    .filter(([, v]) => !v && typeof v === 'boolean')
    .map(([k]) => `${k}=false`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(out.passed ? 'AC-018 RUNTIME PASS' : 'AC-018 RUNTIME FAIL');
console.log('wrote', outPath);
process.exit(out.passed ? 0 : 1);
