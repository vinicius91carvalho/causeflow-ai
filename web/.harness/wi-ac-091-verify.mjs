/**
 * AC-091 HTTP verification — invalid profile fields rejected; optional API key;
 * save/activate succeed even when LLM endpoint is unreachable (no blocking probe).
 */
import fs from 'node:fs';

const BASE = process.env.AC091_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC091_CORE_URL ?? 'http://127.0.0.1:3099';
const email = `ac091-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const unreachableBaseUrl = 'http://127.0.0.1:59999/v1';

const out = {
  id: 'WI-AC-091',
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

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC091 Admin', email, password: pass }),
});
out.steps.push({ step: 'register', status: signup.status });
const cookie = extractSessionCookie(signup.setCookie);
if (!cookie) {
  out.steps.push({ step: 'session_cookie', error: 'missing __session' });
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync('.harness/wi-ac-091-http.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

const authHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };

const listBefore = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const countBefore = listBefore.body?.items?.length ?? 0;
out.steps.push({ step: 'list_before', status: listBefore.status, count: countBefore });

const createInvalid = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ label: 'Missing fields profile' }),
});
out.steps.push({
  step: 'create_missing_required',
  status: createInvalid.status,
  error: createInvalid.body?.error,
});

const listAfterInvalidCreate = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const countAfterInvalidCreate = listAfterInvalidCreate.body?.items?.length ?? 0;
out.steps.push({
  step: 'list_after_invalid_create',
  status: listAfterInvalidCreate.status,
  count: countAfterInvalidCreate,
  noPartialPersist: countAfterInvalidCreate === countBefore,
});

const createValidUnreachable = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label: 'AC091 Local Ornith (no key, unreachable)',
    baseUrl: unreachableBaseUrl,
    model: 'Ornith-1.0-9B-code',
  }),
});
out.steps.push({
  step: 'create_valid_no_api_key_unreachable',
  status: createValidUnreachable.status,
  id: createValidUnreachable.body?.id,
  apiKeyConfigured: createValidUnreachable.body?.apiKeyConfigured,
});
const profileId = createValidUnreachable.body?.id;

const patchInvalid = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileId)}`,
  {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ label: '   ' }),
  },
);
out.steps.push({
  step: 'patch_empty_label',
  status: patchInvalid.status,
  error: patchInvalid.body?.error,
});

const listAfterInvalidPatch = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const unchanged = listAfterInvalidPatch.body?.items?.find((item) => item.id === profileId);
out.steps.push({
  step: 'list_after_invalid_patch',
  status: listAfterInvalidPatch.status,
  labelUnchanged: unchanged?.label === 'AC091 Local Ornith (no key, unreachable)',
});

const activateUnreachable = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileId)}/activate`,
  { method: 'POST', headers: authHeaders },
);
out.steps.push({
  step: 'activate_unreachable_endpoint',
  status: activateUnreachable.status,
  activeProfileId: activateUnreachable.body?.activeProfileId,
});

out.pass =
  signup.status >= 200 &&
  signup.status < 300 &&
  createInvalid.status === 400 &&
  typeof createInvalid.body?.error === 'string' &&
  createInvalid.body.error.length > 0 &&
  countAfterInvalidCreate === countBefore &&
  createValidUnreachable.status === 201 &&
  createValidUnreachable.body?.apiKeyConfigured === false &&
  patchInvalid.status === 400 &&
  typeof patchInvalid.body?.error === 'string' &&
  unchanged?.label === 'AC091 Local Ornith (no key, unreachable)' &&
  activateUnreachable.status === 200 &&
  activateUnreachable.body?.activeProfileId === profileId;

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync('.harness/wi-ac-091-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
