#!/usr/bin/env node
/**
 * WI-AC-018 / AC-018 grep audit (observation_method: grep).
 *
 * Asserts Core walks optional fallbackProfileId chain (max depth / cycle-safe)
 * and fails closed with a clear configure/fix-LLM error — never silent
 * DeterministicLLMClient or Anthropic success.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const outPath = process.env.AC018_OUT ?? path.join(ROOT, '.harness/wi-ac-018-verify-first.json');

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

const resolveFile = 'core/src/modules/oss/infra/resolve-investigation-llm-profile.ts';
const clientFile = 'core/src/shared/infra/llm/openai-compatible-llm-client.ts';
const guardFile = 'core/src/shared/infra/llm/local-llm-guard.ts';
const connectorFile = 'core/src/shared/infra/llm/llm-connector-profile.ts';
const factoryFile = 'core/src/shared/infra/llm/llm-factory.ts';

const resolveSrc = fs.readFileSync(path.join(ROOT, resolveFile), 'utf8');
const clientSrc = fs.readFileSync(path.join(ROOT, clientFile), 'utf8');
const guardSrc = fs.readFileSync(path.join(ROOT, guardFile), 'utf8');
const connectorSrc = fs.readFileSync(path.join(ROOT, connectorFile), 'utf8');
const factorySrc = fs.readFileSync(path.join(ROOT, factoryFile), 'utf8');

const checks = [];

function check(name, cond, evidence) {
  checks.push({ name, pass: Boolean(cond), evidence: evidence || undefined });
  assert(cond, name, evidence);
}

check(
  'MAX_INVESTIGATION_LLM_FALLBACK_DEPTH defined (max depth)',
  /MAX_INVESTIGATION_LLM_FALLBACK_DEPTH\s*=\s*\d+/.test(resolveSrc),
  rg('MAX_INVESTIGATION_LLM_FALLBACK_DEPTH', resolveFile),
);

check(
  'cycle-safe visited Set in fallback walk',
  /visited\.has\(/.test(resolveSrc) && /new Set/.test(resolveSrc),
  rg('visited', resolveFile),
);

check(
  'fallbackProfileId chain walker exists',
  /resolveInvestigationLlmFallbackChain|resolveActiveInvestigationLlmFallbackChain/.test(
    resolveSrc,
  ) && /fallbackProfileId/.test(resolveSrc),
  rg('fallbackProfileId', resolveFile),
);

check(
  'clear configure/fix-LLM exhausted error (no DeterministicLLMClient/Anthropic silent success)',
  /INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR/.test(resolveSrc) &&
    /Configure or fix the Investigation LLM/.test(resolveSrc) &&
    /DeterministicLLMClient/.test(resolveSrc) &&
    /Anthropic/.test(resolveSrc),
  rg('INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR', resolveFile),
);

check(
  'OpenAiCompatibleLlmClient walks endpoint chain on failure',
  /resolveActiveLlmEndpointChain/.test(clientSrc) &&
    /InvestigationLlmChainExhaustedError/.test(clientSrc) &&
    /for \(const endpoint of chain\)/.test(clientSrc),
  rg('resolveActiveLlmEndpointChain', clientFile),
);

check(
  'local-llm-guard probes fallback chain for tenant',
  /resolveActiveLlmEndpointChain/.test(guardSrc) &&
    /InvestigationLlmChainExhaustedError/.test(guardSrc),
  rg('resolveActiveLlmEndpointChain', guardFile),
);

check(
  'llm-connector-profile exports chain resolver (AC-018)',
  /resolveActiveLlmEndpointChain/.test(connectorSrc) &&
    /fallbackProfileId chain/.test(connectorSrc),
  rg('resolveActiveLlmEndpointChain', connectorFile),
);

check(
  'OSS createRawLlmClient uses OpenAiCompatibleLlmClient (not DeterministicLLMClient)',
  /OpenAiCompatibleLlmClient/.test(factorySrc) &&
    !/DeterministicLLMClient/.test(factorySrc) &&
    /usesLocalLlmConnector\(\)/.test(factorySrc),
  rg('OpenAiCompatibleLlmClient', factoryFile),
);

check(
  'OSS createRawLlmClient does not auto-pick Anthropic when local connector active',
  /if \(usesLocalLlmConnector\(\)\)/.test(factorySrc) &&
    factorySrc.indexOf('usesLocalLlmConnector()') <
      factorySrc.lastIndexOf('new AnthropicClient()'),
  rg('usesLocalLlmConnector', factoryFile),
);

const out = {
  id: 'WI-AC-018',
  phase: process.env.AC018_PHASE ?? 'verify-first',
  observation_method: 'grep',
  checks,
  passed: checks.every((c) => c.pass),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

console.log(out.passed ? 'AC-018: ALL ASSERTIONS PASSED' : 'AC-018: SOME ASSERTIONS FAILED');
console.log('wrote', outPath);
process.exit(out.passed ? 0 : 1);
