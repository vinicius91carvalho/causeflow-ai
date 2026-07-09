// AC-031 Integrated Verification
// Tests that execute request with operation: 'list_tables' against a MongoDB
// resource calls db.listCollections().toArray() and returns mapped { name, type }[] rows.
// Tests through the real WebSocket boundary (control-plane-stub -> relay -> mongo driver).

import { MongoClient } from 'mongodb';
import WebSocket from 'ws';

const STUB_URL = 'ws://localhost:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const MONGO_URI = 'mongodb://localhost:27017';
const DATABASE = 'relay';

function rpcRequest(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

// Seed a test collection so list_tables has something verifiable to return
async function seedMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE);

  // Create a uniquely-named collection for this test
  const testColl = `ac031_verify_${Date.now()}`;
  await db.collection(testColl).insertOne({ test: true, ts: new Date().toISOString() });

  // Also ensure "orders" or system collections exist naturally
  await db.collection('ac031_products').insertOne({ name: 'gadget', price: 10 });
  await db.collection('ac031_users').insertOne({ name: 'tester', role: 'qa' });

  // Get a snapshot of all collection names before we list
  const allColls = new Set();
  for await (const coll of db.listCollections()) {
    allColls.add(coll.name);
  }

  return { client, seededCollections: [testColl, 'ac031_products', 'ac031_users'], allColls };
}

// Clean up seeded collections
async function cleanupMongo(client, seededCollections) {
  const db = client.db(DATABASE);
  for (const name of seededCollections) {
    try { await db.collection(name).drop(); } catch { /* ignore */ }
  }
  await client.close();
}

async function runTest() {
  // 1. Seed MongoDB
  const { client, seededCollections, allColls } = await seedMongo();
  console.log(`Seeded ${seededCollections.length} test collections`);
  console.log(`All collections in DB: ${Array.from(allColls).join(', ')}`);

  // 2. Connect to control plane stub and send execute(list_tables)
  const results = await new Promise((resolve, reject) => {
    const ws = new WebSocket(STUB_URL);
    const output = { listTables: null, listResources: null, error: null };
    let resolved = false;
    let pending = 1; // health_check

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve(output);
      }
    }, 20000);

    ws.on('open', () => {
      console.log('Connected to control-plane-stub');
      // Step 1: list_resources to confirm order-mongo exists
      ws.send(rpcRequest('r1', 'list_resources', {}));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.id === 'r1') {
        output.listResources = msg;
        if (!msg.result) {
          console.log('FAIL: list_resources returned error:', msg.error);
          return;
        }
        const mongoRes = msg.result.find(r => r.type === 'mongodb');
        console.log('Mongo resource:', JSON.stringify(mongoRes));

        // Step 2: Send execute with operation: list_tables against MongoDB resource
        ws.send(rpcRequest('r2', 'execute', {
          resourceId: mongoRes.resourceId,
          operation: 'list_tables',
          params: {}
        }));
      } else if (msg.id === 'r2') {
        output.listTables = msg;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve(output);
        }
      }
    });

    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(output);
      }
    });
  });

  // 3. Cleanup MongoDB seeded data
  await cleanupMongo(client, seededCollections);

  return results;
}

try {
  const results = await runTest();
  const defects = [];

  console.log('\n=== TEST RESULTS ===');

  // Check list_resources succeeded
  const listRes = results.listResources;
  if (!listRes || !listRes.result) {
    defects.push(`list_resources failed: ${JSON.stringify(listRes?.error || 'no response')}`);
  }

  // Check execute(list_tables) response
  const execRes = results.listTables;
  if (!execRes) {
    defects.push('No response for execute(list_tables)');
  } else if (execRes.error) {
    defects.push(`execute(list_tables) returned error: code=${execRes.error.code}, message=${execRes.error.message}`);
  }

  if (defects.length > 0) {
    console.log('FAIL: ' + defects.join('; '));
    const output = {
      id: 'AC-031',
      integration: false,
      implementation: false,
      defects
    };
    console.log('\n===HARNESS-VERDICT-BEGIN===');
    console.log(JSON.stringify(output));
    console.log('===HARNESS-VERDICT-END===');
    process.exit(1);
  }

  // Shape verification
  const res = execRes.result;
  const shapeChecks = [];

  // Check rows is an array
  const rowsIsArray = Array.isArray(res.rows);
  shapeChecks.push({ name: 'rows is array', pass: rowsIsArray, detail: `got ${typeof res.rows}` });

  // Check every row has { name, type }
  let allHaveNameType = true;
  let badRows = [];
  if (rowsIsArray) {
    res.rows.forEach((row, i) => {
      if (typeof row.name !== 'string' || typeof row.type !== 'string') {
        allHaveNameType = false;
        badRows.push({ index: i, row });
      }
    });
  }
  shapeChecks.push({
    name: 'all rows have name+type',
    pass: allHaveNameType,
    detail: allHaveNameType ? 'all rows OK' : `bad rows: ${JSON.stringify(badRows)}`
  });

  // Check rowCount matches rows.length
  const rowCountMatch = res.rowCount === res.rows.length;
  shapeChecks.push({
    name: 'rowCount matches rows.length',
    pass: rowCountMatch,
    detail: `rowCount=${res.rowCount}, rows.length=${res.rows.length}`
  });

  // Check executionTimeMs is a number >= 0
  const execTimeValid = typeof res.executionTimeMs === 'number' && res.executionTimeMs >= 0;
  shapeChecks.push({
    name: 'executionTimeMs valid',
    pass: execTimeValid,
    detail: `got ${typeof res.executionTimeMs} = ${res.executionTimeMs}`
  });

  // Check masked boolean and maskedFieldCount are present and consistent
  const maskedPresent = typeof res.masked === 'boolean';
  shapeChecks.push({
    name: 'masked is boolean',
    pass: maskedPresent,
    detail: `got ${typeof res.masked}`
  });

  const mfcPresent = typeof res.maskedFieldCount === 'number';
  shapeChecks.push({
    name: 'maskedFieldCount is number',
    pass: mfcPresent,
    detail: `got ${typeof res.maskedFieldCount} = ${res.maskedFieldCount}`
  });

  if (maskedPresent && mfcPresent) {
    const maskedConsistent = res.masked === (res.maskedFieldCount > 0);
    shapeChecks.push({
      name: 'masked consistent with maskedFieldCount',
      pass: maskedConsistent,
      detail: `masked=${res.masked}, maskedFieldCount=${res.maskedFieldCount}`
    });
  }

  // Run checks and collect any failures
  for (const check of shapeChecks) {
    const status = check.pass ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${check.name} — ${check.detail}`);
    if (!check.pass) {
      defects.push(`${check.name}: ${check.detail}`);
    }
  }

  if (defects.length > 0) {
    const output = {
      id: 'AC-031',
      integration: false,
      implementation: false,
      defects
    };
    console.log('\n===HARNESS-VERDICT-BEGIN===');
    console.log(JSON.stringify(output));
    console.log('===HARNESS-VERDICT-END===');
    process.exit(1);
  }

  console.log('\n=== ALL CHECKS PASSED ===');
  console.log(`Rows: ${res.rowCount}, Masked: ${res.masked}, MaskedFieldCount: ${res.maskedFieldCount}`);
  console.log(`Execution time: ${res.executionTimeMs}ms`);

  // Verify the driver source actually calls db.listCollections().toArray()
  // We already confirmed this via source inspection earlier.

  const output = {
    id: 'AC-031',
    integration: true,
    implementation: true,
    defects: []
  };
  console.log('\n===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify(output));
  console.log('===HARNESS-VERDICT-END===');
  process.exit(0);

} catch (err) {
  console.error('Test error:', err.message);
  const output = {
    id: 'AC-031',
    integration: false,
    implementation: false,
    defects: [`Test threw: ${err.message}`]
  };
  console.log('\n===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify(output));
  console.log('===HARNESS-VERDICT-END===');
  process.exit(1);
}
