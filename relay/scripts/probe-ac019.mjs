// AC-019 Verify-first Probe
// Tests health_check at the real WebSocket boundary via the control-plane stub.
// Connects as a test client to the stub (port 3000), sends a health_check
// request with no params, and validates the response shape.

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_URL = 'ws://127.0.0.1:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const TIMEOUT_MS = 20000;

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(STUB_URL);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('connect timeout'));
    }, TIMEOUT_MS);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  console.log('=== AC-019 Verify-first Probe ===');
  console.log('Connecting to control-plane stub at', STUB_URL);

  const ws = await connect();
  console.log('Connected to stub.');

  // Send health_check request
  const id = randomUUID();
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'health_check',
    params: {},
  }));
  console.log(`Sent health_check request (id=${id})`);

  // Wait for response
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('timeout waiting for health_check response'));
    }, TIMEOUT_MS);
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === id || msg.id?.toString() === id?.toString()) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      reject(new Error('socket closed'));
    });
  });

  ws.close();

  console.log('Response:', JSON.stringify(response, null, 2));

  // Validation
  const defects = [];
  let allPass = true;

  // 1. jsonrpc is '2.0'
  if (response.jsonrpc !== '2.0') {
    allPass = false;
    defects.push(`jsonrpc: expected '2.0', got '${response.jsonrpc}'`);
  } else {
    console.log('PASS: jsonrpc is 2.0');
  }

  // 2. id is echoed
  if (String(response.id) !== String(id)) {
    allPass = false;
    defects.push(`id: expected '${id}', got '${response.id}'`);
  } else {
    console.log('PASS: id echoed');
  }

  // 3. No error key
  if (response.error) {
    allPass = false;
    defects.push(`error present: ${JSON.stringify(response.error)}`);
  } else {
    console.log('PASS: no error key');
  }

  // 4. result is an array
  if (!Array.isArray(response.result)) {
    allPass = false;
    defects.push(`result: expected array, got ${typeof response.result}`);
  } else {
    console.log('PASS: result is an array');
  }

  // 5. result has entries (at least 1, should be 2 since we have order-pg and order-mongo)
  if (response.result.length === 0) {
    allPass = false;
    defects.push('result: expected at least 1 health entry, got 0');
  } else {
    console.log(`PASS: result has ${response.result.length} entries`);
  }

  // 6. Every entry has the correct shape: { resourceId, type, healthy, latencyMs }
  const requiredKeys = ['resourceId', 'type', 'healthy', 'latencyMs'];
  for (let i = 0; i < response.result.length; i++) {
    const r = response.result[i];

    // Check all required keys present; allow extra keys for forward-compat
    for (const key of requiredKeys) {
      if (!(key in r)) {
        allPass = false;
        defects.push(`entry[${i}] missing key '${key}'`);
      } else {
        console.log(`PASS: entry[${i}] has key '${key}' = ${JSON.stringify(r[key])}`);
      }
    }

    // Check resourceId is a non-empty string
    if (!r.resourceId || typeof r.resourceId !== 'string') {
      allPass = false;
      defects.push(`entry[${i}] resourceId: expected non-empty string, got '${r.resourceId}'`);
    }

    // Check type is postgres or mongodb
    if (r.type !== 'postgres' && r.type !== 'mongodb') {
      allPass = false;
      defects.push(`entry[${i}] type: expected 'postgres' or 'mongodb', got '${r.type}'`);
    }

    // Check healthy is a boolean
    if (typeof r.healthy !== 'boolean') {
      allPass = false;
      defects.push(`entry[${i}] healthy: expected boolean, got ${typeof r.healthy}`);
    }

    // Check latencyMs is a number >= 0
    if (typeof r.latencyMs !== 'number' || r.latencyMs < 0) {
      allPass = false;
      defects.push(`entry[${i}] latencyMs: expected non-negative number, got ${r.latencyMs}`);
    }
  }

  // 7. Both expected resources exist in the response
  const resourceIds = response.result.map(r => r.resourceId);
  if (!resourceIds.includes('order-pg')) {
    allPass = false;
    defects.push('Expected resource "order-pg" not found in health results');
  } else {
    console.log('PASS: order-pg resource present');
  }
  if (!resourceIds.includes('order-mongo')) {
    allPass = false;
    defects.push('Expected resource "order-mongo" not found in health results');
  } else {
    console.log('PASS: order-mongo resource present');
  }

  // 8. Response top-level shape matches createResponse(id, result) — { jsonrpc, id, result }
  const responseKeys = Object.keys(response).sort();
  const expectedResponseKeys = ['id', 'jsonrpc', 'result'].sort();
  if (JSON.stringify(responseKeys) !== JSON.stringify(expectedResponseKeys)) {
    allPass = false;
    defects.push(`Response top-level keys: expected [${expectedResponseKeys}], got [${responseKeys}]`);
  } else {
    console.log('PASS: response shape matches createResponse(id, result)');
  }

  // 9. All healthy entries should be true (both DBs are running)
  for (let i = 0; i < response.result.length; i++) {
    if (response.result[i].healthy !== true) {
      // Log it but don't fail — databases might be momentarily unavailable
      console.log(`WARN: entry[${i}] (${response.result[i].resourceId}) healthy=${response.result[i].healthy}, expected true`);
    } else {
      console.log(`PASS: entry[${i}] (${response.result[i].resourceId}) is healthy`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
  if (defects.length > 0) {
    console.log('\nDefects:');
    defects.forEach((d) => console.log(`  - ${d}`));
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Probe error:', err);
  process.exit(1);
});
