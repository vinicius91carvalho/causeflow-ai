#!/usr/bin/env tsx
/**
 * check-invariants.ts — machine-verifiable contract checks for CauseFlow.
 *
 * Checks invariants I1–I12 as defined in INVARIANTS.md.
 * AC-050: OSS test tree must not import AWS SDK, Clerk, Stripe, or aws-sdk-client-mock.
 * I5 is skipped here (verified by unit tests).
 * I13 (inconclusive outcome) is verified by integration test, not here.
 *
 * Exit codes:
 *   0 — all invariants pass
 *   1 — one or more invariants failed
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const MODULES_DIR = join(ROOT, 'src', 'modules');

interface CheckResult {
  id: string;
  description: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function pass(id: string, description: string): void {
  results.push({ id, description, passed: true });
  console.log(`  PASS  ${id} — ${description}`);
}

function fail(id: string, description: string, details: string): void {
  results.push({ id, description, passed: false, details });
  console.error(`  FAIL  ${id} — ${description}`);
  console.error(`        ${details}`);
}

// ---------------------------------------------------------------------------
// I1 — No static AWS credentials in workflows
// ---------------------------------------------------------------------------
function checkI1(): void {
  const id = 'I1';
  const description = 'No static AWS credentials in workflows';
  const deployYml = join(WORKFLOWS_DIR, 'deploy.yml');
  try {
    // Only check deploy.yml (other workflows like ci.yml may use dummy test values).
    // Exclude comment lines to avoid false positives from invariant documentation.
    const output = execSync(
      `grep -n 'aws-access-key-id\\|AWS_ACCESS_KEY_ID\\|aws-secret-access-key\\|AWS_SECRET_ACCESS_KEY' "${deployYml}" | grep -v '^[0-9]*:[[:space:]]*#'`,
      { encoding: 'utf8' },
    );
    fail(id, description, `Static credentials found:\n${output.trim()}`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      pass(id, description);
    } else {
      fail(id, description, `Unexpected grep error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I2 — All AWS auth uses role-to-assume (OIDC)
// ---------------------------------------------------------------------------
function checkI2(): void {
  const id = 'I2';
  const description = 'All aws-actions/configure-aws-credentials steps use role-to-assume';
  const violations: string[] = [];

  const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const content = readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
    let doc: unknown;
    try {
      doc = parseYaml(content);
    } catch {
      violations.push(`${file}: failed to parse YAML`);
      continue;
    }

    const workflow = doc as Record<string, unknown>;
    const jobs = (workflow['jobs'] ?? {}) as Record<string, unknown>;

    for (const [jobName, jobDef] of Object.entries(jobs)) {
      const job = jobDef as Record<string, unknown>;
      const steps = (job['steps'] ?? []) as Array<Record<string, unknown>>;

      for (const step of steps) {
        const uses = step['uses'] as string | undefined;
        if (typeof uses === 'string' && uses.startsWith('aws-actions/configure-aws-credentials')) {
          const withBlock = (step['with'] ?? {}) as Record<string, unknown>;

          if (!withBlock['role-to-assume']) {
            violations.push(`${file} / job:${jobName} — missing role-to-assume`);
          }
          if (!withBlock['aws-region']) {
            violations.push(`${file} / job:${jobName} — missing aws-region`);
          }
          if (withBlock['aws-access-key-id']) {
            violations.push(`${file} / job:${jobName} — has forbidden aws-access-key-id`);
          }
        }
      }
    }
  }

  if (violations.length === 0) {
    pass(id, description);
  } else {
    fail(id, description, violations.join('\n        '));
  }
}

// ---------------------------------------------------------------------------
// I3 — continue-on-error banned in deploy.yml
// ---------------------------------------------------------------------------
function checkI3(): void {
  const id = 'I3';
  const description = 'No continue-on-error in deploy.yml';
  const deployYml = join(WORKFLOWS_DIR, 'deploy.yml');
  try {
    // Exclude comment lines (# I3 documentation references continue-on-error)
    const output = execSync(
      `grep -n 'continue-on-error' "${deployYml}" | grep -v '^[0-9]*:[[:space:]]*#'`,
      { encoding: 'utf8' },
    );
    fail(id, description, `continue-on-error found:\n${output.trim()}`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      pass(id, description);
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I4 — No register-task-definition in workflows or scripts
// ---------------------------------------------------------------------------
function checkI4(): void {
  const id = 'I4';
  const description = 'No register-task-definition in workflows or infra/scripts/';
  const scriptsDir = join(ROOT, 'infra', 'scripts');
  try {
    // Exclude comment lines and the invariant checker itself
    const output = execSync(
      `grep -rn 'register-task-definition' "${WORKFLOWS_DIR}" "${scriptsDir}" | grep -v 'check-invariants\\|^[0-9]*:[[:space:]]*#\\|:[0-9]*:[[:space:]]*#\\|:[0-9]*:[[:space:]]*//'`,
      { encoding: 'utf8' },
    );
    fail(id, description, `register-task-definition found:\n${output.trim()}`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      pass(id, description);
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I5 — /health response includes commit (verified by unit tests — skip here)
// ---------------------------------------------------------------------------
function checkI5(): void {
  console.log(`  SKIP  I5 — /health shape verified by unit tests`);
}

// ---------------------------------------------------------------------------
// I6 — No inline run blocks over 20 lines in workflows
// ---------------------------------------------------------------------------
function checkI6(): void {
  const id = 'I6';
  const description = 'No inline run: | block exceeds 20 lines in workflows';
  const violations: string[] = [];

  const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const content = readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
    let doc: unknown;
    try {
      doc = parseYaml(content);
    } catch {
      violations.push(`${file}: failed to parse YAML`);
      continue;
    }

    const workflow = doc as Record<string, unknown>;
    const jobs = (workflow['jobs'] ?? {}) as Record<string, unknown>;

    for (const [jobName, jobDef] of Object.entries(jobs)) {
      const job = jobDef as Record<string, unknown>;
      const steps = (job['steps'] ?? []) as Array<Record<string, unknown>>;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const run = step['run'] as string | undefined;
        if (typeof run === 'string') {
          const lineCount = run.split('\n').filter((l) => l.trim().length > 0).length;
          if (lineCount > 20) {
            const stepName = (step['name'] as string | undefined) ?? `step[${i}]`;
            violations.push(
              `${file} / job:${jobName} / step:"${stepName}" — ${lineCount} lines (max 20)`,
            );
          }
        }
      }
    }
  }

  if (violations.length === 0) {
    pass(id, description);
  } else {
    fail(id, description, violations.join('\n        '));
  }
}

// ---------------------------------------------------------------------------
// I8 — Sentry webhooks use HMAC auth (createSentryWebhookAuth), not generic webhookAuth
// ---------------------------------------------------------------------------
function checkI8(): void {
  const id = 'I8';
  const description = 'Sentry webhook route uses createSentryWebhookAuth, not generic webhookAuth';
  const webhookRoutesFile = join(ROOT, 'src', 'modules', 'ingestion', 'infra', 'webhook.routes.ts');
  try {
    // Verify createSentryWebhookAuth is imported/used in webhook.routes.ts
    const output = execSync(
      `grep -n 'sentryWebhookAuth\\|createSentryWebhookAuth' "${webhookRoutesFile}"`,
      { encoding: 'utf8' },
    );
    if (output.trim().length > 0) {
      pass(id, description);
    } else {
      fail(id, description, 'No reference to createSentryWebhookAuth found in webhook.routes.ts');
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      // grep found nothing
      fail(id, description, 'createSentryWebhookAuth not found in webhook.routes.ts — Sentry route is unprotected');
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I7 — No `causeflow-prod` (short form) anywhere in source
// ---------------------------------------------------------------------------
function checkI7(): void {
  const id = 'I7';
  const description = "No 'causeflow-prod[^u]' short form (use causeflow-production)";
  const dirs = [
    join(ROOT, '.github', 'workflows'),
    join(ROOT, 'infra'),
    join(ROOT, 'src'),
  ];
  const includes = ['--include=*.ts', '--include=*.yml', '--include=*.yaml', '--include=*.json'];
  const dirsArg = dirs.map((d) => `"${d}"`).join(' ');

  try {
    // Exclude this script and INVARIANTS.md (they reference the pattern for documentation)
    const output = execSync(
      `grep -rn 'causeflow-prod[^u]' ${dirsArg} ${includes.join(' ')} | grep -v 'check-invariants\\|INVARIANTS.md'`,
      { encoding: 'utf8' },
    );
    fail(id, description, `Short form found:\n${output.trim()}`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      pass(id, description);
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I9 — Synthesis never runs with zero evidences (pre-synthesis gate present)
// ---------------------------------------------------------------------------
function checkI9(): void {
  const id = 'I9';
  const description = 'Synthesis never runs with zero evidences (pre-synthesis gate present)';
  const useCaseFile = join(ROOT, 'src', 'modules', 'investigation', 'application', 'investigate-incident.usecase.ts');
  try {
    const output = execSync(
      `grep -n 'pre_synthesis_zero_evidence' "${useCaseFile}"`,
      { encoding: 'utf8' },
    );
    if (output.trim().length > 0) {
      pass(id, description);
    } else {
      fail(id, description, 'pre_synthesis_zero_evidence marker not found — pre-synthesis gate may be missing');
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      fail(id, description, 'pre_synthesis_zero_evidence marker not found in investigate-incident.usecase.ts — pre-synthesis gate missing');
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I10 — No fabricated unvalidated findings (orchestrator-mode fallback removed)
// ---------------------------------------------------------------------------
function checkI10(): void {
  const id = 'I10';
  const description = 'No orchestrator-mode "Synthesis with citation failed — falling back" fallback in src/';
  const srcDir = join(ROOT, 'src');
  try {
    const output = execSync(
      `grep -rn 'Synthesis with citation failed — falling back' "${srcDir}" --include='*.ts'`,
      { encoding: 'utf8' },
    );
    if (output.trim().length === 0) {
      pass(id, description);
    } else {
      fail(id, description, `Forbidden fallback log line found:\n${output.trim()}`);
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code === 1) {
      pass(id, description);
    } else {
      fail(id, description, `Unexpected error: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// I11 — No cross-module direct function calls
// ---------------------------------------------------------------------------
// Cross-module communication is restricted to (1) the in-process EventBus and
// (2) type-only imports from another module's `domain/`. Importing a use case
// (a value binding) from another module's `application/` is a forbidden
// cross-module direct function call — it bypasses the composition root and the
// EventBus. Type-only imports (`import type ...`) remain allowed because they
// emit no runtime call (used for dependency-injection typing).
// ---------------------------------------------------------------------------
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(p));
    } else if (entry.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

// An import is a runtime (value) import unless it is `import type ...` or every
// named binding is prefixed with the inline `type` modifier.
function isTypeOnlyImport(line: string): boolean {
  if (/^import\s+type\b/.test(line)) return true;
  const named = line.match(/^import\s*\{([^}]*)\}\s*from/);
  if (named) {
    const bindings = named[1]!.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (bindings.length > 0 && bindings.every((b) => /^type\b/.test(b))) return true;
  }
  return false;
}

function checkI11(): void {
  const id = 'I11';
  const description = 'No cross-module direct function calls (no value imports from another module\'s application/)';
  const violations: string[] = [];

  let files: string[];
  try {
    files = walkTsFiles(MODULES_DIR);
  } catch (err: unknown) {
    fail(id, description, `Could not walk ${MODULES_DIR}: ${String(err)}`);
    return;
  }

  const importRe = /^[ \t]*import\b(?:[^'"`;]*?\bfrom\s*)?['"]([^'"]+)['"]/gm;

  for (const file of files) {
    const rel = relative(MODULES_DIR, file).split('/');
    const currentModule = rel[0]!;
    const src = readFileSync(file, 'utf8');

    let match: RegExpExecArray | null;
    while ((match = importRe.exec(src)) !== null) {
      const lineStart = src.lastIndexOf('\n', match.index) + 1;
      const lineEnd = src.indexOf('\n', match.index);
      const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      if (isTypeOnlyImport(line)) continue; // type-only imports are allowed

      const spec = match[1]!;
      let targetModule: string | null = null;
      let targetsApplication = false;

      if (spec.startsWith('@modules/')) {
        const parts = spec.slice('@modules/'.length).split('/');
        targetModule = parts[0] ?? null;
        targetsApplication = parts.slice(1).join('/').startsWith('application/');
      } else if (spec.startsWith('./') || spec.startsWith('../')) {
        const resolved = resolve(dirname(file), spec);
        const relToModules = relative(MODULES_DIR, resolved);
        if (relToModules && !relToModules.startsWith('..') && !relToModules.startsWith('/')) {
          const parts = relToModules.split('/');
          targetModule = parts[0] ?? null;
          targetsApplication = parts[1] === 'application';
        }
      }

      if (targetModule && targetModule !== currentModule && targetsApplication) {
        violations.push(
          `${relative(ROOT, file)} — module '${currentModule}' value-imports from module '${targetModule}' application/ ("${spec}")`,
        );
      }
    }
  }

  if (violations.length === 0) {
    pass(id, description);
  } else {
    fail(id, description, violations.join('\n        '));
  }
}

// ---------------------------------------------------------------------------
// I12 — No forbidden external imports in domain/ layers
// ---------------------------------------------------------------------------
// The `domain/` layer must stay pure — zero imports of `pg`, `bullmq`,
// `stripe`, `@clerk/*`, or `@aws-sdk/*`. This preserves the Clean
// Architecture dependency rule (Infra → Application → Domain).
// AC-051 / open-source-local-runtime.
//
// NOTE: Patterns match only actual import statements (lines starting with
// `import` or `from`) to avoid false-positives from comments, variable
// names, or string literals. This is more precise than a file-wide word
// boundary match.
// ---------------------------------------------------------------------------
const FORBIDDEN_DOMAIN_IMPORT_RE = [
  /^import[^'"`]*['"][^'"`]*\bpg\b[^'"`]*['"]/m,
  /^import[^'"`]*['"][^'"`]*\bbullmq\b[^'"`]*['"]/m,
  /^import[^'"`]*['"][^'"`]*\bstripe\b[^'"`]*['"]/m,
  /^import[^'"`]*['"][^'"`]*@clerk\/[^'"`]*['"]/m,
  /^import[^'"`]*['"][^'"`]*@aws-sdk\/[^'"`]*['"]/m,
];

function checkI12(): void {
  const id = 'I12';
  const description = 'domain/ has zero pg, bullmq, stripe, @clerk/*, @aws-sdk/* imports';
  const violations: string[] = [];

  const domainDirs = [
    join(ROOT, 'src', 'shared', 'domain'),
    ...readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(MODULES_DIR, e.name, 'domain')),
  ];

  for (const dir of domainDirs) {
    let files: string[];
    try {
      files = walkTsFiles(dir);
    } catch {
      continue; // dir may not exist (some modules have no domain/ yet)
    }
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      for (const pattern of FORBIDDEN_DOMAIN_IMPORT_RE) {
        const match = content.match(pattern);
        if (match) {
          violations.push(rel + ' — matches /' + pattern.source + '/ ("' + match[0].slice(0, 80) + '")');
        }
      }
    }
  }

  if (violations.length === 0) {
    pass(id, description);
  } else {
    fail(id, description, violations.join('\n        '));
  }
}

// ---------------------------------------------------------------------------
// AC-050 — OSS test tree has no forbidden SaaS/AWS imports
// ---------------------------------------------------------------------------
const FORBIDDEN_TEST_IMPORT_RE = [
  /@aws-sdk\//,
  /@clerk\/backend/,
  /aws-sdk-client-mock/,
  /from\s+['"]stripe['"]/,
];

function checkAc050(): void {
  const id = 'AC-050';
  const description =
    'tests/ and infra/scripts/__tests__/ have no @aws-sdk/*, @clerk/backend, aws-sdk-client-mock, or stripe imports';
  const violations: string[] = [];
  const dirs = [join(ROOT, 'tests'), join(ROOT, 'infra', 'scripts', '__tests__')];

  for (const dir of dirs) {
    let files: string[];
    try {
      files = walkTsFiles(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      for (const pattern of FORBIDDEN_TEST_IMPORT_RE) {
        const match = content.match(pattern);
        if (match) {
          violations.push(`${rel} — matches /${pattern.source}/ ("${match[0]}")`);
        }
      }
    }
  }

  if (violations.length === 0) {
    pass(id, description);
  } else {
    fail(id, description, violations.join('\n        '));
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------
console.log('Running invariant checks...\n');

checkI1();
checkI2();
checkI3();
checkI4();
checkI5();
checkI6();
checkI7();
checkI8();
checkI9();
checkI10();
checkI11();
checkI12();
checkAc050();

const failed = results.filter((r) => !r.passed);
const passed = results.filter((r) => r.passed);

console.log(`\n${passed.length} passed, ${failed.length} failed`);

if (failed.length > 0) {
  console.error('\nFailed invariants:');
  for (const r of failed) {
    console.error(`  ${r.id}: ${r.description}`);
    if (r.details) console.error(`    ${r.details}`);
  }
  process.exit(1);
}

process.exit(0);
