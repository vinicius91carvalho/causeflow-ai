/**
 * AC-019 verify-first — missing required profile fields rejected;
 * optional API key may be omitted for local Ornith; soft connectivity probe
 * does not block save/activate when endpoint is temporarily down.
 */
import fs from 'node:fs';

const BASE = process.env.AC019_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC019_CORE_URL ?? 'http://127.0.0.1:3099';
const email = process.env.AC019_EMAIL ?? `vf-ac019-${Date.now()}@causeflow.local`;
const pass = process.env.AC019_PASS ?? 'TestPass123!';
const label = process.env.AC019_LABEL ?? `AC019 Ornith Soft ${Date.now()}`;
// Intentionally unreachable — soft probe must not block save/activate.
const downBaseUrl =
  process.env.AC019_DOWN_BASE_URL ?? 'http://127.0.0.1:1/v1';
const outPath = process.env.AC019_OUT ?? '.harness/wi-ac-019-verify-first.json';

const out = {
  id: 'WI-AC-019',
  phase: process.env.AC019_PHASE ?? 'verify-first-existing',
  acceptance_check_id: 'AC-019',
  observation_method: 'http',
  base: BASE,
  core: CORE,
  email,
  label,
  downBaseUrl,
  steps: [],
  pass: false,
  defects: [],
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
  const setCookie =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
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

function writeOut() {
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
}

function isValidationReject(status, body, text) {
  if (status < 400 || status >= 500) return false;
  const serialized =
    typeof body === 'string' ? body : JSON.stringify(body ?? {}) + String(text ?? '');
  return /required|validation|invalid|baseUrl|label|model/i.test(serialized);
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC019 VF Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status, body: signup.body });

let cookie = extractSessionCookie(signup.setCookie, signup.headers);
if (!cookie && signup.body?.token) cookie = `__session=${signup.body.token}`;
if (!cookie) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC019 VF Tenant',
      name: 'AC019 VF Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  if (reg.body?.token) cookie = `__session=${reg.body.token}`;
}
if (!cookie) {
  out.defects.push('expected session cookie after register; observed missing token');
  writeOut();
  process.exit(1);
}
const authHeaders = { 'Content-Type': 'application/json', Cookie: cookie };

// --- Step 1/2: missing required fields → validation errors, no persist ---
const missingCases = [
  { name: 'missing_label', body: { baseUrl: 'http://127.0.0.1:8081/v1', model: 'Ornith-1.0-9B-code' } },
  { name: 'missing_baseUrl', body: { label: `${label}-missing-base`, model: 'Ornith-1.0-9B-code' } },
  { name: 'missing_model', body: { label: `${label}-missing-model`, baseUrl: 'http://127.0.0.1:8081/v1' } },
  { name: 'empty_required', body: { label: '', baseUrl: '', model: '' } },
];

let validationPass = true;
for (const c of missingCases) {
  const res = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(c.body),
  });
  const ok = isValidationReject(res.status, res.body, res.text);
  out.steps.push({
    step: `reject_${c.name}`,
    status: res.status,
    body: res.body,
    validation_reject: ok,
  });
  if (!ok) {
    validationPass = false;
    out.defects.push(
      `expected validation error for ${c.name}; observed status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
}

const listAfterReject = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
const itemsAfterReject = listAfterReject.body?.items ?? [];
const leakedInvalid = itemsAfterReject.filter(
  (p) =>
    typeof p?.label === 'string' &&
    (p.label.includes('missing-base') ||
      p.label.includes('missing-model') ||
      p.label === '' ||
      !p.baseUrl ||
      !p.model),
);
out.steps.push({
  step: 'list_after_rejects',
  status: listAfterReject.status,
  count: itemsAfterReject.length,
  leaked_invalid_count: leakedInvalid.length,
});
if (leakedInvalid.length > 0) {
  validationPass = false;
  out.defects.push(
    `expected no invalid persistence after validation rejects; observed ${leakedInvalid.length} leaked items`,
  );
}

// --- Step 3: omit apiKey for local Ornith with unreachable endpoint; save + activate ---
const createSoft = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    label,
    baseUrl: downBaseUrl,
    model: 'Ornith-1.0-9B-code',
    contextWindowTokens: 32768,
    // apiKey intentionally omitted
  }),
});
const createOk = createSoft.status === 201 && createSoft.body?.id && !createSoft.body?.apiKey;
out.steps.push({
  step: 'create_ornith_no_api_key_unreachable',
  status: createSoft.status,
  body: createSoft.body,
  apiKeyConfigured: createSoft.body?.apiKeyConfigured ?? null,
  ok: createOk,
});
if (!createOk) {
  out.defects.push(
    `expected save without apiKey against unreachable endpoint (201); observed status=${createSoft.status} body=${JSON.stringify(createSoft.body)}`,
  );
}

const profileId = createSoft.body?.id;
let activateOk = false;
if (profileId) {
  const activate = await req(
    `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileId)}/activate`,
    { method: 'POST', headers: authHeaders, body: '{}' },
  );
  activateOk =
    activate.status === 200 &&
    (activate.body?.activeProfileId === profileId || activate.body?.profile?.isActive === true);
  out.steps.push({
    step: 'activate_unreachable_soft_probe',
    status: activate.status,
    body: activate.body,
    ok: activateOk,
  });
  if (!activateOk) {
    out.defects.push(
      `expected activate without live connectivity probe (200); observed status=${activate.status} body=${JSON.stringify(activate.body)}`,
    );
  }
} else {
  out.defects.push('expected profile id from soft create; observed missing id');
}

const listFinal = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
  headers: { Cookie: cookie },
});
const saved = (listFinal.body?.items ?? []).find((p) => p.id === profileId);
out.steps.push({
  step: 'list_confirms_saved_active',
  status: listFinal.status,
  saved: saved
    ? {
        id: saved.id,
        label: saved.label,
        baseUrl: saved.baseUrl,
        model: saved.model,
        apiKeyConfigured: saved.apiKeyConfigured,
        isActive: saved.isActive,
      }
    : null,
  activeProfileId: listFinal.body?.activeProfileId ?? null,
});

const softPass =
  createOk &&
  activateOk &&
  saved &&
  saved.baseUrl === downBaseUrl &&
  saved.apiKeyConfigured === false &&
  (saved.isActive === true || listFinal.body?.activeProfileId === profileId);

out.pass = validationPass && softPass;
out.notes = out.pass
  ? 'AC-019 passes at HTTP boundary: BFF/Core reject missing required fields; Ornith-style profile saves without apiKey; save+activate succeed against unreachable baseUrl (soft probe).'
  : `AC-019 failed: ${out.defects.join(' | ')}`;

writeOut();
if (!out.pass) {
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ pass: true, outPath, profileId, defects: out.defects }, null, 2));
