/**
 * AC-087 HTTP verification — Ornith local/API example presets prefill create form.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.AC087_BASE_URL ?? 'http://127.0.0.1:5170';
const email = `ac087-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = {
  id: 'WI-AC-087',
  base: BASE,
  email,
  steps: [],
  pass: false,
};

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
  body: JSON.stringify({ name: 'AC087 Admin', email, password: pass }),
});
out.steps.push({ step: 'register', status: signup.status });
const cookie = extractSessionCookie(signup.setCookie);
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
out.steps.push({
  step: 'example_presets_api',
  status: presetsApi.status,
  count: presetItems.length,
  localPreset,
  apiPreset,
  hasLocalDefaults:
    localPreset?.baseUrl === ORNITH_LOCAL.baseUrl &&
    localPreset?.model === ORNITH_LOCAL.model &&
    localPreset?.contextWindowTokens === ORNITH_LOCAL.contextWindowTokens,
  hasApiDefaults:
    apiPreset?.baseUrl === ORNITH_API.baseUrl &&
    apiPreset?.model === ORNITH_API.model &&
    apiPreset?.contextWindowTokens === ORNITH_API.contextWindowTokens &&
    apiPreset?.baseUrl.startsWith('https://'),
});

const settingsHtml = await req(`${BASE}/dashboard/settings`, { headers: authHeaders });
out.steps.push({
  step: 'settings_html',
  status: settingsHtml.status,
  hasProfilesCard: settingsHtml.text.includes('investigation-llm-profiles-card'),
  hasExamplePresetsCopy: settingsHtml.text.includes('examplePresets'),
  hasThreeProviderCatalogOnly: /deepseek-opencode.*deepseek-nim/i.test(settingsHtml.text),
});

let unitTestsExit = 1;
try {
  execSync(
    'pnpm vitest run --project dashboard apps/dashboard/src/contexts/settings/domain/investigation-llm-profile-presets.test.ts apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.test.tsx',
    { cwd: process.cwd(), stdio: 'pipe' },
  );
  unitTestsExit = 0;
} catch (error) {
  unitTestsExit = error.status ?? 1;
}
out.steps.push({ step: 'unit_tests', exitCode: unitTestsExit });

out.pass =
  signup.status >= 200 &&
  signup.status < 300 &&
  presetsApi.status === 200 &&
  presetItems.length === 2 &&
  out.steps.find((s) => s.step === 'example_presets_api')?.hasLocalDefaults === true &&
  out.steps.find((s) => s.step === 'example_presets_api')?.hasApiDefaults === true &&
  settingsHtml.status === 200 &&
  out.steps.find((s) => s.step === 'settings_html')?.hasProfilesCard === true &&
  out.steps.find((s) => s.step === 'settings_html')?.hasExamplePresetsCopy === true &&
  out.steps.find((s) => s.step === 'settings_html')?.hasThreeProviderCatalogOnly !== true &&
  unitTestsExit === 0;

writeOut();
process.exit(out.pass ? 0 : 1);

function writeOut() {
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync('.harness/wi-ac-087-http.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
