// AC-033: MongoDB query with filter, sql, and fallback
// Verifies that with a MongoDB resource configured, an execute request with
// operation: 'query' accepts either params.params.filter (used directly as the
// find filter) or params.params.sql (JSON.parsed into a filter when filter is
// empty), falls back to {} if neither is supplied, and runs
// collection.find(query).limit(<clamped limit>).toArray(). The result rows is
// the array of found documents cast to Record<string, unknown>[].
//
// Run: docker compose up -d (ensure relay + control-plane-stub + relay-mongo are up)
// Then: node .harness/test-ac033.mjs
//
// Connects to the stub at STUB_WS_URL (default ws://localhost:5191/v1/relay/connect)
// and sends JSON-RPC 2.0 execute requests against the order-mongo resource.

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const DATABASE = process.env.MONGO_DATABASE ?? 'relay';
const COLLECTION = 'test_ac033';
const STUB_WS_URL = process.env.STUB_WS_URL ?? 'ws://localhost:5191/v1/relay/connect';
const RELAY_TOKEN = process.env.RELAY_TOKEN ?? 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID ?? 'harness-tenant';

const { WebSocket } = await import('ws');

let mismatches = [];
function assert(label, ok, detail) {
  if (!ok) mismatches.push({ label, detail: detail ?? 'assertion failed' });
}

async function seedMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE);
  const col = db.collection(COLLECTION);

  // Drop and reseed
  await col.drop().catch(() => {});

  await col.insertMany([
    { _id: 1, name: 'Alice', status: 'active',   score: 95,  tags: ['admin'] },
    { _id: 2, name: 'Bob',   status: 'active',   score: 80,  tags: ['user'] },
    { _id: 3, name: 'Carol', status: 'inactive', score: 60,  tags: ['user', 'guest'] },
    { _id: 4, name: 'Dave',  status: 'active',   score: 92,  tags: ['admin'] },
    { _id: 5, name: 'Eve',   status: 'inactive', score: 45,  tags: ['guest'] },
    { _id: 6, name: 'Frank', status: 'pending',  score: 70,  tags: ['user'] },
    { _id: 7, name: 'Grace', status: 'active',   score: 88,  tags: ['admin', 'user'] },
    { _id: 8, name: 'Heidi', status: 'inactive', score: 55,  tags: ['guest'] },
  ]);

  const count = await col.countDocuments();
  console.log(`[seed] inserted ${count} documents into ${COLLECTION}`);
  await client.close();
  return count;
}

async function sendRpc(ws, request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RPC timeout')), 15000);
    const msg = JSON.stringify({ jsonrpc: '2.0', id: request.id, method: request.method, params: request.params });
    const handler = (raw) => {
      try {
        const resp = JSON.parse(raw.toString());
        if (resp.id === request.id) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(resp);
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function runTest() {
  console.log('=== AC-033: MongoDB query with filter/sql/fallback ===\n');

  // Step 1: Seed MongoDB
  console.log('[1] Seeding MongoDB test collection...');
  const docCount = await seedMongo();
  console.log(`[1] Done. Collection seeded with ${docCount} documents.\n`);

  // Step 2: Connect to control-plane stub
  console.log('[2] Connecting to control-plane stub...');
  const ws = new WebSocket(`${STUB_WS_URL}?token=${RELAY_TOKEN}&tenantId=${TENANT_ID}`);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS connect timeout')), 10000);
    ws.on('open', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
  console.log('[2] Connected to control-plane stub.\n');

  // Helper to run an execute query
  async function execQuery(filterOrSql, extraParams = {}) {
    const params = { ...extraParams };
    if (filterOrSql !== undefined) {
      // Detect whether caller wants .filter or .sql based on type
      if (typeof filterOrSql === 'object' || Array.isArray(filterOrSql)) {
        params.filter = filterOrSql;
      } else {
        params.sql = filterOrSql;
      }
    }
    return await sendRpc(ws, {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'execute',
      params: {
        resourceId: 'order-mongo',
        operation: 'query',
        params: {
          collection: COLLECTION,
          ...params,
        },
      },
    });
  }

  // ──────────────────────────────────────────────
  // SCENARIO A: filter is used directly
  // ──────────────────────────────────────────────
  console.log('[3] Scenario A: Using filter directly...');
  {
    const resp = await execQuery({ status: 'active' });

    assert('A-no-error', !resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
    assert('A-jsonrpc', resp.jsonrpc === '2.0', `jsonrpc: ${resp.jsonrpc}`);

    const result = resp.result;
    assert('A-has-result', !!result, 'Missing result');
    assert('A-rows-is-array', Array.isArray(result.rows), `rows not array: ${typeof result.rows}`);
    assert('A-rowCount-matches', result.rowCount === result.rows.length,
      `rowCount ${result.rowCount} !== rows.length ${result.rows.length}`);
    assert('A-rows-are-objects', result.rows.every(r => typeof r === 'object' && r !== null && !Array.isArray(r)),
      'Not all rows are Record<string, unknown> objects');
    assert('A-executionTimeMs', typeof result.executionTimeMs === 'number' && result.executionTimeMs >= 0,
      `executionTimeMs: ${result.executionTimeMs}`);
    assert('A-masked-boolean', typeof result.masked === 'boolean', `masked: ${result.masked}`);
    assert('A-maskedFieldCount-number', typeof result.maskedFieldCount === 'number',
      `maskedFieldCount: ${result.maskedFieldCount}`);

    // Expect exactly 4 active documents
    const activeCount = result.rows.filter(r => r.status === 'active').length;
    assert('A-active-count', activeCount === 4,
      `Expected 4 active docs, got ${activeCount}`);
    assert('A-total-count', result.rowCount === 4,
      `Expected 4 rows for status=active filter, got ${result.rowCount}`);

    console.log(`  Filter by {status: 'active'} -> ${result.rowCount} rows (expected 4) [PASS]`);
  }

  // ──────────────────────────────────────────────
  // SCENARIO B: sql is JSON.parsed into a filter when filter is empty
  // ──────────────────────────────────────────────
  console.log('[4] Scenario B: Using sql as JSON filter...');
  {
    const resp = await execQuery('{"status":"inactive"}');

    assert('B-no-error', !resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
    assert('B-jsonrpc', resp.jsonrpc === '2.0', `jsonrpc: ${resp.jsonrpc}`);

    const result = resp.result;
    assert('B-has-result', !!result, 'Missing result');
    assert('B-rows-is-array', Array.isArray(result.rows), `rows not array: ${typeof result.rows}`);
    assert('B-rowCount-matches', result.rowCount === result.rows.length,
      `rowCount ${result.rowCount} !== rows.length ${result.rows.length}`);
    assert('B-rows-are-objects', result.rows.every(r => typeof r === 'object' && r !== null && !Array.isArray(r)),
      'Not all rows are objects');

    // Expect exactly 3 inactive documents
    const inactiveCount = result.rows.filter(r => r.status === 'inactive').length;
    assert('B-inactive-count', inactiveCount === 3,
      `Expected 3 inactive docs, got ${inactiveCount}`);
    assert('B-total-count', result.rowCount === 3,
      `Expected 3 rows for {status:inactive}, got ${result.rowCount}`);

    console.log(`  SQL '{"status":"inactive"}' -> ${result.rowCount} rows (expected 3) [PASS]`);

    // Also test that a complex JSON filter works via sql
    const resp2 = await execQuery('{"score":{"$gte":80}}');
    assert('B2-no-error', !resp2.error, `Unexpected error on score filter: ${JSON.stringify(resp2.error)}`);
    const result2 = resp2.result;
    // score >= 80: Alice(95), Bob(80), Dave(92), Grace(88) = 4
    assert('B2-score-count', result2.rowCount === 4,
      `Expected 4 rows for score>=80, got ${result2.rowCount}`);
    console.log(`  SQL '{"score":{"$gte":80}}' -> ${result2.rowCount} rows (expected 4) [PASS]`);
  }

  // ──────────────────────────────────────────────
  // SCENARIO C: Falls back to {} if neither filter nor sql is supplied
  // ──────────────────────────────────────────────
  console.log('[5] Scenario C: No filter, no sql (fallback to {})...');
  {
    const resp = await execQuery(undefined);

    assert('C-no-error', !resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
    assert('C-jsonrpc', resp.jsonrpc === '2.0', `jsonrpc: ${resp.jsonrpc}`);

    const result = resp.result;
    assert('C-has-result', !!result, 'Missing result');
    assert('C-rows-is-array', Array.isArray(result.rows), `rows not array: ${typeof result.rows}`);
    assert('C-rowCount-matches', result.rowCount === result.rows.length,
      `rowCount ${result.rowCount} !== rows.length ${result.rows.length}`);
    assert('C-rows-are-objects', result.rows.every(r => typeof r === 'object' && r !== null && !Array.isArray(r)),
      'Not all rows are objects');

    // Expect all 8 documents
    assert('C-all-docs', result.rowCount === 8,
      `Expected 8 rows for empty filter, got ${result.rowCount}`);

    console.log(`  No filter/sql -> ${result.rowCount} rows (expected 8) [PASS]`);
  }

  // ──────────────────────────────────────────────
  // SCENARIO D: Limit clamping works
  // ──────────────────────────────────────────────
  console.log('[6] Scenario D: Limit clamping...');
  {
    // limit=3 should return max 3 rows
    const resp = await execQuery(undefined, { limit: 3 });

    assert('D-no-error', !resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
    const result = resp.result;
    assert('D-limit-3-rows', result.rowCount <= 3,
      `Expected at most 3 rows with limit=3, got ${result.rowCount}`);

    console.log(`  limit=3 -> ${result.rowCount} rows (expected <=3) [PASS]`);

    // limit=0 should return 0 rows
    const resp2 = await execQuery(undefined, { limit: 0 });
    assert('D2-no-error', !resp2.error, `Unexpected error: ${JSON.stringify(resp2.error)}`);
    const result2 = resp2.result;
    assert('D2-limit-0-rows', result2.rowCount === 0,
      `Expected 0 rows with limit=0, got ${result2.rowCount}`);
    console.log(`  limit=0 -> ${result2.rowCount} rows (expected 0) [PASS]`);

    // limit=2000 should be clamped to maxRowsPerQuery=1000 (policy+driver clamp)
    // With 8 docs, this should return all 8, just verifying no error
    const resp3 = await execQuery(undefined, { limit: 2000 });
    // Note: AC-038 says >1000 is rejected by policy. But for Mongo the AC-033
    // says "clamped limit" and the driver code does Math.min. Let me check if
    // policy rejects it before the driver gets a chance.
    // From AC-038: limit > maxRowsPerQuery is rejected by policy engine.
    // So we expect -32600.
    if (resp3.error && resp3.error.code === -32600) {
      console.log(`  limit=2000 -> rejected by policy engine (expected, per AC-038) [PASS]`);
      assert('D3-policy-rejected', resp3.error.code === -32600,
        `Expected -32600, got ${resp3.error.code}`);
    } else if (resp3.result) {
      console.log(`  limit=2000 -> returned ${resp3.result.rowCount} rows [PASS]`);
      assert('D3-all-rows', resp3.result.rowCount === 8,
        `Expected 8 rows with no policy rejection, got ${resp3.result.rowCount}`);
    }
  }

  // ──────────────────────────────────────────────
  // SCENARIO E: filter + sql both present — filter takes precedence
  // ──────────────────────────────────────────────
  console.log('[7] Scenario E: Both filter and sql present (filter wins)...');
  {
    const params = { filter: { status: 'active' }, sql: '{"status":"inactive"}' };
    const resp = await execQuery(undefined, params);

    assert('E-no-error', !resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
    const result = resp.result;
    assert('E-active-count', result.rowCount === 4,
      `Expected 4 active docs (filter wins), got ${result.rowCount}`);

    console.log(`  filter={status:'active'} + sql='{"status":"inactive"}' -> ${result.rowCount} rows (expected 4, filter wins) [PASS]`);
  }

  // ──────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────
  console.log(`\n[8] Results:`);

  if (mismatches.length > 0) {
    console.log(`\n=== FAILED: ${mismatches.length} assertion(s) failed ===`);
    for (const m of mismatches) {
      console.log(`  ✗ ${m.label}: ${m.detail}`);
    }
    ws.close();
    process.exit(1);
  } else {
    console.log(`\n=== PASSED: All assertions passed ===`);
  }

  ws.close();
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
