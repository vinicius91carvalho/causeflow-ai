/**
 * AC-088 grep/static verification — non-admin cannot mutate Investigation LLM profiles.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CORE_ROOT = path.resolve(ROOT, '..', 'core');

const out = {
  id: 'WI-AC-088',
  steps: [],
  pass: false,
};

function read(relPath) {
  const abs = path.resolve(ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function readCore(relPath) {
  const abs = path.resolve(CORE_ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
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
grepStep('core_mutations_require_admin', [
  {
    label: 'POST create uses requireRole(admin)',
    ok: /routes\.post\('\/',\s*requireRole\('admin'\)/.test(coreRoutes),
  },
  {
    label: 'POST activate uses requireRole(admin)',
    ok: /routes\.post\('\/:id\/activate',\s*requireRole\('admin'\)/.test(coreRoutes),
  },
  {
    label: 'PATCH uses requireRole(admin)',
    ok: /routes\.patch\('\/:id',\s*requireRole\('admin'\)/.test(coreRoutes),
  },
  {
    label: 'DELETE uses requireRole(admin)',
    ok: /routes\.delete\('\/:id',\s*requireRole\('admin'\)/.test(coreRoutes),
  },
  {
    label: 'GET list has no requireRole(admin)',
    ok: /routes\.get\('\/',\s*async/.test(coreRoutes) && !/routes\.get\('\/',\s*requireRole/.test(coreRoutes),
  },
]);

const bffCreate = read('apps/dashboard/src/contexts/settings/api/investigation-llm-profiles-handler.ts');
const bffId = read('apps/dashboard/src/contexts/settings/api/investigation-llm-profile-id-handler.ts');
const bffActivate = read(
  'apps/dashboard/src/contexts/settings/api/investigation-llm-profile-activate-handler.ts',
);
grepStep('bff_mutations_admin_only', [
  {
    label: 'POST handler uses adminOnly',
    ok: bffCreate.includes('{ adminOnly: true }'),
  },
  {
    label: 'PATCH handler uses adminOnly',
    ok: bffId.includes('{ adminOnly: true }'),
  },
  {
    label: 'DELETE handler uses adminOnly',
    ok: bffId.includes('{ adminOnly: true }'),
  },
  {
    label: 'activate handler uses adminOnly',
    ok: bffActivate.includes('{ adminOnly: true }'),
  },
]);

const uiCard = read(
  'apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.tsx',
);
grepStep('ui_mutations_hidden_for_members', [
  {
    label: 'uses MANAGE_SETTINGS permission',
    ok: uiCard.includes('usePermission(PERMISSION.MANAGE_SETTINGS)'),
  },
  {
    label: 'create toggle gated by canManage',
    ok: uiCard.includes('data-testid="investigation-llm-profile-toggle-form"') &&
      uiCard.includes('{canManage && ('),
  },
  {
    label: 'form gated by canManage',
    ok: uiCard.includes('{showForm && canManage && ('),
  },
  {
    label: 'row actions gated by canManage',
    ok: uiCard.includes('data-testid={`investigation-llm-profile-edit-${profile.id}`}') &&
      uiCard.includes('data-testid={`investigation-llm-profile-delete-${profile.id}`}'),
  },
  {
    label: 'admin-only helper copy for members',
    ok: uiCard.includes("{t('adminOnly')}") && uiCard.includes('{!canManage && <p'),
  },
]);

let unitTestsExit = 1;
try {
  execSync(
    'pnpm vitest run --project dashboard apps/dashboard/src/contexts/settings/api/investigation-llm-profiles-rbac.test.ts apps/dashboard/src/contexts/settings/presentation/components/investigation-llm-profiles-card.test.tsx',
    { cwd: ROOT, stdio: 'pipe' },
  );
  unitTestsExit = 0;
} catch (error) {
  unitTestsExit = error.status ?? 1;
}
out.steps.push({ step: 'unit_tests', exitCode: unitTestsExit });

out.pass =
  out.steps.every((step) => step.ok !== false) && unitTestsExit === 0;

fs.mkdirSync(path.join(ROOT, '.harness'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.harness/wi-ac-088-http.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
