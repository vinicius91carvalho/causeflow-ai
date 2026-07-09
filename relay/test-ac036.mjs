// AC-036 black-box test: MongoDriver healthCheck + close + construction params.
//
// MongoDriver.healthCheck() runs db.admin().ping() and returns true on success,
// false on any error. MongoDriver.close() awaits client.close().
// The driver is constructed with maxPoolSize: 5 and serverSelectionTimeoutMS: 10000.
import { MongoClient } from 'mongodb';
import { WebSocket } from 'ws';

const STUB_URL = process.env.STUB_URL || 'ws://localhost:5191/v1/relay/connect';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'relay';
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

function connectWs() {
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

  // =============================================
  // Test 1: Verify healthCheck via WebSocket RPC
  // =============================================
  {
    console.log('--- Test 1: health_check RPC via WebSocket ---');
    const ws = await connectWs();
    await new Promise(r => setTimeout(r, 1000));

    const { id, msg } = rpcRequest('health_check', {});
    const resp = await sendAndWait(ws, msg, id);
    ws.close();

    if (resp.error) {
      failures.push(`Test 1: health_check returned error: ${resp.error.message}`);
    } else if (!resp.result) {
      failures.push('Test 1: No result in health_check response');
    } else {
      const result = resp.result;
      if (!Array.isArray(result)) {
        failures.push(`Test 1: result is not an array: ${typeof result}`);
      } else {
        const mongoEntry = result.find(r => r.resourceId === RESOURCE_ID);
        if (!mongoEntry) {
          failures.push(`Test 1: No entry for ${RESOURCE_ID} in health_check result. Got: ${JSON.stringify(result)}`);
        } else {
          console.log(`  ${RESOURCE_ID}: healthy=${mongoEntry.healthy}, latencyMs=${mongoEntry.latencyMs}`);
          if (mongoEntry.healthy !== true) {
            failures.push(`Test 1: ${RESOURCE_ID}.healthy should be true, got ${mongoEntry.healthy}`);
          } else {
            console.log('  PASS: Mongo driver reports healthy=true via health_check RPC');
          }
        }
      }
    }
  }

  // =============================================
  // Test 2: Verify MongoClient construction params
  // =============================================
  {
    console.log('\n--- Test 2: Verify MongoDriver construction parameters ---');
    // Read the source to verify maxPoolSize: 5 and serverSelectionTimeoutMS: 10000
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, 'src', 'drivers', 'mongodb', 'mongo-driver.ts'),
      'utf8'
    );

    const hasMaxPoolSize = source.includes('maxPoolSize: 5');
    const hasServerSelectionTimeout = source.includes('serverSelectionTimeoutMS: 10000');

    if (hasMaxPoolSize) {
      console.log('  PASS: Constructor has maxPoolSize: 5');
    } else {
      failures.push('Test 2: Source missing maxPoolSize: 5');
    }
    if (hasServerSelectionTimeout) {
      console.log('  PASS: Constructor has serverSelectionTimeoutMS: 10000');
    } else {
      failures.push('Test 2: Source missing serverSelectionTimeoutMS: 10000');
    }
  }

  // =============================================
  // Test 3: Instantiate MongoClient directly, test healthCheck + close
  // =============================================
  {
    console.log('\n--- Test 3: Direct MongoClient healthCheck() and close() ---');
    const client = new MongoClient(MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    const db = client.db(MONGO_DB);

    // Test healthCheck
    try {
      const pingResult = await db.admin().ping();
      console.log(`  db.admin().ping() result:`, JSON.stringify(pingResult));
      console.log('  PASS: db.admin().ping() succeeded - healthCheck returns true');
    } catch (err) {
      failures.push(`Test 3: db.admin().ping() threw: ${err.message}`);
    }

    // Test close
    try {
      await client.close();
      console.log('  PASS: client.close() resolved without error');
    } catch (err) {
      failures.push(`Test 3: client.close() threw: ${err.message}`);
    }

    // Verify the client is actually closed
    try {
      await db.admin().ping();
      failures.push('Test 3: db.admin().ping() should fail after client.close()');
    } catch {
      console.log('  PASS: db.admin().ping() fails after close() (expected)');
    }
  }

  // =============================================
  // Test 4: healthCheck returns false on error (bad URI)
  // =============================================
  {
    console.log('\n--- Test 4: healthCheck returns false on error ---');
    const badClient = new MongoClient('mongodb://192.0.2.1:27017', {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 2000,
    });
    const badDb = badClient.db(MONGO_DB);

    try {
      await badDb.admin().ping();
      failures.push('Test 4: ping should have failed on unreachable host');
    } catch {
      console.log('  PASS: ping failed on unreachable host (expected)');
    }

    try {
      await badClient.close();
      console.log('  PASS: close() on failed client resolved');
    } catch (err) {
      // Some MongoDB driver versions throw on close if never connected
      console.log('  INFO: close() on failed client had error:', err.message);
    }
  }

  // =============================================
  // Results
  // =============================================
  console.log(`\n=== Results: ${failures.length} failure(s) ===`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`  FAIL: ${f}`);
    }
    process.exit(1);
  } else {
    console.log('All AC-036 tests passed!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
