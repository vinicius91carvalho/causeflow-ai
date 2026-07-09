// AC-032: MongoDB describe_table schema inference
// Verifies that with a MongoDB resource configured, an execute request with
// operation: 'describe_table' and params.params.tableName = 'orders' infers
// a schema from up to 10 sample documents via collection.find().limit(10).toArray(),
// walks the documents to record the set of typeof value per field, and merges
// those rows with the indexes() output (each tagged _type: 'index', { name, key }).
//
// Run: docker compose up -d (ensure relay + control-plane-stub + relay-mongo are up)
// Then: node .harness/test-ac032.mjs

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const DATABASE = process.env.MONGO_DATABASE ?? 'relay';
const COLLECTION = 'orders';
const STUB_WS_URL = process.env.STUB_WS_URL ?? 'ws://localhost:5191/v1/relay/connect';
const RELAY_TOKEN = process.env.RELAY_TOKEN ?? 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID ?? 'harness-tenant';

let mismatches = [];
function assert(label, ok, detail) {
  if (!ok) mismatches.push({ label, detail: detail ?? 'assertion failed' });
}

async function seedMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE);
  const col = db.collection(COLLECTION);

  // Drop and reseed
  await col.drop().catch(() => {});
  await db.dropDatabase().catch(() => {});

  await col.insertMany([
    {
      _id: 'ord-001',
      status: 'shipped',
      amount: 149.99,
      customer: { name: 'Alice', email: 'alice@example.com' },
      tags: ['premium', 'international'],
      notes: null,
      createdAt: new Date('2026-06-01T10:00:00Z'),
    },
    {
      _id: 'ord-002',
      status: 'pending',
      amount: 59.99,
      customer: { name: 'Bob' },
      tags: ['standard'],
      notes: 'handle with care',
      createdAt: new Date('2026-06-15T14:30:00Z'),
    },
  ]);

  // Create indexes
  await col.createIndex({ status: 1 }, { name: 'idx_status' });
  await col.createIndex({ amount: -1 }, { name: 'idx_amount' });
  await col.createIndex({ customer: 1, createdAt: -1 }, { name: 'customer_1_createdAt_-1' });

  const count = await col.countDocuments();
  console.log(`[seed] inserted ${count} docs into ${COLLECTION}`);
  const indexes = await col.indexes();
  console.log(`[seed] created ${indexes.length} indexes (including _id_)`);

  await client.close();
  return count;
}

async function sendRpc(ws, request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RPC timeout')), 15000);
    const msg = JSON.stringify({ jsonrpc: '2.0', id: request.id, method: request.method, params: request.params });
    const handler = (raw) => {
      try {
        const resp = JSON.parse(raw.toString());
        if (resp.id === request.id) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(resp);
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function runTest() {
  console.log('=== AC-032: MongoDB describe_table schema inference ===\n');

  // Step 1: Seed MongoDB
  console.log('[1] Seeding MongoDB orders collection...');
  const docCount = await seedMongo();
  console.log(`[1] Done. Collection seeded with ${docCount} documents.\n`);

  // Step 2: Connect to control-plane stub
  console.log('[2] Connecting to control-plane stub...');
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(`${STUB_WS_URL}?token=${RELAY_TOKEN}&tenantId=${TENANT_ID}`);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS connect timeout')), 10000);
    ws.on('open', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
  console.log('[2] Connected to control-plane stub.\n');

  // Step 3: Send describe_table request
  console.log('[3] Sending describe_table request for orders collection...');
  const response = await sendRpc(ws, {
    id: 1,
    method: 'execute',
    params: {
      resourceId: 'order-mongo',
      operation: 'describe_table',
      params: { tableName: COLLECTION },
    },
  });
  console.log('[3] Response received.\n');

  // Step 4: Validate response structure
  console.log('[4] Validating response...\n');

  // 4a: JSON-RPC 2.0 shape
  assert('jsonrpc-2.0', response.jsonrpc === '2.0', `Expected jsonrpc: '2.0', got ${response.jsonrpc}`);
  assert('no-error', !response.error, `Unexpected error: ${JSON.stringify(response.error)}`);
  assert('has-result', !!response.result, 'Missing result field');

  const result = response.result;

  // 4b: rows array
  assert('rows-is-array', Array.isArray(result.rows), `rows is not array: ${typeof result.rows}`);
  assert('rowCount-matches', result.rowCount === result.rows.length,
    `rowCount ${result.rowCount} !== rows.length ${result.rows.length}`);

  // 4c: Schema rows present - these are rows WITHOUT _type === 'index'
  const schemaRows = result.rows.filter(r => r._type !== 'index');
  const indexRows = result.rows.filter(r => r._type === 'index');

  console.log(`  Schema rows: ${schemaRows.length}`);
  console.log(`  Index rows: ${indexRows.length}`);

  assert('has-schema-rows', schemaRows.length >= 6,
    `Expected at least 6 schema rows, got ${schemaRows.length}`);

  // 4d: Schema rows have field + types
  // Each schema row should have a 'field' property and a 'types' property
  for (const row of schemaRows) {
    assert(`schema-row-has-field-${row.field}`, typeof row.field === 'string' && row.field.length > 0,
      `Schema row missing field: ${JSON.stringify(row)}`);
    assert(`schema-row-has-types-${row.field}`, Array.isArray(row.types) && row.types.length > 0,
      `Schema row missing types array: ${JSON.stringify(row)}`);
  }

  // 4e: All expected fields present (based on the two seeded documents)
  const fieldNames = schemaRows.map(r => r.field);
  const expectedFields = ['_id', 'status', 'amount', 'customer', 'tags', 'notes', 'createdAt'];
  for (const f of expectedFields) {
    assert(`field-${f}-present`, fieldNames.includes(f),
      `Expected field '${f}' not found in schema rows. Fields: ${fieldNames.join(', ')}`);
  }

  // 4f: Type inference correctness
  const fieldMap = {};
  for (const row of schemaRows) {
    fieldMap[row.field] = row.types;
  }

  // _id should be 'string' (from 'ord-001' / 'ord-002')
  assert('type-_id-string', fieldMap['_id']?.includes('string'),
    `_id types ${JSON.stringify(fieldMap['_id'])} does not include 'string'`);

  // status should be 'string'
  assert('type-status-string', fieldMap['status']?.includes('string'),
    `status types ${JSON.stringify(fieldMap['status'])} does not include 'string'`);

  // amount should be 'number'
  assert('type-amount-number', fieldMap['amount']?.includes('number'),
    `amount types ${JSON.stringify(fieldMap['amount'])} does not include 'number'`);

  // customer should be 'object'
  assert('type-customer-object', fieldMap['customer']?.includes('object'),
    `customer types ${JSON.stringify(fieldMap['customer'])} does not include 'object'`);

  // tags is an array -> typeof [] is 'object' (or could be 'array')
  // Some implementations might use a custom check for arrays
  assert('type-tags-present', !!fieldMap['tags'],
    `tags field missing from schema`);

  // notes can be null (typeof null is 'object') and 'string' in second doc
  assert('type-notes-object-or-string', 
    (fieldMap['notes']?.includes('object') || fieldMap['notes']?.includes('string')),
    `notes types ${JSON.stringify(fieldMap['notes'])} does not include 'object' or 'string'`);

  // createdAt should be 'object' (Date is typeof 'object')
  assert('type-createdAt-object', fieldMap['createdAt']?.includes('object'),
    `createdAt types ${JSON.stringify(fieldMap['createdAt'])} does not include 'object'`);

  // 4g: Index rows tagged with _type: 'index'
  assert('index-rows-tagged', indexRows.length >= 3,
    `Expected at least 3 index rows, got ${indexRows.length}`);

  for (const idx of indexRows) {
    assert(`index-row-${idx.name}-has-_type`, idx._type === 'index',
      `Index row missing _type='index': ${JSON.stringify(idx)}`);
    assert(`index-row-${idx.name}-has-name`, typeof idx.name === 'string' && idx.name.length > 0,
      `Index row missing name: ${JSON.stringify(idx)}`);
    assert(`index-row-${idx.name}-has-key`, !!idx.key,
      `Index row missing key: ${JSON.stringify(idx)}`);
  }

  // 4h: Named indexes found
  const indexNames = indexRows.map(r => r.name);
  assert('idx-_id_-present', indexNames.includes('_id_'),
    `_id_ index not found. Indexes: ${indexNames.join(', ')}`);
  assert('idx-status-present', indexNames.includes('idx_status'),
    `idx_status not found. Indexes: ${indexNames.join(', ')}`);
  assert('idx-amount-present', indexNames.includes('idx_amount'),
    `idx_amount not found. Indexes: ${indexNames.join(', ')}`);

  // 4i: Compound index found
  const compoundIndex = indexRows.find(r => r.name === 'customer_1_createdAt_-1');
  assert('compound-index-exists', !!compoundIndex,
    `customer_1_createdAt_-1 compound index not found. Indexes: ${indexNames.join(', ')}`);

  // 4j: Response metadata
  assert('executionTimeMs-present', typeof result.executionTimeMs === 'number',
    `executionTimeMs missing or not a number: ${typeof result.executionTimeMs}`);
  assert('masked-present', typeof result.masked === 'boolean',
    `masked missing or not boolean: ${typeof result.masked}`);
  assert('maskedFieldCount-present', typeof result.maskedFieldCount === 'number',
    `maskedFieldCount missing or not number: ${typeof result.maskedFieldCount}`);
  assert('masked-consistent', result.masked === (result.maskedFieldCount > 0),
    `masked ${result.masked} inconsistent with maskedFieldCount ${result.maskedFieldCount}`);

  // Step 5: Summary
  console.log(`\n[5] Results:`);
  console.log(`  Schema rows: ${schemaRows.length}`);
  for (const row of schemaRows) {
    console.log(`    ${row.field}: ${JSON.stringify(row.types)}`);
  }
  console.log(`  Index rows: ${indexRows.length}`);
  for (const row of indexRows) {
    console.log(`    ${row.name}: key=${JSON.stringify(row.key)}`);
  }
  console.log(`  rowCount: ${result.rowCount}`);
  console.log(`  executionTimeMs: ${result.executionTimeMs}`);
  console.log(`  masked: ${result.masked}`);
  console.log(`  maskedFieldCount: ${result.maskedFieldCount}`);

  if (mismatches.length > 0) {
    console.log(`\n=== FAILED: ${mismatches.length} assertion(s) failed ===`);
    for (const m of mismatches) {
      console.log(`  ✗ ${m.label}: ${m.detail}`);
    }
    process.exit(1);
  } else {
    console.log(`\n=== PASSED: All assertions passed ===`);
  }

  ws.close();
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
