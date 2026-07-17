/**
 * AC-015 verify-first — Ornith (local) and Ornith (API) example presets
 * prefill the create form; helpers, not a locked three-provider enum catalog.
 */
import fs from 'node:fs';

const BASE = process.env.AC015_BASE_URL ?? 'http://127.0.0.1:5170';
const email = process.env.AC015_EMAIL ?? `vf-ac015-${Date.now()}@causeflow.local`;
const pass = process.env.AC015_PASS ?? 'TestPass123!';
const outPath = process.env.AC015_OUT ?? '.harness/wi-ac-015-verify-first.json';

const ORNITH_LOCAL = {
  id: 'ornith-local',
  label: 'Ornith (local)',
  baseUrl: 'http://127.0.0.1:8081/v1',
  model: 'Ornith-1.0-9B-code',
  contextWindowTokens: 32768,
};

const ORNITH_API = {
  id: 'ornith-api',
  label: 'Ornith (API)',
  baseUrl: 'https://your-ornith-host.example.com/v1',
  model: 'Ornith-1.0-9B',
  contextWindowTokens: 262144,
};

const out = {
  id: 'WI-AC-015',
  phase: process.env.AC015_PHASE ?? 'verify-first-existing',
  base: BASE,
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
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return {
    status: res.status,
    body,
    text,
    setCookie,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

function extractSessionCookie(setCookie, headers) {
  const hit = (setCookie ?? []).find((c) => c.startsWith('__session='));
  if (hit) return hit.split(';')[0];
  const raw = headers['set-cookie'] ?? '';
  const m = String(raw).match(/__session=([^;]+)/);
  return m ? `__session=${m[1]}` : null;
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC015 VF Admin', email, password: pass }),
});
out.steps.push({ step: 'register', status: signup.status, body: signup.body });

let cookie = extractSessionCookie(signup.setCookie, signup.headers);
if (!cookie && signup.body?.token) cookie = `__session=${signup.body.token}`;
if (!cookie) {
  out.steps.push({ step: 'session_cookie', error: 'missing __session' });
  writeOut();
  process.exit(1);
}

const authHeaders = { Cookie: cookie };

const presetsApi = await req(`${BASE}/api/settings/investigation-llm-profiles/example-presets`, {
  headers: authHeaders,
});
const presetItems = presetsApi.body?.items ?? [];
const localPreset = presetItems.find((item) => item.id === 'ornith-local');
const apiPreset = presetItems.find((item) => item.id === 'ornith-api');
const hasLocalDefaults =
  localPreset?.label === ORNITH_LOCAL.label &&
  localPreset?.baseUrl === ORNITH_LOCAL.baseUrl &&
  localPreset?.model === ORNITH_LOCAL.model &&
  localPreset?.contextWindowTokens === ORNITH_LOCAL.contextWindowTokens;
const hasApiDefaults =
  apiPreset?.label === ORNITH_API.label &&
  apiPreset?.baseUrl === ORNITH_API.baseUrl &&
  apiPreset?.model === ORNITH_API.model &&
  apiPreset?.contextWindowTokens === ORNITH_API.contextWindowTokens &&
  String(apiPreset?.baseUrl ?? '').startsWith('https://');
out.steps.push({
  step: 'example_presets_api',
  status: presetsApi.status,
  count: presetItems.length,
  localPreset,
  apiPreset,
  hasLocalDefaults,
  hasApiDefaults,
});

const settingsHtml = await req(`${BASE}/dashboard/settings`, { headers: authHeaders });
const html = settingsHtml.text ?? '';
const hasProfilesCard =
  html.includes('investigation-llm-profiles-card') ||
  html.includes('investigation-llm-profile') ||
  html.includes('Investigation LLM');
const hasPresetButtons =
  html.includes('investigation-llm-preset-ornith-local') ||
  html.includes('Ornith (local)');
const hasApiPresetButton =
  html.includes('investigation-llm-preset-ornith-api') || html.includes('Ornith (API)');
const hasExamplePresetsCopy =
  html.includes('examplePresets') ||
  html.includes('Example presets') ||
  html.includes('example-presets') ||
  hasPresetButtons;
const hasThreeProviderCatalogOnly =
  /LlmConnectorId|deepseek-opencode.*deepseek-nim|three.provider/i.test(html) &&
  !hasPresetButtons;
out.steps.push({
  step: 'settings_html',
  status: settingsHtml.status,
  hasProfilesCard,
  hasExamplePresetsCopy,
  hasPresetButtons,
  hasApiPresetButton,
  hasThreeProviderCatalogOnly,
});

// Custom create still accepted (presets are helpers, not the only options).
const customLabel = `AC015 Custom ${Date.now()}`;
const customCreate = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    label: customLabel,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  }),
});
out.steps.push({
  step: 'custom_profile_create',
  status: customCreate.status,
  body: customCreate.body,
  accepted: customCreate.status >= 200 && customCreate.status < 300,
});

out.pass =
  signup.status >= 200 &&
  signup.status < 300 &&
  presetsApi.status === 200 &&
  presetItems.length >= 2 &&
  hasLocalDefaults &&
  hasApiDefaults &&
  settingsHtml.status === 200 &&
  hasProfilesCard &&
  hasExamplePresetsCopy &&
  hasThreeProviderCatalogOnly !== true &&
  out.steps.find((s) => s.step === 'custom_profile_create')?.accepted === true;

writeOut();
process.exit(out.pass ? 0 : 1);

function writeOut() {
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
