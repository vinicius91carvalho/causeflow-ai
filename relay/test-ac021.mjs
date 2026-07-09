#!/usr/bin/env node
// Black-box test for AC-021.
//
// Verifies:
// A JSON-RPC 2.0 `execute` request with `params.resourceId = 'main-pg'` (or the
// configured Postgres resource), `params.operation = 'query'`, and
// `params.params = { sql: 'SELECT id, status FROM orders' }` returns a JSON-RPC 2.0
// response whose `result` shape is `{ rows, rowCount, fields, executionTimeMs,
// masked: <maskedFieldCount > 0>, maskedFieldCount }`. The `result.masked` and
// `result.maskedFieldCount` reflect the masking step's output.

import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

const STUB_PORT = parseInt(process.env.STUB_PORT || '5191', 10);
const STUB_URL = `ws://127.0.0.1:${STUB_PORT}/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant`;
const COMPOSE_PROJECT = 'relay';
const RELAY_CONTAINER = 'relay';
const TIMEOUT_MS = 15000;

let ws;

function sendRpc(method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(expectedId, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for response id=${expectedId}`));
    }, timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === expectedId) {
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

function getContainerStatus(containerName) {
  try {
    return execSync(
      `docker inspect ${containerName} --format '{{.State.Status}}'`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
  } catch {
    return 'not-found';
  }
}

async function connectToStub() {
  ws = new WebSocket(STUB_URL);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out connecting to stub')), 10000);
    ws.on('open', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

async function main() {
  console.log('=== AC-021: Execute query response shape ===\n');

  // Step 0: Verify relay is running and connected
  const status = getContainerStatus(RELAY_CONTAINER);
  console.log(`[STEP 0] Relay container status: ${status}`);
  if (status !== 'running') {
    console.error('FAIL: Relay container is not running');
    process.exit(1);
  }
  console.log('[STEP 0] Relay is running - OK\n');

  // Step 1: Connect to control plane stub as test client
  console.log('[STEP 1] Connecting to control plane stub as test client...');
  await connectToStub();
  console.log('[STEP 1] Connected - OK\n');

  // ---- Test 1: Execute SELECT id, status FROM orders ----
  console.log('--- Test 1: Execute with resourceId=order-pg, operation=query, SELECT id, status FROM orders ---');
  console.log('[TEST 1] Sending execute request...');

  const execId = sendRpc('execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT id, status FROM orders' },
  });
  const resp = await waitForResponse(execId);
  console.log(`  Response: ${JSON.stringify(resp)}`);

  // Verify no error
  if (resp.error) {
    console.error(`FAIL: Expected successful response, got error: ${JSON.stringify(resp.error)}`);
    process.exit(1);
  }
  console.log('  PASS: No error in response');

  // Verify jsonrpc: '2.0'
  if (resp.jsonrpc !== '2.0') {
    console.error(`FAIL: Expected jsonrpc: '2.0', got: ${resp.jsonrpc}`);
    process.exit(1);
  }
  console.log('  PASS: jsonrpc is "2.0"');

  // Verify id echoed
  if (resp.id !== execId) {
    console.error(`FAIL: Expected id: ${execId}, got: ${resp.id}`);
    process.exit(1);
  }
  console.log('  PASS: id echoed correctly');

  // Verify result shape
  const r = resp.result;
  if (!r) {
    console.error('FAIL: Expected result object');
    process.exit(1);
  }

  // Check rows
  if (!Array.isArray(r.rows)) {
    console.error(`FAIL: Expected rows to be an array, got: ${typeof r.rows}`);
    process.exit(1);
  }
  console.log(`  PASS: rows is an array with ${r.rows.length} entries`);

  // Check rowCount
  if (typeof r.rowCount !== 'number') {
    console.error(`FAIL: Expected rowCount to be a number, got: ${typeof r.rowCount}`);
    process.exit(1);
  }
  // The orders table has 5 rows
  if (r.rowCount !== 5) {
    console.error(`FAIL: Expected rowCount to be 5, got: ${r.rowCount}`);
    process.exit(1);
  }
  console.log(`  PASS: rowCount is ${r.rowCount}`);

  // Check that row values are correct (id and status)
  if (r.rows.length > 0) {
    const validRow = r.rows[0] && typeof r.rows[0].id === 'number' && typeof r.rows[0].status === 'string';
    if (!validRow) {
      console.error(`FAIL: Row entries should have id (number) and status (string), got: ${JSON.stringify(r.rows[0])}`);
      process.exit(1);
    }
    console.log(`  PASS: Row entries have id (number) and status (string)`);
  }

  // Check fields
  if (!Array.isArray(r.fields)) {
    console.error(`FAIL: Expected fields to be an array, got: ${typeof r.fields}`);
    process.exit(1);
  }
  if (r.fields.length < 2) {
    console.error(`FAIL: Expected at least 2 fields (id, status), got: ${r.fields.length}`);
    process.exit(1);
  }
  const hasIdField = r.fields.some(f => f.name === 'id');
  const hasStatusField = r.fields.some(f => f.name === 'status');
  if (!hasIdField || !hasStatusField) {
    console.error(`FAIL: Fields missing id and/or status - ${JSON.stringify(r.fields)}`);
    process.exit(1);
  }
  console.log('  PASS: fields contains id and status entries');

  // Check executionTimeMs
  if (typeof r.executionTimeMs !== 'number') {
    console.error(`FAIL: Expected executionTimeMs to be a number, got: ${typeof r.executionTimeMs}`);
    process.exit(1);
  }
  if (r.executionTimeMs < 0) {
    console.error(`FAIL: Expected executionTimeMs >= 0, got: ${r.executionTimeMs}`);
    process.exit(1);
  }
  console.log(`  PASS: executionTimeMs is ${r.executionTimeMs}ms`);

  // Check masked (boolean)
  if (typeof r.masked !== 'boolean') {
    console.error(`FAIL: Expected masked to be a boolean, got: ${typeof r.masked}`);
    process.exit(1);
  }
  console.log(`  PASS: masked is ${r.masked}`);

  // Check maskedFieldCount (number)
  if (typeof r.maskedFieldCount !== 'number') {
    console.error(`FAIL: Expected maskedFieldCount to be a number, got: ${typeof r.maskedFieldCount}`);
    process.exit(1);
  }
  console.log(`  PASS: maskedFieldCount is ${r.maskedFieldCount}`);

  // Check that masked === (maskedFieldCount > 0)
  if (r.masked !== (r.maskedFieldCount > 0)) {
    console.error(`FAIL: masked (${r.masked}) should equal maskedFieldCount > 0 (${r.maskedFieldCount > 0})`);
    process.exit(1);
  }
  console.log('  PASS: masked === (maskedFieldCount > 0)');

  // ---- Test 2: Verify masking works with PII data ----
  console.log('\n--- Test 2: Execute with PII data to verify masking flag ---');
  console.log('[TEST 2] Sending execute request with CPF value...');

  const maskId = sendRpc('execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: "SELECT '123.456.789-00' AS cpf, 'plain text' AS plain" },
  });
  const maskResp = await waitForResponse(maskId);
  console.log(`  Result: ${JSON.stringify(maskResp.result)}`);

  if (maskResp.error) {
    console.error(`FAIL: Got error: ${JSON.stringify(maskResp.error)}`);
    process.exit(1);
  }

  const mr = maskResp.result;
  if (mr.masked !== true) {
    console.error(`FAIL: Expected masked=true when PII is present, got: ${mr.masked}`);
    process.exit(1);
  }
  if (mr.maskedFieldCount <= 0) {
    console.error(`FAIL: Expected maskedFieldCount > 0 when PII is present, got: ${mr.maskedFieldCount}`);
    process.exit(1);
  }
  if (mr.rows[0].cpf !== '***.***.***-**') {
    console.error(`FAIL: Expected CPF to be masked, got: ${mr.rows[0].cpf}`);
    process.exit(1);
  }
  if (mr.rows[0].plain !== 'plain text') {
    console.error(`FAIL: Expected plain text to remain unchanged, got: ${mr.rows[0].plain}`);
    process.exit(1);
  }
  console.log('  PASS: masking correctly masks CPF and sets masked=true');
  console.log('  PASS: non-PII fields remain unchanged');

  ws.close();

  console.log('\n=== AC-021 PASSED ===');
  const result = JSON.stringify({
    test: 'AC-021',
    passed: true,
    details: {
      responseShape: {
        rows: 'array',
        rowCount: 5,
        fields: ['id (int4)', 'status (text)'],
        executionTimeMs: 'number >= 0',
        masked: false,
        maskedFieldCount: 0,
        maskedEqualsCondition: true,
      },
      maskingBehaviour: {
        maskedWhenPII: true,
        maskedFieldCountWhenPII: '> 0',
        cpfMasked: '***.***.***-**',
        plainTextUnchanged: true,
      },
    },
  });
  console.log(result);
}

main().catch((err) => {
  console.error(`Test failed with error: ${err.message}`);
  if (ws) ws.close();
  process.exit(1);
});
