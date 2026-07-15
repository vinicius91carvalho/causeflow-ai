/**
 * AC-086 HTTP verification — activate one Investigation LLM profile and reflect in connector state.
 */
import fs from 'node:fs';

const BASE = process.env.AC086_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC086_CORE_URL ?? 'http://127.0.0.1:3099';
const email = `ac086-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = {
  id: 'WI-AC-086',
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

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC086 Admin', email, password: pass }),
});
out.steps.push({ step: 'register', status: signup.status });
const cookie = extractSessionCookie(signup.setCookie);
if (!cookie) {
  out.steps.push({ step: 'session_cookie', error: 'missing __session' });
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync('.harness/wi-ac-086-http.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
  process.exit(1);
}

const authHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };

const createA = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label: 'AC086 Profile A',
    baseUrl: 'http://127.0.0.1:8081/v1',
    model: 'model-a',
  }),
});
out.steps.push({ step: 'create_a', status: createA.status, id: createA.body?.id });
const profileAId = createA.body?.id;

const createB = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label: 'AC086 Profile B',
    baseUrl: 'http://127.0.0.1:8082/v1',
    model: 'model-b',
  }),
});
out.steps.push({ step: 'create_b', status: createB.status, id: createB.body?.id });
const profileBId = createB.body?.id;

const activateB = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileBId)}/activate`,
  { method: 'POST', headers: authHeaders },
);
out.steps.push({
  step: 'activate_b',
  status: activateB.status,
  activeProfileId: activateB.body?.activeProfileId,
});

const listAfterActivate = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
const activeItems = (listAfterActivate.body?.items ?? []).filter((item) => item.isActive);
out.steps.push({
  step: 'list_after_activate',
  status: listAfterActivate.status,
  activeProfileId: listAfterActivate.body?.activeProfileId,
  activeCount: activeItems.length,
  activeIds: activeItems.map((item) => item.id),
});

const bffConnector = await req(`${BASE}/api/settings/llm-connector`, { headers: { Cookie: cookie } });
out.steps.push({
  step: 'bff_llm_connector',
  status: bffConnector.status,
  activeId: bffConnector.body?.active?.id,
  activeModel: bffConnector.body?.active?.model,
  activeSource: bffConnector.body?.active?.source,
});

const coreConnector = await req(`${CORE}/v1/oss/llm-connector`, {
  headers: { Authorization: `Bearer ${cookie.replace('__session=', '')}` },
});
out.steps.push({
  step: 'core_llm_connector',
  status: coreConnector.status,
  activeId: coreConnector.body?.active?.id,
  activeModel: coreConnector.body?.active?.model,
  activeSource: coreConnector.body?.active?.source,
});

const activateA = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileAId)}/activate`,
  { method: 'POST', headers: authHeaders },
);
out.steps.push({
  step: 'activate_a_switch',
  status: activateA.status,
  activeProfileId: activateA.body?.activeProfileId,
});

const listAfterSwitch = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: authHeaders,
});
out.steps.push({
  step: 'list_after_switch',
  status: listAfterSwitch.status,
  activeProfileId: listAfterSwitch.body?.activeProfileId,
  onlyOneActive:
    (listAfterSwitch.body?.items ?? []).filter((item) => item.isActive).length === 1,
});

const settingsHtml = await req(`${BASE}/dashboard/settings`, { headers: { Cookie: cookie } });
out.steps.push({
  step: 'settings_html',
  status: settingsHtml.status,
  hasActiveBadge: settingsHtml.text.includes('Active') || settingsHtml.text.includes('Ativo'),
  hasProfileBLabel: settingsHtml.text.includes('AC086 Profile B'),
});

out.pass =
  signup.status >= 200 &&
  signup.status < 300 &&
  createA.status === 201 &&
  createB.status === 201 &&
  activateB.status === 200 &&
  activateB.body?.activeProfileId === profileBId &&
  listAfterActivate.status === 200 &&
  listAfterActivate.body?.activeProfileId === profileBId &&
  activeItems.length === 1 &&
  activeItems[0]?.id === profileBId &&
  bffConnector.status === 200 &&
  bffConnector.body?.active?.id === profileBId &&
  bffConnector.body?.active?.model === 'model-b' &&
  bffConnector.body?.active?.source === 'investigation-llm-profile' &&
  !['ornith', 'deepseek-opencode', 'deepseek-nim'].includes(bffConnector.body?.active?.id) &&
  isUuid(bffConnector.body?.active?.id) &&
  activateA.status === 200 &&
  listAfterSwitch.body?.activeProfileId === profileAId &&
  listAfterSwitch.body?.items?.find((item) => item.id === profileAId)?.isActive === true &&
  listAfterSwitch.body?.items?.find((item) => item.id === profileBId)?.isActive !== true;

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync('.harness/wi-ac-086-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
