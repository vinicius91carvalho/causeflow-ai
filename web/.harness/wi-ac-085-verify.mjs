/**
 * AC-085 HTTP verification — edit/delete Investigation LLM profiles with redacted API keys.
 */
import fs from 'node:fs';

const BASE = process.env.AC085_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC085_CORE_URL ?? 'http://127.0.0.1:3099';
const email = `ac085-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const secretKey = `sk-ac085-${Date.now()}-secret`;
const out = {
  id: 'WI-AC-085',
  base: BASE,
  core: CORE,
  email,
  steps: [],
  pass: false,
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
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, body, text, setCookie };
}

function extractSessionCookie(setCookie) {
  const hit = setCookie.find((c) => c.startsWith('__session='));
  if (!hit) return null;
  return hit.split(';')[0];
}

function leakedRawApiKey(payload, knownSecret) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (serialized.includes('"apiKeyEncrypted"')) return true;
  if (knownSecret && serialized.includes(knownSecret)) return true;
  const apiKeyMatch = serialized.match(/"apiKey"\s*:\s*"([^"]+)"/);
  if (apiKeyMatch && apiKeyMatch[1] && apiKeyMatch[1] !== 'configured' && apiKeyMatch[1] !== 'masked') {
    return true;
  }
  return false;
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC085 Admin', email, password: pass }),
});
out.steps.push({ step: 'register', status: signup.status });
const cookie = extractSessionCookie(signup.setCookie);
if (!cookie) {
  out.steps.push({ step: 'session_cookie', error: 'missing __session' });
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync('.harness/wi-ac-085-http.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
  process.exit(1);
}

const authHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };

const createA = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label: 'AC085 Primary',
    baseUrl: 'http://127.0.0.1:8081/v1',
    model: 'Ornith-1.0-9B-code',
    apiKey: secretKey,
    contextWindowTokens: 32768,
  }),
});
out.steps.push({
  step: 'create_primary',
  status: createA.status,
  leaked: leakedRawApiKey(createA.body, secretKey),
  apiKeyConfigured: createA.body?.apiKeyConfigured,
});
const profileAId = createA.body?.id;

const createB = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label: 'AC085 Secondary',
    baseUrl: 'http://127.0.0.1:8082/v1',
    model: 'backup-model',
  }),
});
out.steps.push({ step: 'create_secondary', status: createB.status });
const profileBId = createB.body?.id;

const listAfterCreate = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
out.steps.push({
  step: 'list_after_create',
  status: listAfterCreate.status,
  count: listAfterCreate.body?.items?.length ?? 0,
  leaked: leakedRawApiKey(listAfterCreate.body, secretKey),
});

const patch = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileAId)}`,
  {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      label: 'AC085 Primary Updated',
      model: 'Ornith-updated',
      baseUrl: 'http://127.0.0.1:8081/v1',
    }),
  },
);
out.steps.push({
  step: 'patch_primary',
  status: patch.status,
  label: patch.body?.label,
  leaked: leakedRawApiKey(patch.body, secretKey),
});

const listAfterPatch = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const patched = listAfterPatch.body?.items?.find((item) => item.id === profileAId);
out.steps.push({
  step: 'list_after_patch',
  status: listAfterPatch.status,
  patchedLabel: patched?.label,
  leaked: leakedRawApiKey(listAfterPatch.body, secretKey),
});

const del = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileBId)}`,
  {
    method: 'DELETE',
    headers: authHeaders,
  },
);
out.steps.push({ step: 'delete_secondary', status: del.status });

const listAfterDelete = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const remainingIds = (listAfterDelete.body?.items ?? []).map((item) => item.id);
out.steps.push({
  step: 'list_after_delete',
  status: listAfterDelete.status,
  remainingIds,
  leaked: leakedRawApiKey(listAfterDelete.body, secretKey),
});

const settingsHtml = await req(`${BASE}/dashboard/settings`, { headers: { Cookie: cookie } });
out.steps.push({
  step: 'settings_html',
  status: settingsHtml.status,
  leakedSecretInHtml: settingsHtml.text.includes(secretKey),
  hasMaskedConfiguredCopy:
    settingsHtml.text.includes('API key configured') ||
    settingsHtml.text.includes('apiKeyConfigured'),
});

out.pass =
  signup.status >= 200 &&
  signup.status < 300 &&
  createA.status === 201 &&
  createB.status === 201 &&
  patch.status === 200 &&
  patch.body?.label === 'AC085 Primary Updated' &&
  del.status === 200 &&
  !remainingIds.includes(profileBId) &&
  remainingIds.includes(profileAId) &&
  !out.steps.some((step) => step.leaked === true) &&
  !out.steps.some((step) => step.leakedSecretInHtml === true) &&
  createA.body?.apiKeyConfigured === true;

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync('.harness/wi-ac-085-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
