// AC-025 black-box test: postgres-driver limit clamping.
//
// Connects to the control-plane-stub WebSocket server (which the relay is
// already connected to), sends execute requests with various limit values,
// and asserts the clamped behavior at the real external WebSocket boundary.
//
// Usage:
//   node scripts/qa/ac025-test.mjs
//   STUB_URL=ws://localhost:3000/v1/relay/connect node scripts/qa/ac025-test.mjs
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

function log(msg, extra) {
  if (extra) console.log(`[ac025] ${msg}`, extra);
  else console.log(`[ac025] ${msg}`);
}

function assert(label, condition, detail) {
  if (condition) {
    log(`  PASS: ${label}`);
    passed++;
  } else {
    log(`  FAIL: ${label} — ${detail || 'assertion failed'}`);
    failed++;
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
  // Helper: execute a query with optional limit and return the RPC response
  // ----------------------------------------------------------------
  async function executeQuery(limit, retryOnNoRelay = true) {
    const params = { resourceId: 'order-pg', operation: 'query', params: { sql: 'SELECT id, status, customer, total_cents FROM orders ORDER BY id' } };
    if (limit !== undefined) {
      params.params.limit = limit;
    }

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
  // Test 1: No explicit limit — defaults to maxRowsPerQuery (1000),
  // returns all 5 orders rows.
  // ----------------------------------------------------------------
  log('--- Test 1: No explicit limit (defaults to maxRows=1000) ---');
  {
    const resp = await executeQuery(undefined);
    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows is an array', Array.isArray(resp.result?.rows));
    assert('result.rowCount is 5', resp.result?.rowCount === 5, `got ${resp.result?.rowCount}`);
    assert('result.rows length is 5', resp.result?.rows?.length === 5, `got ${resp.result?.rows?.length}`);
    assert('result.executionTimeMs is a number', typeof resp.result?.executionTimeMs === 'number');
    log('');
  }

  // ----------------------------------------------------------------
  // Test 2: limit=3 — clamped to 3, returns 3 rows (ids 1,2,3)
  // ----------------------------------------------------------------
  log('--- Test 2: limit=3 (within maxRows=1000) ---');
  {
    const resp = await executeQuery(3);
    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows length is 3', resp.result?.rows?.length === 3, `got ${resp.result?.rows?.length}`);
    assert('result.rowCount is 3', resp.result?.rowCount === 3, `got ${resp.result?.rowCount}`);
    assert('first row id is 1', resp.result?.rows?.[0]?.id === 1, `got ${resp.result?.rows?.[0]?.id}`);
    assert('second row id is 2', resp.result?.rows?.[1]?.id === 2, `got ${resp.result?.rows?.[1]?.id}`);
    assert('third row id is 3', resp.result?.rows?.[2]?.id === 3, `got ${resp.result?.rows?.[2]?.id}`);
    log('');
  }

  // ----------------------------------------------------------------
  // Test 3: limit=5 — within maxRows=1000, returns all 5 rows
  // ----------------------------------------------------------------
  log('--- Test 3: limit=5 (within maxRows=1000) ---');
  {
    const resp = await executeQuery(5);
    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows length is 5', resp.result?.rows?.length === 5, `got ${resp.result?.rows?.length}`);
    assert('result.rowCount is 5', resp.result?.rowCount === 5, `got ${resp.result?.rowCount}`);
    assert('rows ids are [1,2,3,4,5]', 
      resp.result?.rows?.map(r => r.id).join(',') === '1,2,3,4,5',
      `got ${resp.result?.rows?.map(r => r.id).join(',')}`
    );
    log('');
  }

  // ----------------------------------------------------------------
  // Test 4: limit=2000 — exceeds maxRowsPerQuery (1000), rejected by
  // policy engine with error code -32600 and message containing
  // "Row limit 2000 exceeds maximum 1000".
  // ----------------------------------------------------------------
  log('--- Test 4: limit=2000 (exceeds maxRows=1000) ---');
  {
    const resp = await executeQuery(2000);
    assert('response has error', !!resp.error, `expected error, got result: ${JSON.stringify(resp.result)}`);
    assert('error code is -32600', resp.error?.code === -32600, `got code ${resp.error?.code}`);
    assert('error message mentions Row limit 2000', 
      resp.error?.message?.includes('Row limit 2000 exceeds maximum 1000'),
      `got message: ${resp.error?.message}`
    );
    // Verify that no result is returned when denied
    assert('no result key when denied', resp.result === undefined, `got result: ${JSON.stringify(resp.result)}`);
    log('');
  }

  // ----------------------------------------------------------------
  // Test 5: limit=0 — edge case: zero is <= 1000, should be allowed
  // (returns 0 rows due to LIMIT 0)
  // ----------------------------------------------------------------
  log('--- Test 5: limit=0 (edge case, within maxRows) ---');
  {
    const resp = await executeQuery(0);
    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows length is 0', resp.result?.rows?.length === 0, `got ${resp.result?.rows?.length}`);
    assert('result.rowCount is 0', resp.result?.rowCount === 0, `got ${resp.result?.rowCount}`);
    log('');
  }

  // ----------------------------------------------------------------
  // Test 6: limit=1000 — edge case: N === maxRows, allowed and returns
  // all 5 rows (500 would also do but 5 rows is what the table has)
  // ----------------------------------------------------------------
  log('--- Test 6: limit=1000 (N === maxRows=1000) ---');
  {
    const resp = await executeQuery(1000);
    assert('response has no error', !resp.error, JSON.stringify(resp.error));
    assert('result.rows length is 5', resp.result?.rows?.length === 5, `got ${resp.result?.rows?.length}`);
    assert('result.rowCount is 5', resp.result?.rowCount === 5, `got ${resp.result?.rowCount}`);
    log('');
  }

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  const total = passed + failed;
  log('='.repeat(50));
  log(`AC-025 Results: ${passed}/${total} passed, ${failed} failed`);
  log('='.repeat(50));

  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
