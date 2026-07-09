// AC-034 black-box test: MongoDB aggregation pipeline validation.
//
// With a MongoDB resource configured, an `execute` request with
// `operation: 'query'` and `params.params.pipeline = [{ $match: { status: 'failed' } }, { $out: 'archive' }]`
// is rejected by `validate` with `reason: 'Aggregation stage $out is not allowed'`.
// The same applies to `$merge`. A pipeline of only `$match` / `$group` / `$sort` / `$project` / `$limit`
// stages is accepted.
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

  // --- Test 1: Pipeline with $out should be rejected ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'query',
      params: {
        collection: 'orders',
        pipeline: [{ $match: { status: 'failed' } }, { $out: 'archive' }],
      },
    });
    console.log('\n--- Test 1: Pipeline with $out (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.result) {
      console.log('FAIL: Expected error but got result');
      failures.push('Test 1: $out was accepted (expected rejection)');
    } else if (resp.error) {
      const reason = resp.error.message || '';
      if (reason.includes('$out')) {
        console.log('PASS: $out correctly rejected');
      } else if (resp.error.data && resp.error.data.reason) {
        const r = resp.error.data.reason;
        if (r.includes('$out')) {
          console.log('PASS: $out correctly rejected');
        } else {
          failures.push(`Test 1: Unexpected reason: ${r}`);
        }
      } else {
        failures.push(`Test 1: Error message doesn't mention $out: ${reason}`);
      }
    } else {
      failures.push('Test 1: Unexpected response shape');
    }
  }

  // --- Test 2: Pipeline with $merge should be rejected ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'query',
      params: {
        collection: 'orders',
        pipeline: [{ $match: { status: 'active' } }, { $merge: { into: 'archive' } }],
      },
    });
    console.log('\n--- Test 2: Pipeline with $merge (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.result) {
      console.log('FAIL: Expected error but got result');
      failures.push('Test 2: $merge was accepted (expected rejection)');
    } else if (resp.error) {
      const reason = resp.error.message || '';
      if (reason.includes('$merge')) {
        console.log('PASS: $merge correctly rejected');
      } else if (resp.error.data && resp.error.data.reason) {
        const r = resp.error.data.reason;
        if (r.includes('$merge')) {
          console.log('PASS: $merge correctly rejected');
        } else {
          failures.push(`Test 2: Unexpected reason: ${r}`);
        }
      } else {
        failures.push(`Test 2: Error message doesn't mention $merge: ${reason}`);
      }
    } else {
      failures.push('Test 2: Unexpected response shape');
    }
  }

  // --- Test 3: Pipeline with only $match/$group should be accepted ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'query',
      params: {
        collection: 'orders',
        pipeline: [
          { $match: { status: 'active' } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
      },
    });
    console.log('\n--- Test 3: Pipeline with $match/$group (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.result) {
      console.log('PASS: $match/$group pipeline accepted');
    } else if (resp.error) {
      failures.push(`Test 3: Allowed pipeline rejected: ${resp.error.message || JSON.stringify(resp.error)}`);
    } else {
      failures.push('Test 3: Unexpected response shape');
    }
  }

  // --- Test 4: Pipeline with $match/$sort/$project/$limit should be accepted ---
  {
    const { id, msg } = rpcRequest('execute', {
      resourceId: RESOURCE_ID,
      operation: 'query',
      params: {
        collection: 'orders',
        pipeline: [
          { $match: { status: 'active' } },
          { $sort: { createdAt: -1 } },
          { $project: { status: 1, amount: 1 } },
          { $limit: 10 },
        ],
      },
    });
    console.log('\n--- Test 4: Pipeline with $match/$sort/$project/$limit (id=' + id + ') ---');
    const resp = await sendAndWait(ws, msg, id);
    console.log('Response:', JSON.stringify(resp, null, 2));

    if (resp.result) {
      console.log('PASS: $match/$sort/$project/$limit pipeline accepted');
    } else if (resp.error) {
      failures.push(`Test 4: Allowed pipeline rejected: ${resp.error.message || JSON.stringify(resp.error)}`);
    } else {
      failures.push('Test 4: Unexpected response shape');
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
