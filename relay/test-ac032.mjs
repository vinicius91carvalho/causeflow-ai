#!/usr/bin/env node
// Independent verification of AC-032 (MongoDB describe_table) at the real
// WebSocket boundary.
//
// 1. Seeds MongoDB with an `orders` collection containing documents of
//    varying types (string, number, boolean, object, array, null, date).
// 2. Creates an index on the collection.
// 3. Connects to the running control-plane stub on localhost:3000.
// 4. Sends a JSON-RPC execute request for describe_table on 'orders'.
// 5. Verifies the response contains schema rows (inferred types per field)
//    and index rows (tagged _type: 'index', with name and key).
// 6. Cleans up seeded data.

import { MongoClient } from 'mongodb';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URI = 'mongodb://localhost:27017';
const DATABASE = 'relay';
const STUB_URL = 'ws://localhost:5191/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';

// ---------------------------------------------------------------------------
// Helper: send a JSON-RPC 2.0 request and wait for a matching response
// ---------------------------------------------------------------------------
function sendRequest(ws, method, params) {
  const id = uuidv4();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, expectedId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for response id=${expectedId}`));
    }, timeoutMs);
    const onMessage = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.id === expectedId) {
          cleanup();
          resolve(msg);
        }
      } catch { /* skip non-JSON messages */ }
    };
    const onClose = () => { cleanup(); reject(new Error('Socket closed')); };
    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
    }
    ws.on('message', onMessage);
    ws.on('close', onClose);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  console.log('=== AC-032 MongoDB describe_table verification ===\n');
  const failures = [];

  // -----------------------------------------------------------------------
  // 1. Seed MongoDB with an `orders` collection containing varied documents
  // -----------------------------------------------------------------------
  console.log('--- Seeding MongoDB with orders collection ---');

  const seedClient = new MongoClient(MONGO_URI);
  await seedClient.connect();
  const db = seedClient.db(DATABASE);

  // Drop any existing orders collection for a clean slate
  try {
    await db.collection('orders').drop();
    console.log('  Dropped existing orders collection');
  } catch { /* never existed, that's fine */ }

  // Insert documents with varied field types to exercise schema inference
  const sampleDocs = [
    {
      _id: 'ord-001',
      status: 'pending',
      amount: 49.99,
      customer: { name: 'Alice', tier: 'gold' },
      tags: ['urgent'],
      notes: null,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      _id: 'ord-002',
      status: 'shipped',
      amount: 129.99,
      customer: { name: 'Bob', tier: 'silver' },
      tags: ['international', 'gift'],
      notes: 'Handle with care',
      createdAt: new Date('2026-02-20T14:30:00Z'),
    },
  ];

  const insertResult = await db.collection('orders').insertMany(sampleDocs);
  console.log(`  Inserted ${insertResult.insertedCount} sample documents`);

  // Create a couple of indexes to verify the indexes() path
  await db.collection('orders').createIndex({ status: 1 }, { name: 'idx_status' });
  await db.collection('orders').createIndex({ amount: -1 }, { name: 'idx_amount' });
  console.log('  Created indexes: idx_status, idx_amount');

  // Also create a compound index
  await db.collection('orders').createIndex({ customer: 1, createdAt: -1 });
  console.log('  Created compound index: customer_1_createdAt_-1');

  // -----------------------------------------------------------------------
  // 2. Connect to control-plane stub and send describe_table request
  // -----------------------------------------------------------------------
  console.log('\n--- WebSocket test ---');
  console.log(`  Connecting to ${STUB_URL}`);

  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    ws.on('open', () => { clearTimeout(timeout); resolve(); });
    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  console.log('  Connected\n');

  // Wait a tick for the connection to establish and resource_update to flow
  await new Promise((r) => setTimeout(r, 500));

  // Send execute describe_table for MongoDB
  const execId = sendRequest(ws, 'execute', {
    resourceId: 'order-mongo',
    operation: 'describe_table',
    params: { tableName: 'orders' },
  });
  console.log('  Sent describe_table request for orders\n');

  const response = await waitForResponse(ws, execId);
  console.log('Response:', JSON.stringify(response, null, 2), '\n');

  // -----------------------------------------------------------------------
  // 3. Verify the response
  // -----------------------------------------------------------------------
  console.log('--- Verifications ---');

  // 3a. JSON-RPC 2.0 shape
  if (response.jsonrpc !== '2.0') {
    failures.push('jsonrpc is not 2.0');
    console.error('  FAIL: jsonrpc is not 2.0');
  } else {
    console.log('  PASS: jsonrpc is 2.0');
  }

  if (response.error) {
    failures.push(`Response has error: ${JSON.stringify(response.error)}`);
    console.error(`  FAIL: Response has error: ${JSON.stringify(response.error)}`);
  } else {
    console.log('  PASS: no error in response');
  }

  const result = response.result;
  if (!result) {
    failures.push('Missing result');
    console.error('  FAIL: Missing result');
    ws.close();
    await cleanup();
    return;
  }

  // 3b. rows is an array
  if (!Array.isArray(result.rows)) {
    failures.push('result.rows is not an array');
    console.error('  FAIL: result.rows is not an array');
  } else {
    console.log(`  PASS: rows is an array with ${result.rows.length} entries`);
  }

  // 3c. rowCount matches
  if (result.rowCount !== result.rows.length) {
    failures.push(`rowCount (${result.rowCount}) != rows.length (${result.rows.length})`);
    console.error(`  FAIL: rowCount mismatch`);
  } else {
    console.log('  PASS: rowCount matches rows.length');
  }

  // 3d. executionTimeMs is valid
  if (typeof result.executionTimeMs !== 'number' || result.executionTimeMs < 0) {
    failures.push(`Invalid executionTimeMs: ${result.executionTimeMs}`);
    console.error(`  FAIL: executionTimeMs invalid`);
  } else {
    console.log(`  PASS: executionTimeMs = ${result.executionTimeMs}ms`);
  }

  // 3e. The rows should contain schema rows (field + types) and index rows (_type: 'index')
  const rows = result.rows;

  const schemaRows = rows.filter((r) => r._type !== 'index');
  const indexRows = rows.filter((r) => r._type === 'index');

  console.log(`\n  Schema rows: ${schemaRows.length}, Index rows: ${indexRows.length}`);

  // Verify schema rows have 'field' and 'types' properties
  const schemaRowsValid = schemaRows.every(
    (r) => typeof r.field === 'string' && Array.isArray(r.types),
  );
  if (!schemaRowsValid) {
    failures.push('Schema rows missing field/types properties');
    console.error('  FAIL: Some schema rows missing field/types');
  } else {
    console.log('  PASS: All schema rows have field + types');
  }

  // Verify specific fields and their types
  console.log('\n  Schema fields:');
  for (const row of schemaRows) {
    console.log(`    ${row.field}: ${row.types}`);
  }

  // Check for expected fields from our sample documents
  const expectedFields = ['_id', 'status', 'amount', 'customer', 'tags', 'notes', 'createdAt'];
  const foundFields = schemaRows.map((r) => r.field);
  for (const f of expectedFields) {
    if (!foundFields.includes(f)) {
      failures.push(`Expected field '${f}' not found in schema`);
      console.error(`  FAIL: Expected field '${f}' not found`);
    }
  }
  if (expectedFields.every((f) => foundFields.includes(f))) {
    console.log('  PASS: All expected fields present in schema');
  }

  // Check type correctness for sample documents
  // _id: string, status: string, amount: number, customer: object,
  // tags: object (arrays are typeof 'object'), notes: object (null is typeof 'object'),
  // createdAt: object (Date is typeof 'object')
  for (const row of schemaRows) {
    switch (row.field) {
      case '_id':
        if (!row.types.includes('string')) failures.push('_id should have type string');
        break;
      case 'status':
        if (!row.types.includes('string')) failures.push('status should have type string');
        break;
      case 'amount':
        if (!row.types.includes('number')) failures.push('amount should have type number');
        break;
      case 'customer':
        if (!row.types.includes('object')) failures.push('customer should have type object');
        break;
      case 'tags':
        if (!row.types.includes('object')) failures.push('tags should have type object (array)');
        break;
      case 'notes':
        // null is typeof 'object' in JS
        if (!row.types.includes('object')) failures.push('notes should have type object (null)');
        break;
      case 'createdAt':
        if (!row.types.includes('object')) failures.push('createdAt should have type object (Date)');
        break;
    }
  }

  const typeChecksPassed = expectedFields.every((f) => {
    const row = schemaRows.find((r) => r.field === f);
    return row && row.types.length > 0;
  });
  if (typeChecksPassed) {
    console.log('  PASS: Type inference correct for all fields');
  } else {
    failures.push('Type inference check failed');
    console.error('  FAIL: Type inference check failed');
  }

  // Verify index rows
  console.log('\n  Index rows:');
  for (const row of indexRows) {
    console.log(`    _type: ${row._type}, name: ${row.name}, key: ${JSON.stringify(row.key)}`);
  }

  const indexRowsValid = indexRows.every(
    (r) => r._type === 'index' && typeof r.name === 'string' && r.key && typeof r.key === 'object',
  );
  if (!indexRowsValid) {
    failures.push('Index rows missing _type/name/key properties');
    console.error('  FAIL: Some index rows missing required properties');
  } else {
    console.log('  PASS: All index rows have _type, name, key');
  }

  // Check for specific indexes
  const idxNames = indexRows.map((r) => r.name);
  const expectedIndexes = ['_id_', 'idx_status', 'idx_amount', 'customer_1_createdAt_-1'];
  for (const idx of expectedIndexes) {
    if (!idxNames.includes(idx)) {
      // The auto-named compound index may have a different auto-generated name
      if (idx === 'customer_1_createdAt_-1') continue;
      failures.push(`Expected index '${idx}' not found`);
      console.error(`  FAIL: Expected index '${idx}' not found`);
    }
  }
  // Check for the compound index by pattern
  const hasCompoundIdx = indexRows.some(
    (r) => r.key && r.key.customer === 1 && r.key.createdAt === -1,
  );
  if (!hasCompoundIdx) {
    failures.push('Compound index on customer+createdAt not found');
    console.error('  FAIL: Compound index not found');
  } else {
    console.log('  PASS: Compound index found');
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  async function cleanup() {
    try {
      await db.collection('orders').drop();
      console.log('\n  Cleaned up orders collection');
    } catch { /* ignore */ }
    await seedClient.close();
  }

  ws.close();
  await cleanup();

  // -----------------------------------------------------------------------
  // Results
  // -----------------------------------------------------------------------
  console.log('\n=== Results ===');
  if (failures.length === 0) {
    console.log('ALL AC-032 checks PASSED');
    console.log(JSON.stringify({ integration: true, implementation: true, defects: [] }));
  } else {
    console.log('FAILURES:');
    failures.forEach((f) => console.log(`  - ${f}`));
    const defects = failures.map(
      (f) => `expected valid describe_table schema inference; observed ${f}; evidence test-ac032.mjs`,
    );
    console.log(JSON.stringify({ integration: false, implementation: true, defects }));
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  const defects = [`Test crashed: ${err.message}`];
  console.log(JSON.stringify({ integration: false, implementation: true, defects }));
  process.exitCode = 1;
});
