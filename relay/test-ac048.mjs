#!/usr/bin/env node
// Black-box test for AC-048: unhandled error inside request handler.
//
// Tests:
// 1. Sends a valid execute request to verify baseline functionality (via stub forwarding)
// 2. Sends an execute request that passes validation but fails at the driver
//    level (SELECT from non-existent table)
// 3. Verifies the response is a JSON-RPC error with code -32603
// 4. Sends another valid request after the error to verify the relay is still
//    running and the WS client is not closed
// 5. Checks relay logs for the error log with { err, requestId }

import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

const STUB_URL = 'ws://127.0.0.1:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const COMPOSE_PROJECT = 'relay';
const RELAY_CONTAINER = 'relay';
const TIMEOUT_MS = 15000;

function sendRpc(ws, method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, expectedId, timeoutMs = TIMEOUT_MS) {
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

function getRelayLogs(lines = 100) {
  try {
    return execSync(
      `docker compose -p ${COMPOSE_PROJECT} logs relay --tail ${lines} 2>&1`,
      { encoding: 'utf8', timeout: 10000 }
    );
  } catch {
    return '';
  }
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

async function main() {
  console.log('=== AC-048: Unhandled Error in Request Handler ===\n');

  // Step 0: Verify relay is running and connected
  const status = getContainerStatus(RELAY_CONTAINER);
  console.log(`[STEP 0] Relay container status: ${status}`);
  if (status !== 'running') {
    console.error('FAIL: Relay container is not running');
    process.exit(1);
  }

  const logsBefore = getRelayLogs(30);
  if (!logsBefore.includes('Connected to control plane')) {
    console.error('FAIL: Relay did not connect to control plane');
    process.exit(1);
  }
  console.log('[STEP 0] Relay is running and connected - OK\n');

  // Step 1: Connect to stub as test client and send RPCs through the stub's
  // forwarding mechanism. This requires the stub to properly track relayWs,
  // which is done via the resource_update message-based handshake.
  console.log('[STEP 1] Connecting to control plane stub as test client...');
  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out connecting to stub')), 10000);
    ws.on('open', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
  console.log('[STEP 1] Connected to stub - OK\n');

  // Step 2: Send a valid execute request (baseline)
  console.log('[STEP 2] Sending valid execute request (SELECT 1)...');
  const baselineId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS one' },
  });
  const baseline = await waitForResponse(ws, baselineId);
  console.log(`[STEP 2] Baseline response: ${baseline.result ? 'result received' : 'error: ' + JSON.stringify(baseline.error)}`);
  if (baseline.error) {
    console.error(`FAIL: Baseline execute failed: ${JSON.stringify(baseline.error)}`);
    process.exit(1);
  }
  console.log('[STEP 2] Baseline valid request succeeded - OK\n');

  // Step 3: Send an execute request that passes validation but fails at driver
  // level (SELECT from non-existent table)
  console.log('[STEP 3] Sending execute that will fail at driver level (non-existent table)...');
  const errorId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT * FROM nonexistent_table_12345' },
  });
  const errorResponse = await waitForResponse(ws, errorId);
  console.log(`[STEP 3] Error response: ${JSON.stringify(errorResponse)}`);

  // Verify it's a JSON-RPC error with code -32603
  if (!errorResponse.error) {
    console.error('FAIL: Expected error response, got result');
    process.exit(1);
  }
  if (errorResponse.error.code !== -32603) {
    console.error(`FAIL: Expected error code -32603, got ${errorResponse.error.code}`);
    process.exit(1);
  }
  if (!errorResponse.error.message || errorResponse.error.message === '') {
    console.error('FAIL: Expected non-empty error message');
    process.exit(1);
  }
  console.log(`[STEP 3] Correct error code -32603 with message: "${errorResponse.error.message}" - OK\n`);

  // Step 4: Send another valid request to verify relay is still running
  console.log('[STEP 4] Sending another valid request to verify relay still running...');
  const afterId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS still_alive' },
  });
  const after = await waitForResponse(ws, afterId);
  console.log(`[STEP 4] Post-error response: ${after.result ? 'result received' : 'error: ' + JSON.stringify(after.error)}`);
  if (after.error) {
    console.error(`FAIL: Post-error execute failed: ${JSON.stringify(after.error)}`);
    process.exit(1);
  }
  console.log('[STEP 4] Relay still processes requests after error - OK\n');

  // Step 5: Check relay logs for the error log with { err, requestId }
  console.log('[STEP 5] Checking relay logs for error log...');
  const logsAfter = getRelayLogs(100);

  if (!logsAfter.includes('Request handler error')) {
    console.error('FAIL: Expected "Request handler error" in relay logs');
    console.error('--- relay logs ---');
    console.error(logsAfter);
    console.error('--- end ---');
    process.exit(1);
  }
  console.log('[STEP 5] "Request handler error" found in logs - OK');

  if (logsAfter.includes('requestId')) {
    console.log('[STEP 5] Error log includes requestId - OK');
  } else {
    console.error('FAIL: Error log should include requestId');
    process.exit(1);
  }

  // Verify the process stayed running
  const statusAfter = getContainerStatus(RELAY_CONTAINER);
  if (statusAfter !== 'running') {
    console.error(`FAIL: Relay should still be running after error, got status: ${statusAfter}`);
    process.exit(1);
  }
  console.log('[STEP 5] Relay still running (process not crashed) - OK\n');

  ws.close();

  console.log('=== AC-048 PASSED ===');
  const result = JSON.stringify({
    test: 'AC-048',
    passed: true,
    details: {
      baselineSuccess: true,
      driverErrorReturned: errorResponse.error.code === -32603,
      errorMessagePresent: !!errorResponse.error.message,
      relayStillRunning: true,
      postErrorBaseline: true,
      requestIdInErrorLog: true,
    },
  });
  console.log(result);
}

main().catch((err) => {
  console.error(`Test failed with error: ${err.message}`);
  process.exit(1);
});
