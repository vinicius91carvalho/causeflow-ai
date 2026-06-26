#!/usr/bin/env node
/**
 * Test: does Composio return REAL tools (not meta-tools) for a tenant?
 * Usage: node scripts/test-composio-tools.mjs [tenantId]
 */
import { Composio } from '@composio/core';

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error('Usage: node scripts/test-composio-tools.mjs <tenantId>');
  process.exit(1);
}
const API_KEY = process.env.COMPOSIO_API_KEY;

if (!API_KEY) {
  console.error('Set COMPOSIO_API_KEY env var first');
  process.exit(1);
}

const client = new Composio({ apiKey: API_KEY });

console.log(`\n=== Testing Composio for tenant: ${TENANT_ID} ===\n`);

// 1. Check connections
console.log('1. Checking connections...');
try {
  const connections = await client.connectedAccounts.list({ userIds: [TENANT_ID] });
  const items = connections.items ?? [];
  const active = items.filter(c => c.status === 'ACTIVE');
  console.log(`   ${items.length} total, ${active.length} active:`);
  for (const conn of active) {
    console.log(`   - ${conn.appName ?? 'unknown'} | id=${conn.id}`);
  }
} catch (err) {
  console.error('   ERROR:', err.message);
}

// 2. Get REAL tools via getRawComposioTools (correct v3 approach)
console.log('\n2. Getting real tools via getRawComposioTools({ toolkits: ["github"] })...');
try {
  const tools = await client.tools.getRawComposioTools({ toolkits: ['github'] });
  console.log(`   Got ${tools.length} REAL tools:`);
  for (const t of tools.slice(0, 15)) {
    console.log(`   - ${t.slug ?? t.name}: ${(t.description ?? '').slice(0, 80)}`);
  }
  if (tools.length > 15) console.log(`   ... and ${tools.length - 15} more`);
} catch (err) {
  console.error('   ERROR:', err.message);
}

// 3. Test execution
console.log('\n3. Testing tool execution (GITHUB_LIST_REPOS)...');
try {
  const result = await client.tools.execute('GITHUB_LIST_REPOS', {
    userId: TENANT_ID,
    arguments: {},
  });
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  console.log(`   Result (first 300 chars): ${text.slice(0, 300)}`);
} catch (err) {
  console.error('   ERROR:', err.message);
}

console.log('\nDone.');
