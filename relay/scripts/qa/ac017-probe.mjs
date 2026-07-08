// AC-017 Integrated Verification Probe
// Tests list_resources at the real WebSocket boundary via the control-plane stub.
// Connects as a test client to the stub (port 3000), sends a list_resources
// request with no params, and validates the response shape.

import { WebSocket } from 'ws';

const STUB_URL = 'ws://127.0.0.1:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const TIMEOUT_MS = 15000;

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
  console.log('=== AC-017 Integrated Verification ===');
  console.log('Connecting to control-plane stub at', STUB_URL);

  const ws = await connect();
  console.log('Connected to stub.');

  // Send list_resources with NO params (per AC "no params")
  const id = crypto.randomUUID();
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'list_resources',
    params: {},
  }));
  console.log(`Sent list_resources request (id=${id})`);

  // Wait for response
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('timeout waiting for list_resources response'));
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

  // 5. result has at least 1 resource
  if (response.result.length === 0) {
    allPass = false;
    defects.push('result: expected at least 1 resource, got 0');
  } else {
    console.log(`PASS: result has ${response.result.length} resource(s)`);
  }

  // 6. Every resource has the correct shape
  const requiredKeys = ['resourceId', 'type', 'name', 'database', 'readOnly'];
  for (let i = 0; i < response.result.length; i++) {
    const r = response.result[i];

    // Check all required keys present and no extras
    const keys = Object.keys(r).sort();
    const expectedKeys = [...requiredKeys].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      allPass = false;
      defects.push(`resource[${i}] keys: expected [${expectedKeys}], got [${keys}]`);
    } else {
      console.log(`PASS: resource[${i}] has correct keys`);
    }

    // Check readOnly is true
    if (r.readOnly !== true) {
      allPass = false;
      defects.push(`resource[${i}] readOnly: expected true, got ${r.readOnly}`);
    } else {
      console.log(`PASS: resource[${i}] readOnly is true`);
    }

    // Check type is postgres or mongodb
    if (r.type !== 'postgres' && r.type !== 'mongodb') {
      allPass = false;
      defects.push(`resource[${i}] type: expected 'postgres' or 'mongodb', got '${r.type}'`);
    } else {
      console.log(`PASS: resource[${i}] type is ${r.type}`);
    }

    // Check resourceId is a non-empty string
    if (!r.resourceId || typeof r.resourceId !== 'string') {
      allPass = false;
      defects.push(`resource[${i}] resourceId: expected non-empty string, got '${r.resourceId}'`);
    } else {
      console.log(`PASS: resource[${i}] resourceId is '${r.resourceId}'`);
    }

    // Check name is a non-empty string
    if (!r.name || typeof r.name !== 'string') {
      allPass = false;
      defects.push(`resource[${i}] name: expected non-empty string, got '${r.name}'`);
    } else {
      console.log(`PASS: resource[${i}] name is '${r.name}'`);
    }

    // database should be a string
    if (typeof r.database !== 'string') {
      allPass = false;
      defects.push(`resource[${i}] database: expected string, got ${typeof r.database}`);
    } else {
      console.log(`PASS: resource[${i}] database is '${r.database}'`);
    }
  }

  // 7. Both expected resources exist
  const resourceIds = response.result.map(r => r.resourceId);
  if (!resourceIds.includes('order-pg')) {
    allPass = false;
    defects.push('Expected resource "order-pg" not found');
  } else {
    console.log('PASS: order-pg resource present');
  }
  if (!resourceIds.includes('order-mongo')) {
    allPass = false;
    defects.push('Expected resource "order-mongo" not found');
  } else {
    console.log('PASS: order-mongo resource present');
  }

  // 8. Response shape equals createResponse(id, resources) — should be { jsonrpc: '2.0', id, result: [...] }
  const responseKeys = Object.keys(response).sort();
  const expectedResponseKeys = ['id', 'jsonrpc', 'result'].sort();
  if (JSON.stringify(responseKeys) !== JSON.stringify(expectedResponseKeys)) {
    allPass = false;
    defects.push(`Response top-level keys: expected [${expectedResponseKeys}], got [${responseKeys}]`);
  } else {
    console.log('PASS: response shape matches createResponse(id, result)');
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
