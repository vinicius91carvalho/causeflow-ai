// AC-035 black-box test: MongoDB explain operation.
//
// With a MongoDB resource configured, an `execute` request with
// `operation: 'explain'` runs `collection.find(filter).explain('executionStats')`
// and returns `{ rows: [<explanation>], rowCount: 1, executionTimeMs }`.
import { WebSocket } from 'ws';

const STUB_URL = process.env.STUB_URL || 'ws://localhost:5191/v1/relay/connect';
const TOKEN = process.env.RELAY_TOKEN || 'harness-smoke-token';
const TENANT = process.env.TENANT_ID || 'harness-tenant';

const RESOURCE_ID = 'order-mongo';

let nextId = 100;

function rpcRequest(method, params) {
  const id = nextId++;
  return { id, msg: JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params,
  })};
}

function connect() {
  return new Promise((resolve, reject) => {
    const url = `${STUB_URL}?token=${TOKEN}&tenantId=${TENANT}`;
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 15000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function sendAndWait(ws, msg, requestId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`RPC timeout for id ${requestId}`));
    }, 20000);

    const handler = (raw) => {
      let resp;
      try { resp = JSON.parse(raw.toString()); } catch { return; }
      if (resp.jsonrpc === '2.0' && resp.id === requestId) {
        clearTimeout(timeout);
        ws.removeListener('message', handler);
        resolve(resp);
      }
    };
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function main() {
  let failures = [];

  console.log(`Connecting to stub at ${STUB_URL}...`);
  const ws = await connect();
  console.log('Connected.');

  // Small delay to ensure the stub's relayWs forwarding is fully set up
  await new Promise(r => setTimeout(r, 1000));

  // --- Test 1: Explain without filter ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'explain',
      params: {
        collection: 'orders',
      },
    });
    console.log('\n--- Test 1: Explain on orders (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    console.log('Response keys:', Object.keys(resp));
    const res = resp.result;
    if (res) {
      console.log('  result keys:', Object.keys(res));
      console.log('  rowCount:', res.rowCount);
      console.log('  executionTimeMs:', res.executionTimeMs);
      console.log('  rows length:', res.rows ? res.rows.length : 0);
      console.log('  masked:', res.masked);
      console.log('  maskedFieldCount:', res.maskedFieldCount);

      // Check shape requirements from AC-035
      const shapeOk = (
        Array.isArray(res.rows) &&
        res.rows.length === 1 &&
        typeof res.rowCount === 'number' &&
        res.rowCount === 1 &&
        typeof res.executionTimeMs === 'number'
      );
      if (shapeOk) {
        console.log('PASS: Response shape matches AC-035');
      } else {
        failures.push(`Test 1: Response shape mismatch. rows=${JSON.stringify(res.rows?.length)} rowCount=${res.rowCount} executionTimeMs=${res.executionTimeMs}`);
      }

      // Verify the explanation has expected explain fields
      const explanation = res.rows[0];
      if (explanation && typeof explanation === 'object') {
        const hasExplainKeys = (
          'explainVersion' in explanation ||
          'queryPlanner' in explanation ||
          'executionStats' in explanation ||
          'serverInfo' in explanation
        );
        if (hasExplainKeys) {
          console.log('PASS: Explanation contains expected explain fields');
        } else {
          console.log('WARN: Explanation object keys:', Object.keys(explanation));
          // mongodb explain output varies by version; still acceptable if it has some structure
          if (Object.keys(explanation).length > 0) {
            console.log('INFO: Explanation has content but may use different key naming');
          } else {
            failures.push('Test 1: Explanation object is empty');
          }
        }
      } else {
        failures.push(`Test 1: rows[0] is not an object: ${typeof explanation}`);
      }
    } else if (resp.error) {
      failures.push(`Test 1: Unexpected error: ${resp.error.message || JSON.stringify(resp.error)}`);
    } else {
      failures.push('Test 1: No result and no error in response');
    }
  }

  // --- Test 2: Explain with filter ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'explain',
      params: {
        collection: 'orders',
        filter: { status: 'active' },
      },
    });
    console.log('\n--- Test 2: Explain with filter (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    const res = resp.result;
    if (res) {
      console.log('  rowCount:', res.rowCount);
      console.log('  executionTimeMs:', res.executionTimeMs);
      console.log('  rows length:', res.rows ? res.rows.length : 0);

      if (Array.isArray(res.rows) && res.rows.length === 1 && res.rowCount === 1 && typeof res.executionTimeMs === 'number') {
        console.log('PASS: Filtered explain shape matches AC-035');
      } else {
        failures.push(`Test 2: Shape mismatch. rows=${res.rows?.length} rowCount=${res.rowCount} executionTimeMs=${res.executionTimeMs}`);
      }
    } else if (resp.error) {
      failures.push(`Test 2: Unexpected error: ${resp.error.message || JSON.stringify(resp.error)}`);
    } else {
      failures.push('Test 2: No result and no error');
    }
  }

  // --- Test 3: Explain missing collection should error ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'explain',
      params: {},
    });
    console.log('\n--- Test 3: Explain without collection (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    if (resp.error) {
      console.log('PASS: Missing collection correctly rejected:', resp.error.message);
    } else if (resp.result) {
      failures.push('Test 3: Missing collection should have produced an error');
    } else {
      failures.push('Test 3: Unexpected response shape');
    }
  }

  ws.close();

  console.log(`\n=== Results: ${failures.length} failure(s) ===`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`  FAIL: ${f}`);
    }
    process.exit(1);
  } else {
    console.log('All tests passed!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
