/**
 * AC-084 Integrated Verification — create Investigation LLM profile via dashboard BFF.
 */
import fs from 'node:fs';

const BASE = process.env.AC084_BASE_URL ?? 'http://localhost:5171';
const CORE = process.env.AC084_CORE_URL ?? 'http://127.0.0.1:3099';
const email = `iv-ac084-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const profileLabel = `AC084 IV Profile ${Date.now()}`;
const out = { base: BASE, core: CORE, email, profileLabel, steps: [] };

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
  };
}

// Step 1: OSS admin sign-up via dashboard BFF
const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC084 IV Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status, body: signup.body });

const setCookie = signup.headers['set-cookie'] ?? '';
const tokenMatch = setCookie.match(/__session=([^;]+)/);
let token = tokenMatch?.[1];
if (!token) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC084 IV Tenant',
      name: 'AC084 IV Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  token = reg.body?.token;
}
if (!token) throw new Error('no session token after register');
const cookie = `__session=${token}`;

// Step 2: initial list (may be empty)
const listBefore = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'list_before', status: listBefore.status, body: listBefore.body });

const createPayload = {
  label: profileLabel,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: 'sk-ac084-iv-test-key',
  contextWindowTokens: 128000,
};

// Step 3: create profile via dashboard BFF (admin-only POST)
const create = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify(createPayload),
});
out.steps.push({ step: 'create_profile', status: create.status, body: create.body });

const createdId = create.body?.id;

// Step 4: list after create — profile must appear
const listAfter = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'list_after', status: listAfter.status, body: listAfter.body });

// Step 5: reload simulation — second GET must still include profile
const listReload = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'list_reload', status: listReload.status, body: listReload.body });

const itemsAfter = Array.isArray(listAfter.body?.items) ? listAfter.body.items : [];
const itemsReload = Array.isArray(listReload.body?.items) ? listReload.body.items : [];
const foundAfter = itemsAfter.find((p) => p.id === createdId || p.label === profileLabel);
const foundReload = itemsReload.find((p) => p.id === createdId || p.label === profileLabel);

// Core direct read (confirms BFF persisted to Core, not mock)
const coreList = await req(`${CORE}/v1/oss/investigation-llm-profiles`, {
  headers: { Authorization: `Bearer ${token}` },
});
out.steps.push({ step: 'core_list_direct', status: coreList.status, body: coreList.body });

const coreItems = Array.isArray(coreList.body?.items) ? coreList.body.items : [];
const foundCore = coreItems.find((p) => p.id === createdId || p.label === profileLabel);

out.eval = {
  register_ok: signup.status === 200 || Boolean(token),
  list_before_ok: listBefore.status === 200,
  create_ok: create.status === 201,
  create_has_required_fields:
    create.body?.label === profileLabel &&
    create.body?.baseUrl === createPayload.baseUrl &&
    create.body?.model === createPayload.model,
  create_has_optional_fields:
    create.body?.apiKeyConfigured === true &&
    create.body?.contextWindowTokens === createPayload.contextWindowTokens,
  create_no_raw_api_key: !('apiKey' in (create.body ?? {})),
  list_after_contains_profile: Boolean(foundAfter),
  list_reload_persists: Boolean(foundReload),
  core_direct_contains_profile: Boolean(foundCore),
};

out.pass = Object.values(out.eval).every(Boolean);
out.defects = [];
if (!out.pass) {
  for (const [key, ok] of Object.entries(out.eval)) {
    if (!ok) {
      out.defects.push(
        `expected ${key}=true; observed false; evidence steps=${JSON.stringify(out.steps.map((s) => s.step))}`,
      );
    }
  }
}

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync('.harness/wi-ac-084-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
