/**
 * AC-089 verification — active Investigation LLM profile cannot be deleted until replaced.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CORE_ROOT = path.resolve(ROOT, '..', 'core');
const BASE = process.env.AC089_BASE_URL ?? 'http://127.0.0.1:5170';

const out = {
  id: 'WI-AC-089',
  base: BASE,
  steps: [],
  pass: false,
};

function read(relPath) {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf8');
}

function readCore(relPath) {
  return fs.readFileSync(path.resolve(CORE_ROOT, relPath), 'utf8');
}

function grepStep(name, checks) {
  const failed = checks.filter((check) => !check.ok);
  out.steps.push({
    step: name,
    ok: failed.length === 0,
    checks: checks.map(({ label, ok }) => ({ label, ok })),
  });
  return failed.length === 0;
}

const coreRoutes = readCore('src/modules/oss/infra/oss-investigation-llm-profiles.routes.ts');
grepStep('core_blocks_active_delete', [
  {
    label: 'DELETE checks active profile id',
    ok: /getActiveInvestigationLlmProfileId\(tenantId\)/.test(coreRoutes) &&
      /if \(activeProfileId === profileId\)/.test(coreRoutes),
  },
  {
    label: 'DELETE returns 409 with clear message',
    ok: /ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR/.test(coreRoutes) &&
      /Activate another profile first/.test(coreRoutes) &&
      /409/.test(coreRoutes),
  },
]);

const uiCard = read(
  'apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.tsx',
);
grepStep('ui_blocks_active_delete', [
  {
    label: 'isProfileActive helper',
    ok: uiCard.includes('function isProfileActive'),
  },
  {
    label: 'handleDelete guards active profile',
    ok: uiCard.includes("t('errorDeleteActive')") && uiCard.includes('if (isProfileActive(profile))'),
  },
  {
    label: 'delete button disabled for active profile',
    ok: uiCard.includes('disabled={deletingId === profile.id || isActive}') &&
      uiCard.includes("data-delete-blocked={isActive ? 'active-profile' : undefined}"),
  },
]);

let unitTestsExit = 1;
try {
  execSync(
    'pnpm vitest run --project dashboard apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.test.tsx',
    { cwd: ROOT, stdio: 'pipe' },
  );
  unitTestsExit = 0;
} catch (error) {
  unitTestsExit = error.status ?? 1;
}
out.steps.push({ step: 'dashboard_unit_tests', exitCode: unitTestsExit });

let coreUnitTestsExit = 1;
try {
  execSync(
    'pnpm vitest run tests/unit/modules/oss/oss-investigation-llm-profiles.routes.test.ts',
    { cwd: CORE_ROOT, stdio: 'pipe' },
  );
  coreUnitTestsExit = 0;
} catch (error) {
  coreUnitTestsExit = error.status ?? 1;
}
out.steps.push({ step: 'core_unit_tests', exitCode: coreUnitTestsExit });

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

const email = `ac089-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const authHeaders = { 'Content-Type': 'application/json' };

let httpOk = false;
try {
  const signup = await req(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'AC089 Admin', email, password: pass }),
  });
  const cookie = extractSessionCookie(signup.setCookie);
  if (!cookie) {
    out.steps.push({ step: 'http_register', ok: false, error: 'missing __session' });
  } else {
    const headers = { Cookie: cookie, 'Content-Type': 'application/json' };

    const createA = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        label: 'AC089 Profile A',
        baseUrl: 'http://127.0.0.1:8081/v1',
        model: 'model-a',
      }),
    });
    const profileAId = createA.body?.id;

    const createB = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        label: 'AC089 Profile B',
        baseUrl: 'http://127.0.0.1:8082/v1',
        model: 'model-b',
      }),
    });
    const profileBId = createB.body?.id;

    const activateA = await req(
      `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileAId)}/activate`,
      { method: 'POST', headers },
    );

    const deleteActive = await req(
      `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileAId)}`,
      { method: 'DELETE', headers },
    );

    const listAfterBlockedDelete = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
      headers,
    });

    const activateB = await req(
      `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileBId)}/activate`,
      { method: 'POST', headers },
    );

    const deleteFormerActive = await req(
      `${BASE}/api/settings/investigation-llm-profiles/${encodeURIComponent(profileAId)}`,
      { method: 'DELETE', headers },
    );

    const listAfterDelete = await req(`${BASE}/api/settings/investigation-llm-profiles`, {
      headers,
    });
    const remainingIds = (listAfterDelete.body?.items ?? []).map((item) => item.id);

    out.steps.push({
      step: 'http_flow',
      ok:
        createA.status === 201 &&
        createB.status === 201 &&
        activateA.status === 200 &&
        deleteActive.status === 409 &&
        typeof deleteActive.body?.error === 'string' &&
        deleteActive.body.error.includes('active Investigation LLM profile') &&
        deleteActive.body.error.includes('Activate another profile first') &&
        listAfterBlockedDelete.body?.activeProfileId === profileAId &&
        activateB.status === 200 &&
        deleteFormerActive.status === 200 &&
        !remainingIds.includes(profileAId) &&
        remainingIds.includes(profileBId),
      deleteActiveStatus: deleteActive.status,
      deleteActiveError: deleteActive.body?.error,
      activeAfterBlockedDelete: listAfterBlockedDelete.body?.activeProfileId,
      deleteFormerActiveStatus: deleteFormerActive.status,
      remainingIds,
    });
    httpOk = out.steps[out.steps.length - 1].ok === true;
  }
} catch (error) {
  out.steps.push({
    step: 'http_flow',
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

out.pass =
  out.steps.every((step) => step.ok !== false) &&
  unitTestsExit === 0 &&
  coreUnitTestsExit === 0 &&
  httpOk;

fs.mkdirSync(path.join(ROOT, '.harness'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.harness/wi-ac-089-http.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
