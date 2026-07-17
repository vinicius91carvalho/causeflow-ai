/**
 * AC-014 verify-first — edit/delete/activate Investigation LLM profiles;
 * API keys never returned plaintext after save (masked/redacted only).
 */
import fs from 'node:fs';

const BASE = process.env.AC014_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC014_CORE_URL ?? 'http://127.0.0.1:3099';
const email = process.env.AC014_EMAIL ?? `vf-ac014-${Date.now()}@causeflow.local`;
const pass = process.env.AC014_PASS ?? 'TestPass123!';
const labelA = process.env.AC014_LABEL_A ?? `AC014 Profile A ${Date.now()}`;
const labelB = process.env.AC014_LABEL_B ?? `AC014 Profile B ${Date.now()}`;
const labelEdited = process.env.AC014_LABEL_EDITED ?? `AC014 Profile A Edited ${Date.now()}`;
const secretKey = process.env.AC014_API_KEY ?? 'sk-ac014-vf-plaintext-secret-key';
const outPath = process.env.AC014_OUT ?? '.harness/wi-ac-014-verify-first.json';

const out = {
  id: 'WI-AC-014',
  phase: process.env.AC014_PHASE ?? 'verify-first-existing',
  base: BASE,
  core: CORE,
  email,
  labelA,
  labelB,
  labelEdited,
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

function bodyLeaksPlaintextKey(body, key) {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  if (!serialized) return false;
  if (serialized.includes(key)) return true;
  if (/"apiKey"\s*:\s*"(?!configured|masked)[^"]+"/i.test(serialized)) return true;
  if (serialized.includes('"apiKeyEncrypted"')) return true;
  return false;
}

function activeCount(items) {
  return (Array.isArray(items) ? items : []).filter((p) => p?.isActive === true).length;
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC014 VF Admin', email, password: pass }),
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
      tenantName: 'AC014 VF Tenant',
      name: 'AC014 VF Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  token = reg.body?.token;
}
if (!token) throw new Error('no session token after register');
const cookie = `__session=${token}`;

const createA = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    label: labelA,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: secretKey,
  }),
});
out.steps.push({
  step: 'create_profile_a',
  status: createA.status,
  body: createA.body,
  leaks_plaintext: bodyLeaksPlaintextKey(createA.body, secretKey) || bodyLeaksPlaintextKey(createA.text, secretKey),
});
const idA = createA.body?.id;

const createB = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    label: labelB,
    baseUrl: 'http://127.0.0.1:8081/v1',
    model: 'Ornith-1.0-9B-code',
  }),
});
out.steps.push({
  step: 'create_profile_b',
  status: createB.status,
  body: createB.body,
  leaks_plaintext: bodyLeaksPlaintextKey(createB.body, secretKey) || bodyLeaksPlaintextKey(createB.text, secretKey),
});
const idB = createB.body?.id;

const editA = await req(`${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(idA)}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    label: labelEdited,
    model: 'gpt-4o',
    apiKey: `${secretKey}-rotated`,
  }),
});
out.steps.push({
  step: 'edit_profile_a',
  status: editA.status,
  body: editA.body,
  leaks_plaintext:
    bodyLeaksPlaintextKey(editA.body, secretKey) ||
    bodyLeaksPlaintextKey(editA.body, `${secretKey}-rotated`) ||
    bodyLeaksPlaintextKey(editA.text, secretKey) ||
    bodyLeaksPlaintextKey(editA.text, `${secretKey}-rotated`),
});

const activateA = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(idA)}/activate`,
  {
    method: 'POST',
    headers: { Cookie: cookie },
  },
);
out.steps.push({ step: 'activate_profile_a', status: activateA.status, body: activateA.body });

const listAfterActivateA = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({
  step: 'list_after_activate_a',
  status: listAfterActivateA.status,
  body: listAfterActivateA.body,
  leaks_plaintext:
    bodyLeaksPlaintextKey(listAfterActivateA.body, secretKey) ||
    bodyLeaksPlaintextKey(listAfterActivateA.body, `${secretKey}-rotated`) ||
    bodyLeaksPlaintextKey(listAfterActivateA.text, secretKey) ||
    bodyLeaksPlaintextKey(listAfterActivateA.text, `${secretKey}-rotated`),
});

const activateB = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(idB)}/activate`,
  {
    method: 'POST',
    headers: { Cookie: cookie },
  },
);
out.steps.push({ step: 'activate_profile_b', status: activateB.status, body: activateB.body });

const listAfterActivateB = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({
  step: 'list_after_activate_b',
  status: listAfterActivateB.status,
  body: listAfterActivateB.body,
  leaks_plaintext:
    bodyLeaksPlaintextKey(listAfterActivateB.body, secretKey) ||
    bodyLeaksPlaintextKey(listAfterActivateB.body, `${secretKey}-rotated`) ||
    bodyLeaksPlaintextKey(listAfterActivateB.text, secretKey) ||
    bodyLeaksPlaintextKey(listAfterActivateB.text, `${secretKey}-rotated`),
});

const deleteA = await req(
  `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(idA)}`,
  {
    method: 'DELETE',
    headers: { Cookie: cookie },
  },
);
out.steps.push({ step: 'delete_profile_a', status: deleteA.status, body: deleteA.body });

const listAfterDelete = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
out.steps.push({
  step: 'list_after_delete_a',
  status: listAfterDelete.status,
  body: listAfterDelete.body,
  leaks_plaintext:
    bodyLeaksPlaintextKey(listAfterDelete.body, secretKey) ||
    bodyLeaksPlaintextKey(listAfterDelete.body, `${secretKey}-rotated`) ||
    bodyLeaksPlaintextKey(listAfterDelete.text, secretKey) ||
    bodyLeaksPlaintextKey(listAfterDelete.text, `${secretKey}-rotated`),
});

const coreList = await req(`${CORE}/v1/oss/investigation-llm-profiles`, {
  headers: { Authorization: `Bearer ${token}` },
});
out.steps.push({
  step: 'core_list_direct',
  status: coreList.status,
  body: coreList.body,
  leaks_plaintext:
    bodyLeaksPlaintextKey(coreList.body, secretKey) ||
    bodyLeaksPlaintextKey(coreList.body, `${secretKey}-rotated`) ||
    bodyLeaksPlaintextKey(coreList.text, secretKey) ||
    bodyLeaksPlaintextKey(coreList.text, `${secretKey}-rotated`),
});

const itemsActivateA = Array.isArray(listAfterActivateA.body?.items)
  ? listAfterActivateA.body.items
  : [];
const itemsActivateB = Array.isArray(listAfterActivateB.body?.items)
  ? listAfterActivateB.body.items
  : [];
const itemsAfterDelete = Array.isArray(listAfterDelete.body?.items)
  ? listAfterDelete.body.items
  : [];
const coreItems = Array.isArray(coreList.body?.items) ? coreList.body.items : [];
const foundEdited = itemsActivateA.find((p) => p.id === idA);
const foundBActive = itemsActivateB.find((p) => p.id === idB);
const foundAAfterSwitch = itemsActivateB.find((p) => p.id === idA);
const deletedGone = !itemsAfterDelete.some((p) => p.id === idA);
const coreB = coreItems.find((p) => p.id === idB);

out.eval = {
  register_ok: Boolean(token),
  create_a_ok: createA.status === 201 && Boolean(idA),
  create_b_ok: createB.status === 201 && Boolean(idB),
  create_a_api_key_configured: createA.body?.apiKeyConfigured === true,
  create_a_no_plaintext: createA.status === 201 && !out.steps.find((s) => s.step === 'create_profile_a')?.leaks_plaintext,
  edit_ok:
    editA.status === 200 &&
    editA.body?.label === labelEdited &&
    editA.body?.model === 'gpt-4o',
  edit_api_key_configured: editA.body?.apiKeyConfigured === true,
  edit_no_plaintext: editA.status === 200 && !out.steps.find((s) => s.step === 'edit_profile_a')?.leaks_plaintext,
  activate_a_ok:
    activateA.status === 200 &&
    (activateA.body?.activeProfileId === idA || activateA.body?.profile?.id === idA),
  exactly_one_active_after_a:
    listAfterActivateA.status === 200 &&
    listAfterActivateA.body?.activeProfileId === idA &&
    activeCount(itemsActivateA) === 1 &&
    foundEdited?.isActive === true,
  activate_b_ok:
    activateB.status === 200 &&
    (activateB.body?.activeProfileId === idB || activateB.body?.profile?.id === idB),
  exactly_one_active_after_b:
    listAfterActivateB.status === 200 &&
    listAfterActivateB.body?.activeProfileId === idB &&
    activeCount(itemsActivateB) === 1 &&
    foundBActive?.isActive === true &&
    foundAAfterSwitch?.isActive === false,
  delete_inactive_ok: deleteA.status === 200 && deletedGone,
  list_after_no_plaintext: !out.steps.find((s) => s.step === 'list_after_activate_b')?.leaks_plaintext,
  core_direct_no_plaintext: !out.steps.find((s) => s.step === 'core_list_direct')?.leaks_plaintext,
  core_exactly_one_active:
    coreList.status === 200 &&
    coreList.body?.activeProfileId === idB &&
    activeCount(coreItems) === 1 &&
    coreB?.isActive === true,
};

out.ac014_pass = Object.values(out.eval).every(Boolean);
out.defects = [];
if (!out.ac014_pass) {
  for (const [key, ok] of Object.entries(out.eval)) {
    if (!ok) out.defects.push(`${key}=false`);
  }
}

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.ac014_pass ? 0 : 1);
