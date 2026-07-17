/**
 * AC-013 verify-first — create Investigation LLM profile via Settings BFF + Core persist.
 */
import fs from 'node:fs';

const BASE = process.env.AC013_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC013_CORE_URL ?? 'http://127.0.0.1:3099';
const email = process.env.AC013_EMAIL ?? `vf-ac013-${Date.now()}@causeflow.local`;
const pass = process.env.AC013_PASS ?? 'TestPass123!';
const profileLabel = process.env.AC013_LABEL ?? `AC013 VF Profile ${Date.now()}`;
const fallbackLabel = process.env.AC013_FALLBACK_LABEL ?? `AC013 Fallback ${Date.now()}`;
const outPath = process.env.AC013_OUT ?? '.harness/wi-ac-013-verify-first.json';

const out = {
  id: 'WI-AC-013',
  phase: process.env.AC013_PHASE ?? 'verify-first-existing',
  base: BASE,
  core: CORE,
  email,
  profileLabel,
  fallbackLabel,
  steps: [],
};

async function req(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', ...opts });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    status: res.status,
    body,
    headers: Object.fromEntries(res.headers.entries()),
    text,
  };
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC013 VF Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status, body: signup.body });

const setCookie = signup.headers['set-cookie'] ?? '';
let token = setCookie.match(/__session=([^;]+)/)?.[1];
if (!token && signup.body?.token) token = signup.body.token;
if (!token) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC013 VF Tenant',
      name: 'AC013 VF Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  token = reg.body?.token;
}
if (!token) throw new Error('no session token after register');
const cookie = `__session=${token}`;

const settings = await req(`${BASE}/dashboard/settings`, { headers: { Cookie: cookie } });
const settingsHtml = typeof settings.body === 'string' ? settings.body : settings.text;
out.steps.push({
  step: 'settings_page',
  status: settings.status,
  has_card_marker:
    settingsHtml.includes('investigation-llm') ||
    settingsHtml.includes('Investigation LLM') ||
    settingsHtml.includes('investigationLlm'),
});

const fallbackCreate = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    label: fallbackLabel,
    baseUrl: 'http://127.0.0.1:8081/v1',
    model: 'Ornith-1.0-9B-code',
  }),
});
out.steps.push({
  step: 'create_fallback_profile',
  status: fallbackCreate.status,
  body: fallbackCreate.body,
});
const fallbackId = fallbackCreate.body?.id;

const createPayload = {
  label: profileLabel,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: 'sk-ac013-vf-test-key',
  contextWindowTokens: 128000,
  fallbackProfileId: fallbackId,
};
const create = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify(createPayload),
});
out.steps.push({
  step: 'create_profile_with_fallback',
  status: create.status,
  body: create.body,
});
const createdId = create.body?.id;

const listAfter = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'list_after', status: listAfter.status, body: listAfter.body });

const listReload = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'list_reload', status: listReload.status, body: listReload.body });

const coreList = await req(`${CORE}/v1/oss/investigation-llm-profiles`, {
  headers: { Authorization: `Bearer ${token}` },
});
out.steps.push({ step: 'core_list_direct', status: coreList.status, body: coreList.body });

const itemsAfter = Array.isArray(listAfter.body?.items) ? listAfter.body.items : [];
const itemsReload = Array.isArray(listReload.body?.items) ? listReload.body.items : [];
const coreItems = Array.isArray(coreList.body?.items) ? coreList.body.items : [];
const foundAfter = itemsAfter.find((p) => p.id === createdId || p.label === profileLabel);
const foundReload = itemsReload.find((p) => p.id === createdId || p.label === profileLabel);
const foundCore = coreItems.find((p) => p.id === createdId || p.label === profileLabel);

out.eval = {
  register_ok: Boolean(token),
  settings_reachable: [200, 307, 308].includes(settings.status),
  fallback_create_ok: fallbackCreate.status === 201 && Boolean(fallbackId),
  create_ok: create.status === 201,
  create_has_required_fields:
    create.body?.label === profileLabel &&
    create.body?.baseUrl === createPayload.baseUrl &&
    create.body?.model === createPayload.model,
  create_has_optional_api_key: create.body?.apiKeyConfigured === true,
  create_has_context_window: create.body?.contextWindowTokens === createPayload.contextWindowTokens,
  create_has_fallback_profile_id: create.body?.fallbackProfileId === fallbackId,
  list_after_contains_profile: Boolean(foundAfter),
  list_reload_persists: Boolean(foundReload),
  list_reload_has_fallback: foundReload?.fallbackProfileId === fallbackId,
  core_direct_contains_profile: Boolean(foundCore),
  core_direct_has_fallback: foundCore?.fallbackProfileId === fallbackId,
};

out.ac013_pass = Object.values(out.eval).every(Boolean);
out.defects = [];
if (!out.ac013_pass) {
  for (const [key, ok] of Object.entries(out.eval)) {
    if (!ok) out.defects.push(`${key}=false`);
  }
}

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.ac013_pass ? 0 : 1);
