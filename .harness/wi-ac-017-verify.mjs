#!/usr/bin/env node
/**
 * WI-AC-017 / AC-017 grep audit (observation_method: grep).
 *
 * (web + core) Active Investigation LLM profile cannot be deleted until another
 * is activated; clear error otherwise.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const outPath = process.env.AC017_OUT ?? path.join(ROOT, '.harness/wi-ac-017-verify-first.json');

function rg(pattern, file) {
  try {
    return execSync(`rg -n ${JSON.stringify(pattern)} ${JSON.stringify(file)}`, {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function assert(cond, msg, evidence) {
  if (!cond) {
    console.error('FAIL:', msg);
    if (evidence) console.error(evidence);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

const coreRoutes = 'core/src/modules/oss/infra/oss-investigation-llm-profiles.routes.ts';
const uiCard =
  'web/apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.tsx';
const enI18n = 'web/apps/dashboard/src/contexts/settings/infrastructure/i18n/en.json';
const ptI18n = 'web/apps/dashboard/src/contexts/settings/infrastructure/i18n/pt-br.json';
const bffDelete =
  'web/apps/dashboard/src/contexts/settings/api/investigation-llm-profile-id-handler.ts';
const coreTest = 'core/tests/unit/modules/oss/oss-investigation-llm-profiles.routes.test.ts';
const uiTest =
  'web/apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.test.tsx';

const coreSrc = fs.readFileSync(path.join(ROOT, coreRoutes), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, uiCard), 'utf8');
const enSrc = fs.readFileSync(path.join(ROOT, enI18n), 'utf8');
const ptSrc = fs.readFileSync(path.join(ROOT, ptI18n), 'utf8');
const bffSrc = fs.readFileSync(path.join(ROOT, bffDelete), 'utf8');
const coreTestSrc = fs.readFileSync(path.join(ROOT, coreTest), 'utf8');
const uiTestSrc = fs.readFileSync(path.join(ROOT, uiTest), 'utf8');

const checks = [];

function check(name, cond, evidence) {
  checks.push({ name, pass: Boolean(cond), evidence: evidence || undefined });
  assert(cond, name, evidence);
}

check(
  'core DELETE compares activeProfileId === profileId before delete',
  /getActiveInvestigationLlmProfileId\(tenantId\)/.test(coreSrc) &&
    /if \(activeProfileId === profileId\)/.test(coreSrc),
  rg('activeProfileId === profileId', coreRoutes),
);

check(
  'core DELETE returns 409 with clear Activate-another-profile error',
  /ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR/.test(coreSrc) &&
    /Cannot delete the active Investigation LLM profile\. Activate another profile first\./.test(
      coreSrc,
    ) &&
    /return c\.json\(\{ error: ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR \}, 409\)/.test(
      coreSrc,
    ),
  rg('ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR', coreRoutes),
);

check(
  'web UI handleDelete guards active profile with clear toast error',
  /function isProfileActive/.test(uiSrc) &&
    /if \(isProfileActive\(profile\)\)/.test(uiSrc) &&
    /t\('errorDeleteActive'\)/.test(uiSrc),
  rg('errorDeleteActive', uiCard),
);

check(
  'web UI disables delete for active profile (data-delete-blocked)',
  /disabled=\{deletingId === profile\.id \|\| isActive\}/.test(uiSrc) &&
    /data-delete-blocked=\{isActive \? 'active-profile' : undefined\}/.test(uiSrc) &&
    /t\('deleteActiveHint'\)/.test(uiSrc),
  rg('data-delete-blocked', uiCard),
);

check(
  'EN + PT-BR clear errorDeleteActive copy',
  /"errorDeleteActive":\s*"Cannot delete the active Investigation LLM profile\. Activate another profile first\."/.test(
    enSrc,
  ) &&
    /"errorDeleteActive":\s*"Não é possível excluir o perfil de LLM de investigação ativo\. Ative outro perfil primeiro\."/.test(
      ptSrc,
    ),
  rg('errorDeleteActive', enI18n),
);

check(
  'web BFF DELETE proxies to Core profile id path (preserves Core 409)',
  /proxyToCore\(\s*'DELETE'/.test(bffSrc) &&
    /CORE_INVESTIGATION_LLM_PROFILES_PATH/.test(bffSrc),
  rg("proxyToCore", bffDelete),
);

check(
  'unit source audits cover active-delete guard (core + web)',
  /blocks deleting the active profile with a clear 409 error/.test(coreTestSrc) &&
    /ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR/.test(coreTestSrc) &&
    /blocks deleting the active profile in the UI with a clear error/.test(uiTestSrc) &&
    /errorDeleteActive/.test(uiTestSrc),
  rg('active profile', coreTest),
);

const pass = checks.every((c) => c.pass);
const out = {
  id: 'WI-AC-017',
  phase: 'verify-first',
  acceptance_check_id: 'AC-017',
  observation_method: 'grep',
  description:
    '(web + core) Active profile cannot be deleted until another is activated; clear error otherwise.',
  ac017_pass: pass,
  checks: checks.map((c) => ({
    id: c.name,
    pass: c.pass,
    evidence: c.evidence || undefined,
  })),
  defects: pass ? [] : checks.filter((c) => !c.pass).map((c) => c.name),
  product_diff: false,
  notes: pass
    ? 'VERIFY-FIRST grep/static audit only (feature_list observation_method=grep). No server/browser started. Existing Core DELETE 409 guard + web UI active-delete block already satisfy AC-017.'
    : 'One or more AC-017 grep checks failed.',
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
