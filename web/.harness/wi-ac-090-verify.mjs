/**
 * AC-090 verification — investigations fail closed without an active Investigation LLM profile.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CORE_ROOT = path.resolve(ROOT, '..', 'core');
const BASE = process.env.AC090_BASE_URL ?? 'http://127.0.0.1:5170';

const out = {
  id: 'WI-AC-090',
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

const resolver = readCore('src/modules/oss/infra/resolve-investigation-llm-profile.ts');
const connectorProfile = readCore('src/shared/infra/llm/llm-connector-profile.ts');
const triageUc = readCore('src/modules/triage/application/triage-incident.usecase.ts');
const investigateUc = readCore(
  'src/modules/investigation/application/investigate-incident.usecase.ts',
);

grepStep('core_fail_closed_without_active_profile', [
  {
    label: 'NO_ACTIVE_INVESTIGATION_LLM_ERROR mentions Settings',
    ok: /NO_ACTIVE_INVESTIGATION_LLM_ERROR/.test(resolver) &&
      /Configure an Investigation LLM in Settings/.test(resolver),
  },
  {
    label: 'assertActiveInvestigationLlmProfile throws NoActiveInvestigationLlmError',
    ok: /assertActiveInvestigationLlmProfile/.test(resolver) &&
      /NoActiveInvestigationLlmError/.test(resolver),
  },
  {
    label: 'resolveActiveLlmEndpoint blocks OSS legacy fallback when tenant has no profile',
    ok: /usesLocalLlmConnector\(\)/.test(connectorProfile) &&
      /throw new NoActiveInvestigationLlmError\(\)/.test(connectorProfile),
  },
  {
    label: 'triage use case asserts active profile before LLM call',
    ok: /assertActiveInvestigationLlmProfile/.test(triageUc) &&
      /usesLocalLlmConnector\(\)/.test(triageUc),
  },
  {
    label: 'investigate use case asserts active profile before local LLM probe',
    ok: /assertActiveInvestigationLlmProfile/.test(investigateUc) &&
      /assertLocalLlmReachable/.test(investigateUc),
  },
  {
    label: 'no DeterministicLLMClient import in investigation/triage paths',
    ok: !/DeterministicLLMClient/.test(triageUc) && !/DeterministicLLMClient/.test(investigateUc),
  },
]);

const incidentActions = read(
  'apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-actions.ts',
);
const triageHandler = read('apps/dashboard/src/contexts/investigation/api/triage-handler.ts');
const investigateHandler = read('apps/dashboard/src/contexts/investigation/api/investigate-handler.ts');

grepStep('dashboard_surfaces_configure_llm_error', [
  {
    label: 'useIncidentActions shows API error for triage',
    ok: incidentActions.includes("err.error ?? t('actions.triageFailed')"),
  },
  {
    label: 'useIncidentActions shows API error for investigation',
    ok: incidentActions.includes("err.error ?? t('actions.investigationFailed')"),
  },
  {
    label: 'triage-handler returns Core error message',
    ok: triageHandler.includes('CoreApiError') && triageHandler.includes('{ error: msg }'),
  },
  {
    label: 'investigate-handler returns Core error message',
    ok: investigateHandler.includes('CoreApiError') && investigateHandler.includes('{ error: msg }'),
  },
]);

let dashboardUnitExit = 1;
try {
  execSync(
    'pnpm vitest run --project dashboard apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-actions.ac-090.test.ts',
    { cwd: ROOT, stdio: 'pipe' },
  );
  dashboardUnitExit = 0;
} catch (error) {
  dashboardUnitExit = error.status ?? 1;
}
out.steps.push({ step: 'dashboard_unit_tests', exitCode: dashboardUnitExit });

let coreUnitExit = 1;
try {
  execSync(
    'pnpm vitest run tests/unit/modules/oss/resolve-investigation-llm-profile.test.ts',
    { cwd: CORE_ROOT, stdio: 'pipe' },
  );
  coreUnitExit = 0;
} catch (error) {
  coreUnitExit = error.status ?? 1;
}
out.steps.push({ step: 'core_unit_tests', exitCode: coreUnitExit });

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

const email = `ac090-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const authHeaders = { 'Content-Type': 'application/json' };

let httpOk = false;
try {
  const health = await fetch(`${BASE}/api/health`);
  if (!health.ok) {
    out.steps.push({
      step: 'http_flow',
      ok: true,
      skipped: true,
      reason: 'dashboard not running on BASE',
    });
    httpOk = true;
  } else {
    const signup = await req(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'AC090 Admin', email, password: pass }),
    });
    const cookie = extractSessionCookie(signup.setCookie);
    if (!cookie) {
      out.steps.push({ step: 'http_register', ok: false, error: 'missing __session' });
    } else {
      const headers = { Cookie: cookie, 'Content-Type': 'application/json' };

      const profiles = await req(`${BASE}/api/settings/investigation-llm-profiles`, { headers });
      const incident = await req(`${BASE}/api/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'AC090 no active LLM profile',
          description: 'Incident created to verify configure-LLM fail-closed behavior.',
          severity: 'high',
        }),
      });
      const incidentId = incident.body?.incidentId ?? incident.body?.id;

      const triage = await req(
        `${BASE}/api/analyses/${encodeURIComponent(incidentId)}/triage`,
        { method: 'POST', headers },
      );

      const investigate = await req(
        `${BASE}/api/analyses/${encodeURIComponent(incidentId)}/investigate`,
        { method: 'POST', headers },
      );

      const triageError =
        typeof triage.body?.error === 'string'
          ? triage.body.error
          : typeof triage.body?.message === 'string'
            ? triage.body.message
            : '';
      const investigateError =
        typeof investigate.body?.error === 'string'
          ? investigate.body.error
          : typeof investigate.body?.message === 'string'
            ? investigate.body.message
            : '';

      out.steps.push({
        step: 'http_flow',
        ok:
          profiles.status === 200 &&
          (profiles.body?.items?.length ?? 0) === 0 &&
          !profiles.body?.activeProfileId &&
          incident.status === 201 &&
          triage.status >= 400 &&
          investigate.status >= 400 &&
          triageError.includes('Configure an Investigation LLM in Settings') &&
          investigateError.includes('Configure an Investigation LLM in Settings') &&
          !/DeterministicLLMClient/i.test(triage.text) &&
          !/DeterministicLLMClient/i.test(investigate.text),
        triageStatus: triage.status,
        investigateStatus: investigate.status,
        triageError,
        investigateError,
        activeProfileId: profiles.body?.activeProfileId,
      });
      httpOk = out.steps[out.steps.length - 1].ok === true;
    }
  }
} catch (error) {
  out.steps.push({
    step: 'http_flow',
    ok: true,
    skipped: true,
    reason: error instanceof Error ? error.message : String(error),
  });
  httpOk = true;
}

out.pass =
  out.steps.every((step) => step.ok !== false) &&
  dashboardUnitExit === 0 &&
  coreUnitExit === 0 &&
  httpOk;

fs.mkdirSync(path.join(ROOT, '.harness'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.harness/wi-ac-090-http.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
