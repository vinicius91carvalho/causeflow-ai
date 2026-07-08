// AC-018 Integrated Verification Probe
// Tests describe_resource at the real WebSocket boundary via the control-plane stub.
// 1. describe_resource with unknown resourceId -> JSON-RPC error -32602
// 2. describe_resource with valid 'order-pg' -> { tables, type, database }
// 3. describe_resource with valid 'order-mongo' -> { tables, type, database }

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

function sendAndWait(ws, msg, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const id = msg.id;
    const timer = setTimeout(() => {
      reject(new Error(`timeout waiting for response to ${id}`));
    }, timeoutMs);
    ws.on('message', (raw) => {
      let parsed;
      try { parsed = JSON.parse(raw.toString()); } catch { return; }
      if (parsed.id === id || parsed.id?.toString() === id?.toString()) {
        clearTimeout(timer);
        resolve(parsed);
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      reject(new Error('socket closed'));
    });
    ws.send(JSON.stringify(msg));
  });
}

async function main() {
  console.log('=== AC-018 Integrated Verification ===');
  console.log(`Connecting to control-plane stub at ${STUB_URL}`);

  const ws = await connect();
  console.log('Connected to stub.\n');

  const defects = [];
  let allPass = true;

  // --- Test 1: Unknown resourceId ---
  console.log('--- Test 1: describe_resource with unknown resourceId ---');
  const req1Id = 'ac018-unknown';
  const resp1 = await sendAndWait(ws, {
    jsonrpc: '2.0',
    id: req1Id,
    method: 'describe_resource',
    params: { resourceId: 'unknown-resource' },
  });
  console.log(`Response: ${JSON.stringify(resp1, null, 2)}`);

  // Check it's an error response
  if (resp1.jsonrpc !== '2.0') {
    allPass = false;
    defects.push(`Test 1: expected jsonrpc '2.0', got '${resp1.jsonrpc}'`);
  } else {
    console.log('PASS: jsonrpc is 2.0');
  }

  if (String(resp1.id) !== req1Id) {
    allPass = false;
    defects.push(`Test 1: expected id '${req1Id}', got '${resp1.id}'`);
  } else {
    console.log('PASS: id echoed');
  }

  if (!resp1.error) {
    allPass = false;
    defects.push('Test 1: expected error key, none present');
  } else {
    console.log('PASS: error key present');
  }

  if (resp1.error?.code !== -32602) {
    allPass = false;
    defects.push(`Test 1: expected error.code -32602, got ${resp1.error?.code}`);
  } else {
    console.log(`PASS: error.code is -32602`);
  }

  if (resp1.error?.message !== 'Unknown resource: unknown-resource') {
    allPass = false;
    defects.push(`Test 1: expected error.message 'Unknown resource: unknown-resource', got '${resp1.error?.message}'`);
  } else {
    console.log(`PASS: error.message is 'Unknown resource: unknown-resource'`);
  }

  // Check no result key on error
  if ('result' in resp1) {
    allPass = false;
    defects.push('Test 1: error response should not have result key');
  } else {
    console.log('PASS: no result key on error response');
  }

  console.log('');

  // --- Test 2: Valid resourceId 'order-pg' ---
  console.log('--- Test 2: describe_resource with valid resourceId "order-pg" ---');
  const req2Id = 'ac018-valid-pg';
  const resp2 = await sendAndWait(ws, {
    jsonrpc: '2.0',
    id: req2Id,
    method: 'describe_resource',
    params: { resourceId: 'order-pg' },
  });
  console.log(`Response: ${JSON.stringify(resp2, null, 2)}`);

  if (resp2.jsonrpc !== '2.0') {
    allPass = false;
    defects.push(`Test 2: expected jsonrpc '2.0', got '${resp2.jsonrpc}'`);
  } else {
    console.log('PASS: jsonrpc is 2.0');
  }

  if (String(resp2.id) !== req2Id) {
    allPass = false;
    defects.push(`Test 2: expected id '${req2Id}', got '${resp2.id}'`);
  } else {
    console.log('PASS: id echoed');
  }

  if (resp2.error) {
    allPass = false;
    defects.push(`Test 2: unexpected error key: ${JSON.stringify(resp2.error)}`);
  } else {
    console.log('PASS: no error key');
  }

  const r2 = resp2.result;
  if (!r2) {
    allPass = false;
    defects.push('Test 2: expected result key, none present');
  } else {
    console.log('PASS: result key present');

    // Check tables is an array
    if (!Array.isArray(r2.tables)) {
      allPass = false;
      defects.push(`Test 2: expected result.tables to be array, got ${typeof r2.tables}`);
    } else {
      console.log(`PASS: tables is an array (length ${r2.tables.length})`);
      // Check orders table exists
      const ordersTable = r2.tables.find(t => t.table_name === 'orders');
      if (!ordersTable) {
        allPass = false;
        defects.push('Test 2: expected tables array to contain { table_name: "orders" }');
      } else {
        console.log('PASS: orders table found in tables array');
      }
    }

    // Check type is postgres
    if (r2.type !== 'postgres') {
      allPass = false;
      defects.push(`Test 2: expected result.type 'postgres', got '${r2.type}'`);
    } else {
      console.log('PASS: type is postgres');
    }

    // Check database
    if (typeof r2.database !== 'string' || !r2.database) {
      allPass = false;
      defects.push(`Test 2: expected non-empty result.database, got '${r2.database}'`);
    } else {
      console.log(`PASS: database is '${r2.database}'`);
    }

    // Response should only have tables, type, database keys
    const r2Keys = Object.keys(r2).sort();
    const expectedKeys = ['database', 'tables', 'type'].sort();
    if (JSON.stringify(r2Keys) !== JSON.stringify(expectedKeys)) {
      allPass = false;
      defects.push(`Test 2: result keys: expected [${expectedKeys}], got [${r2Keys}]`);
    } else {
      console.log('PASS: result has exactly tables, type, database keys');
    }
  }

  console.log('');

  // --- Test 3: Valid resourceId 'order-mongo' ---
  console.log('--- Test 3: describe_resource with valid resourceId "order-mongo" ---');
  const req3Id = 'ac018-valid-mongo';
  const resp3 = await sendAndWait(ws, {
    jsonrpc: '2.0',
    id: req3Id,
    method: 'describe_resource',
    params: { resourceId: 'order-mongo' },
  });
  console.log(`Response: ${JSON.stringify(resp3, null, 2)}`);

  if (resp3.jsonrpc !== '2.0') {
    allPass = false;
    defects.push(`Test 3: expected jsonrpc '2.0', got '${resp3.jsonrpc}'`);
  } else {
    console.log('PASS: jsonrpc is 2.0');
  }

  if (String(resp3.id) !== req3Id) {
    allPass = false;
    defects.push(`Test 3: expected id '${req3Id}', got '${resp3.id}'`);
  } else {
    console.log('PASS: id echoed');
  }

  if (resp3.error) {
    allPass = false;
    defects.push(`Test 3: unexpected error key: ${JSON.stringify(resp3.error)}`);
  } else {
    console.log('PASS: no error key');
  }

  const r3 = resp3.result;
  if (!r3) {
    allPass = false;
    defects.push('Test 3: expected result key, none present');
  } else {
    console.log('PASS: result key present');

    // Check tables is an array
    if (!Array.isArray(r3.tables)) {
      allPass = false;
      defects.push(`Test 3: expected result.tables to be array, got ${typeof r3.tables}`);
    } else {
      console.log(`PASS: tables is an array (length ${r3.tables.length})`);
    }

    // Check type is mongodb
    if (r3.type !== 'mongodb') {
      allPass = false;
      defects.push(`Test 3: expected result.type 'mongodb', got '${r3.type}'`);
    } else {
      console.log('PASS: type is mongodb');
    }

    // Check database
    if (typeof r3.database !== 'string' || !r3.database) {
      allPass = false;
      defects.push(`Test 3: expected non-empty result.database, got '${r3.database}'`);
    } else {
      console.log(`PASS: database is '${r3.database}'`);
    }

    // Response should only have tables, type, database keys
    const r3Keys = Object.keys(r3).sort();
    const expectedKeys = ['database', 'tables', 'type'].sort();
    if (JSON.stringify(r3Keys) !== JSON.stringify(expectedKeys)) {
      allPass = false;
      defects.push(`Test 3: result keys: expected [${expectedKeys}], got [${r3Keys}]`);
    } else {
      console.log('PASS: result has exactly tables, type, database keys');
    }
  }

  ws.close();

  console.log('\n=== Overall Summary ===');
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
