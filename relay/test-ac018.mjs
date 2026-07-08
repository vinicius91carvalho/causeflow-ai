#!/usr/bin/env node
// Independent verification of AC-018 (describe_resource) at the real
// WebSocket boundary. Connects to the running control-plane stub on
// localhost:3000, sends JSON-RPC 2.0 describe_resource requests with
// unknown and known resource IDs, and validates the responses.

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const STUB_URL = 'ws://localhost:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';

function sendRequest(ws, method, params) {
  const id = uuidv4();
  const request = { jsonrpc: '2.0', id, method, params };
  ws.send(JSON.stringify(request));
  return id;
}

function waitForResponse(ws, expectedId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response id=${expectedId}`)), 10000);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === expectedId) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) {
        // skip non-JSON messages
      }
    };
    ws.on('message', handler);
  });
}

async function run() {
  console.log('=== AC-018 describe_resource verification ===\n');
  const failures = [];

  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    ws.on('open', () => { clearTimeout(timeout); resolve(); });
    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  console.log('Connected to control-plane stub\n');
  // Wait a tick for resource_update to arrive
  await new Promise(r => setTimeout(r, 500));

  // ----- Test 1: Unknown resource -----
  console.log('--- Test 1: describe_resource with unknown resourceId ---');
  {
    const id = sendRequest(ws, 'describe_resource', { resourceId: 'nonexistent' });
    const resp = await waitForResponse(ws, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    // Check error shape
    if (resp.jsonrpc !== '2.0') {
      failures.push('jsonrpc is not 2.0');
    }
    if (resp.id !== id) {
      failures.push(`id mismatch: expected ${id}, got ${resp.id}`);
    }
    if (!resp.error) {
      failures.push('Expected error response, got result');
    }
    if (resp.error?.code !== -32602) {
      failures.push(`Expected error code -32602, got ${resp.error?.code}`);
    }
    if (resp.error?.message !== 'Unknown resource: nonexistent') {
      failures.push(`Expected message "Unknown resource: nonexistent", got "${resp.error?.message}"`);
    }
    if (resp.result !== undefined) {
      failures.push('Unexpected result key in error response');
    }
  }

  // ----- Test 2: Valid Postgres resource -----
  console.log('\n--- Test 2: describe_resource with valid order-pg ---');
  {
    const id = sendRequest(ws, 'describe_resource', { resourceId: 'order-pg' });
    const resp = await waitForResponse(ws, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.jsonrpc !== '2.0') {
      failures.push('[pg] jsonrpc is not 2.0');
    }
    if (resp.id !== id) {
      failures.push(`[pg] id mismatch`);
    }
    if (resp.error) {
      failures.push(`[pg] Unexpected error: ${JSON.stringify(resp.error)}`);
    }
    if (!resp.result) {
      failures.push('[pg] Missing result');
    } else {
      if (!Array.isArray(resp.result.tables)) {
        failures.push('[pg] result.tables is not an array');
      }
      if (resp.result.type !== 'postgres') {
        failures.push(`[pg] Expected type "postgres", got "${resp.result.type}"`);
      }
      if (resp.result.database !== 'relay') {
        failures.push(`[pg] Expected database "relay", got "${resp.result.database}"`);
      }
      // Should have at least the orders table
      if (resp.result.tables.length === 0) {
        failures.push('[pg] Expected at least one table in order-pg');
      }
    }
  }

  // ----- Test 3: Valid MongoDB resource -----
  console.log('\n--- Test 3: describe_resource with valid order-mongo ---');
  {
    const id = sendRequest(ws, 'describe_resource', { resourceId: 'order-mongo' });
    const resp = await waitForResponse(ws, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.jsonrpc !== '2.0') {
      failures.push('[mongo] jsonrpc is not 2.0');
    }
    if (resp.id !== id) {
      failures.push(`[mongo] id mismatch`);
    }
    if (resp.error) {
      failures.push(`[mongo] Unexpected error: ${JSON.stringify(resp.error)}`);
    }
    if (!resp.result) {
      failures.push('[mongo] Missing result');
    } else {
      if (!Array.isArray(resp.result.tables)) {
        failures.push('[mongo] result.tables is not an array');
      }
      if (resp.result.type !== 'mongodb') {
        failures.push(`[mongo] Expected type "mongodb", got "${resp.result.type}"`);
      }
      if (resp.result.database !== 'relay') {
        failures.push(`[mongo] Expected database "relay", got "${resp.result.database}"`);
      }
    }
  }

  ws.close();

  // ----- Results -----
  console.log('\n=== Results ===');
  if (failures.length === 0) {
    console.log('All AC-018 checks PASSED');
    console.log(JSON.stringify({ integration: true, implementation: true, defects: [] }));
  } else {
    console.log('FAILURES:');
    failures.forEach(f => console.log(`  - ${f}`));
    const defects = failures.map(f => `expected valid describe_resource behavior; observed ${f}; evidence test-ac018.mjs`);
    console.log(JSON.stringify({ integration: false, implementation: true, defects }));
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Test error:', err);
  const defects = [`Test crashed: ${err.message}`];
  console.log(JSON.stringify({ integration: false, implementation: true, defects }));
  process.exitCode = 1;
});
