#!/usr/bin/env node
/**
 * List and optionally clear cost/token pollution from Hindsight memory.
 * Must run from within the ECS network (or port-forward to hindsight service).
 *
 * Usage:
 *   HINDSIGHT_BASE_URL=http://hindsight.causeflow-staging.local:8888 \
 *   HINDSIGHT_API_KEY=causeflow-staging-hindsight \
 *   node scripts/clean-hindsight-memories.mjs <tenantId> [--clear]
 */
import { HindsightClient } from '@vectorize-io/hindsight-client';

const TENANT_ID = process.argv[2];
const CLEAR = process.argv.includes('--clear');

if (!TENANT_ID) {
  console.error('Usage: node scripts/clean-hindsight-memories.mjs <tenantId> [--clear]');
  process.exit(1);
}

const BASE_URL = process.env.HINDSIGHT_BASE_URL;
const API_KEY = process.env.HINDSIGHT_API_KEY;

if (!BASE_URL) {
  console.error('Set HINDSIGHT_BASE_URL env var');
  process.exit(1);
}

const client = new HindsightClient({ baseUrl: BASE_URL, apiKey: API_KEY });
const bankId = `causeflow-${TENANT_ID}`;

console.log(`Bank: ${bankId}`);
console.log(`Mode: ${CLEAR ? 'CLEAR ALL' : 'LIST ONLY'}\n`);

// List memories
const memories = await client.listMemories(bankId, { limit: 50 });
const items = memories.items ?? [];
console.log(`Found ${items.length} memories:\n`);

const costPattern = /\$\d+\.\d+|tokens|cost|duration.*\d+s/i;
let costCount = 0;

for (const m of items) {
  const text = (m.text ?? '').slice(0, 150);
  const isCost = costPattern.test(m.text ?? '');
  if (isCost) costCount++;
  const tag = isCost ? '[COST POLLUTION]' : '[OK]';
  console.log(`  ${tag} ${m.type}: ${text}...`);
}

console.log(`\n${costCount}/${items.length} memories contain cost/token data.`);

if (CLEAR && costCount > 0) {
  console.log('\nClearing ALL memories (Hindsight does not support individual delete)...');
  console.log('WARNING: This will delete good memories too. Re-running investigations will rebuild them.');
  const result = await client.clearBankMemories(bankId);
  console.log('Result:', JSON.stringify(result));
  console.log('Done. Memories cleared. New investigations will rebuild useful memories.');
} else if (CLEAR) {
  console.log('No cost pollution found. Nothing to clear.');
} else {
  console.log('\nRun with --clear to wipe the bank. New investigations rebuild useful memories.');
}
