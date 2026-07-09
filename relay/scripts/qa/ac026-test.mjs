// AC-026 black-box test: postgres-driver `explain` operation.
//
// Connects to the control-plane-stub WebSocket server (which the relay is
// already connected to), sends execute requests with operation:'explain',
// and asserts the explain behavior at the real external WebSocket boundary.
//
// AC-026 contract:
//   - With a Postgres resource configured, an `execute` request with
//     `operation: 'explain'` runs `EXPLAIN ANALYZE <sql>` and returns
//     the explain rows verbatim.
//   - The pg-query-parser also runs on `explain`; multi-statement and
//     non-SELECT-shaped queries are rejected the same way as for `query`.
//
// Usage:
//   node scripts/qa/ac026-test.mjs
//   STUB_URL=ws://localhost:3000/v1/relay/connect node scripts/qa/ac026-test.mjs
//
// Dependencies: ws + Node stdlib only — zero vendor SDKs.
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_URL = process.env.STUB_URL || 'ws://localhost:3000/v1/relay/connect';
const TOKEN = process.env.RELAY_TOKEN || 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID || 'harness-tenant';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

let passed = 0;
let failed = 0;
const failures = [];

function log(msg, extra) {
  if (extra) console.log(`[ac026] ${msg}`, extra);
  else console.log(`[ac026] ${msg}`);
}

function assert(label, condition, detail) {
  if (condition) {
    log(`  PASS: ${label}`);
    passed++;
  } else {
    log(`  FAIL: ${label} — ${detail || 'assertion failed'}`);
    failed++;
    failures.push(`${label}: ${detail || 'assertion failed'}`);
  }
}

function sendRpc(ws, method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, id, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for response id=${id}`));
    }, timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === id) {
        cleanup();
        resolve(msg);
      }
    };
    const onClose = () => { cleanup(); reject(new Error('socket closed')); };
    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
    }
    ws.on('message', onMessage);
    ws.on('close', onClose);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = `${STUB_URL}?token=${TOKEN}&tenantId=${TENANT_ID}`;
  log(`connecting to ${url}`);

  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Tenant-Id': TENANT_ID,
    },
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  log('connected');
  log('');

  // ----------------------------------------------------------------
  // Helper: execute an explain query and return the RPC response
  // ----------------------------------------------------------------
  async function executeExplain(sql, retryOnNoRelay = true) {
    const params = { resourceId: 'order-pg', operation: 'explain', params: { sql } };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const id = sendRpc(ws, 'execute', params);
      const resp = await waitForResponse(ws, id);

      if (resp.error && resp.error.code === -32000 && retryOnNoRelay && attempt < MAX_RETRIES) {
        log(`relay not connected yet, retrying (${attempt}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return resp;
    }
    throw new Error('Max retries exceeded waiting for relay');
  }

  // ----------------------------------------------------------------
  // Helper: execute a query with operation:'query' for comparison
  // ----------------------------------------------------------------
  async function executeQuery(sql) {
    const params = { resourceId: 'order-pg', operation: 'query', params: { sql } };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const id = sendRpc(ws, 'execute', params);
      const resp = await waitForResponse(ws, id);

      if (resp.error && resp.error.code === -32000 && attempt < MAX_RETRIES) {
        log(`relay not connected yet, retrying (${attempt}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return resp;
    }
    throw new Error('Max retries exceeded waiting for relay');
  }

  // ----------------------------------------------------------------
  // Test 1: Basic explain of SELECT query — returns explain rows verbatim
  // ----------------------------------------------------------------
  log('--- Test 1: Explain a simple SELECT query ---');
  {
    const resp = await executeExplain('SELECT id, status, customer FROM orders WHERE id = 1');
    console.log(`  Response: ${JSON.stringify(resp, null, 2)}`);

    assert('response has no error', !resp.error, JSON.stringify(resp.error));

    // Verify response shape
    assert('result.rows is an array', Array.isArray(resp.result?.rows));
    assert('result.rowCount is > 0', resp.result?.rowCount > 0, `got ${resp.result?.rowCount}`);
    assert('result.rows length > 0', resp.result?.rows?.length > 0, `got ${resp.result?.rows?.length}`);
    assert('result.executionTimeMs is a number', typeof resp.result?.executionTimeMs === 'number');

    // Verify explain rows contain QUERY PLAN or explain-like structure
    // PG EXPLAIN ANALYZE returns rows with a 'QUERY PLAN' key or a text field
    const firstRow = resp.result?.rows?.[0];
    if (firstRow) {
      const rowKeys = Object.keys(firstRow);
      log(`  First row keys: ${JSON.stringify(rowKeys)}`);
      log(`  First row content (first 200 chars): ${JSON.stringify(firstRow).substring(0, 200)}`);

      // In pg, EXPLAIN ANALYZE typically returns rows with a 'QUERY PLAN' column
      // or similar plan-related content
      const hasPlanColumn = rowKeys.some(k =>
        k.toLowerCase().includes('plan') || k.toLowerCase().includes('query')
      );
      log(`  Has plan-related column: ${hasPlanColumn}`);

      // The rows must contain explain plan output (typically mentions "Seq Scan" or similar)
      const rowText = JSON.stringify(firstRow).toLowerCase();
      const hasPlanContent = rowText.includes('scan') || rowText.includes('plan') ||
                             rowText.includes('rows=') || rowText.includes('cost=') ||
                             rowText.includes('->') || rowText.includes('loop');
      assert('explain rows contain plan content (scan/rows/cost/loop)',
        hasPlanContent, `First row: ${JSON.stringify(firstRow).substring(0, 300)}`);
    }

    // Verify masked/maskedFieldCount are present (added by index.ts handler)
    assert('result.masked is boolean', typeof resp.result?.masked === 'boolean');
    assert('result.maskedFieldCount is number', typeof resp.result?.maskedFieldCount === 'number');
    log('');
  }

  // ----------------------------------------------------------------
  // Test 2: Explain a query returning all rows
  // ----------------------------------------------------------------
  log('--- Test 2: Explain a full table scan query ---');
  {
    const resp = await executeExplain('SELECT * FROM orders');
    console.log(`  Response summary: rows.length=${resp.result?.rows?.length}, rowCount=${resp.result?.rowCount}`);

    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows is an array', Array.isArray(resp.result?.rows));
    assert('result.rowCount > 0', resp.result?.rowCount > 0, `got ${resp.result?.rowCount}`);
    assert('result.executionTimeMs is a number', typeof resp.result?.executionTimeMs === 'number');
    assert('result.masked is boolean', typeof resp.result?.masked === 'boolean');
    assert('result.maskedFieldCount is number', typeof resp.result?.maskedFieldCount === 'number');
    log('');
  }

  // ----------------------------------------------------------------
  // Test 3: Multi-statement SQL is rejected (same as for query)
  // ----------------------------------------------------------------
  log('--- Test 3: Multi-statement SQL rejection on explain ---');
  {
    const resp = await executeExplain('SELECT 1; SELECT 2');
    console.log(`  Response: ${JSON.stringify(resp, null, 2)}`);

    assert('response has error', !!resp.error, `expected error, got result: ${JSON.stringify(resp.result)}`);
    if (resp.error) {
      assert('error code is -32602 (validation failure) or -32600',
        resp.error.code === -32602 || resp.error.code === -32600,
        `got code ${resp.error.code}`);
      assert('error message mentions multi-statement or validation',
        resp.error.message?.includes('Multi-statement') ||
        resp.error.message?.includes('multi-statement') ||
        resp.error.message?.includes('Validation'),
        `got message: ${resp.error.message}`);
    }
    log('');
  }

  // ----------------------------------------------------------------
  // Test 4: Non-SELECT shaped queries are rejected (same as for query)
  // ----------------------------------------------------------------
  log('--- Test 4: Non-SELECT query rejection on explain ---');
  {
    const resp = await executeExplain('INSERT INTO orders (id, status) VALUES (999, \'test\')');
    console.log(`  Response: ${JSON.stringify(resp, null, 2)}`);

    assert('response has error', !!resp.error, `expected error, got result: ${JSON.stringify(resp.result)}`);
    if (resp.error) {
      assert('error code is -32602 or -32600',
        resp.error.code === -32602 || resp.error.code === -32600,
        `got code ${resp.error.code}`);
      assert('error message mentions INSERT or not allowed',
        resp.error.message?.includes('INSERT') ||
        resp.error.message?.includes('not allowed') ||
        resp.error.message?.includes('Validation'),
        `got message: ${resp.error.message}`);
    }
    log('');
  }

  // ----------------------------------------------------------------
  // Test 5: Dangerous function is rejected on explain too
  // ----------------------------------------------------------------
  log('--- Test 5: Dangerous function rejection on explain ---');
  {
    const resp = await executeExplain('SELECT pg_sleep(0)');
    console.log(`  Response: ${JSON.stringify(resp, null, 2)}`);

    assert('response has error', !!resp.error, `expected error, got result: ${JSON.stringify(resp.result)}`);
    if (resp.error) {
      assert('error code is -32602 or -32600',
        resp.error.code === -32602 || resp.error.code === -32600,
        `got code ${resp.error.code}`);
      assert('error message mentions pg_sleep or dangerous function',
        resp.error.message?.includes('pg_sleep') ||
        resp.error.message?.includes('dangerous') ||
        resp.error.message?.includes('Dangerous') ||
        resp.error.message?.includes('Validation'),
        `got message: ${resp.error.message}`);
    }
    log('');
  }

  // ----------------------------------------------------------------
  // Test 6: Verify that a regular query still works (backward compat)
  // ----------------------------------------------------------------
  log('--- Test 6: Regular query still works (backward compat) ---');
  {
    const resp = await executeQuery('SELECT id, status FROM orders ORDER BY id');
    console.log(`  Response summary: rowCount=${resp.result?.rowCount}, rows.length=${resp.result?.rows?.length}`);

    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows is an array', Array.isArray(resp.result?.rows));
    assert('result.rowCount > 0', resp.result?.rowCount > 0, `got ${resp.result?.rowCount}`);
    assert('result.fields is an array', Array.isArray(resp.result?.fields));
    assert('result.executionTimeMs is a number', typeof resp.result?.executionTimeMs === 'number');
    log('');
  }

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  const total = passed + failed;
  log('='.repeat(50));
  log(`AC-026 Results: ${passed}/${total} passed, ${failed} failed`);
  if (failures.length > 0) {
    log(`Failures: ${failures.join('; ')}`);
  }
  log('='.repeat(50));

  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
