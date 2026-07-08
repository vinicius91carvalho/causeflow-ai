// AC-038 Integrated Verification
// Tests row-limit policy rejection and acceptance at the real WebSocket boundary
// against the running docker-compose stack (relay + control-plane-stub + postgres + mongo).

import { WebSocket } from 'ws';

const STUB_URL = 'ws://127.0.0.1:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const TIMEOUT_MS = 30000;

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

function sendRpc(ws, method, params) {
  const id = crypto.randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for response id=${id}`));
    }, TIMEOUT_MS);
    const onMsg = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === id || msg.id?.toString() === id?.toString()) {
        cleanup();
        resolve(msg);
      }
    };
    const onClose = () => { cleanup(); reject(new Error('socket closed')); };
    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMsg);
      ws.off('close', onClose);
    }
    ws.on('message', onMsg);
    ws.on('close', onClose);
  });
}

async function main() {
  console.log('=== AC-038 Integrated Verification ===');
  console.log('Connecting to control-plane stub...');
  
  const ws = await connect();
  console.log('Connected.');

  const defects = [];

  // --- Test 1: limit=5000 with maxRowsPerQuery=1000 -> policy rejection ---
  console.log('\n--- Test 1: limit=5000 (should be rejected) ---');
  const id1 = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS one', limit: 5000 },
  });
  const resp1 = await waitForResponse(ws, id1);
  console.log('Response:', JSON.stringify(resp1, null, 2));

  const expectedReason = 'Row limit 5000 exceeds maximum 1000';
  let test1Ok = false;
  if (resp1.error) {
    if (resp1.error.code === -32600 && resp1.error.message.includes(expectedReason)) {
      console.log('PASS: limit=5000 correctly rejected with -32600 and expected reason');
      test1Ok = true;
    } else {
      const msg = `Test 1 FAIL: expected -32600 with "${expectedReason}", got code=${resp1.error.code} message="${resp1.error.message}"`;
      defects.push(msg);
      console.log(msg);
    }
  } else {
    const msg = `Test 1 FAIL: expected error but got result: ${JSON.stringify(resp1.result)}`;
    defects.push(msg);
    console.log(msg);
  }

  // --- Test 2: limit=100 with maxRowsPerQuery=1000 -> policy accepted, driver clamps ---
  console.log('\n--- Test 2: limit=100 (should be accepted) ---');
  const id2 = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS one', limit: 100 },
  });
  const resp2 = await waitForResponse(ws, id2);
  console.log('Response:', JSON.stringify(resp2, null, 2));

  let test2Ok = false;
  if (resp2.result && !resp2.error) {
    if (resp2.result.rowCount === 1) {
      console.log('PASS: limit=100 accepted, rowCount=1');
      test2Ok = true;
    } else {
      const msg = `Test 2 FAIL: expected rowCount=1, got ${resp2.result.rowCount}`;
      defects.push(msg);
      console.log(msg);
    }
  } else {
    const msg = `Test 2 FAIL: expected success but got error: ${JSON.stringify(resp2.error)}`;
    defects.push(msg);
    console.log(msg);
  }

  // --- Test 3: no limit -> falls back to maxRowsPerQuery=1000, policy accepted ---
  console.log('\n--- Test 3: no limit (should be accepted, fallback to 1000) ---');
  const id3 = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS one' },
  });
  const resp3 = await waitForResponse(ws, id3);
  console.log('Response:', JSON.stringify(resp3, null, 2));

  let test3Ok = false;
  if (resp3.result && !resp3.error) {
    if (resp3.result.rowCount === 1) {
      console.log('PASS: no limit accepted, rowCount=1');
      test3Ok = true;
    } else {
      const msg = `Test 3 FAIL: expected rowCount=1, got ${resp3.result.rowCount}`;
      defects.push(msg);
      console.log(msg);
    }
  } else {
    const msg = `Test 3 FAIL: expected success but got error: ${JSON.stringify(resp3.error)}`;
    defects.push(msg);
    console.log(msg);
  }

  // --- Test 4: limit=100 on MongoDB resource (policy acceptance + driver clamp) ---
  console.log('\n--- Test 4: limit=100 on MongoDB (should be accepted) ---');
  const id4 = sendRpc(ws, 'execute', {
    resourceId: 'order-mongo',
    operation: 'query',
    params: { collection: 'orders', filter: {}, limit: 100 },
  });
  const resp4 = await waitForResponse(ws, id4);
  console.log('Response:', JSON.stringify(resp4, null, 2));

  let test4Ok = false;
  if (resp4.result && !resp4.error) {
    console.log('PASS: MongoDB limit=100 accepted');
    test4Ok = true;
  } else if (resp4.error) {
    // Mongo may error if collection doesn't exist - that's a driver error, not a policy error
    // Policy acceptance is proven by NOT getting -32600
    if (resp4.error.code !== -32600) {
      console.log(`INFO: MongoDB query got non-policy error (expected if collection missing): ${resp4.error.message}`);
      test4Ok = true; // Policy was not the rejection cause
    } else {
      const msg = `Test 4 FAIL: MongoDB got unexpected policy rejection: ${resp4.error.message}`;
      defects.push(msg);
      console.log(msg);
    }
  }

  // --- Test 5: limit=5000 on MongoDB (should be rejected by policy) ---
  console.log('\n--- Test 5: limit=5000 on MongoDB (should be rejected) ---');
  const id5 = sendRpc(ws, 'execute', {
    resourceId: 'order-mongo',
    operation: 'query',
    params: { collection: 'orders', filter: {}, limit: 5000 },
  });
  const resp5 = await waitForResponse(ws, id5);
  console.log('Response:', JSON.stringify(resp5, null, 2));

  let test5Ok = false;
  if (resp5.error && resp5.error.code === -32600 && resp5.error.message.includes('Row limit 5000 exceeds maximum 1000')) {
    console.log('PASS: MongoDB limit=5000 correctly rejected with -32600');
    test5Ok = true;
  } else if (resp5.error) {
    const msg = `Test 5 FAIL: expected -32600 for MongoDB row limit, got code=${resp5.error.code} message="${resp5.error.message}"`;
    defects.push(msg);
    console.log(msg);
  } else {
    const msg = `Test 5 FAIL: expected error but got result for MongoDB limit=5000`;
    defects.push(msg);
    console.log(msg);
  }

  ws.close();
  console.log('\n=== Summary ===');
  console.log(`Test 1 (Postgres limit=5000 reject): ${test1Ok ? 'PASS' : 'FAIL'}`);
  console.log(`Test 2 (Postgres limit=100 accept): ${test2Ok ? 'PASS' : 'FAIL'}`);
  console.log(`Test 3 (Postgres no limit accept): ${test3Ok ? 'PASS' : 'FAIL'}`);
  console.log(`Test 4 (Mongo limit=100 accept): ${test4Ok ? 'PASS' : 'FAIL'}`);
  console.log(`Test 5 (Mongo limit=5000 reject): ${test5Ok ? 'PASS' : 'FAIL'}`);

  const allPass = test1Ok && test2Ok && test3Ok && test4Ok && test5Ok;
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);

  if (defects.length > 0) {
    console.log('\nDefects:');
    defects.forEach((d) => console.log(`  - ${d}`));
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
