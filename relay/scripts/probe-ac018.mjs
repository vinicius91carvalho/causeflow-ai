// AC-018 black-box probe: drive the real relay over a real WebSocket.
//
// Tests:
// 1. describe_resource with unknown resourceId → JSON-RPC error -32602
//    "Unknown resource: <id>"
// 2. describe_resource with valid resourceId → { tables, type, database }
//
// Uses the existing control-plane stub on port 3000 (relay already connected).
import { WebSocket } from 'ws';

const STUB_URL = 'ws://localhost:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';
const TIMEOUT_MS = 10_000;

const expectedResources = [
  { id: 'order-pg', type: 'postgres', database: 'relay' },
  { id: 'order-mongo', type: 'mongodb', database: 'relay' },
];

const verdict = {
  stubConnected: false,
  unknownResource_errorCode: null,
  unknownResource_errorMessage: null,
  unknownResource_codeIs32602: false,
  unknownResource_messageMatches: false,
  validPg_responseReceived: false,
  validPg_hasTables: false,
  validPg_hasType: false,
  validPg_hasDatabase: false,
  validPg_typeIsPostgres: false,
  validPg_databaseMatches: false,
  validPg_tablesIsArray: false,
  validMongo_responseReceived: false,
  validMongo_hasTables: false,
  validMongo_hasType: false,
  validMongo_hasDatabase: false,
  validMongo_typeIsMongodb: false,
  validMongo_databaseMatches: false,
  validMongo_tablesIsArray: false,
  rawUnknown: null,
  rawPg: null,
  rawMongo: null,
  passed: false,
};

function sendRpc(ws, id, method, params) {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
}

function waitForResponse(ws, expectedId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for response id=${expectedId}`)), timeoutMs);
    const handler = (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.jsonrpc === '2.0' && msg.id === expectedId) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

async function main() {
  console.log('=== AC-018: describe_resource black-box probe ===\n');

  // Connect to the stub as a test client (not the relay).
  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout connecting to stub')), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      verdict.stubConnected = true;
      console.log('[SETUP] Connected to control-plane stub as test client');
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // Wait a moment for the stub to register us and for any resource_update
  // to have been processed.
  await new Promise((r) => setTimeout(r, 500));

  // ---- Test 1: unknown resourceId -------------------------------------
  console.log('\n[TEST 1] describe_resource with unknown resourceId...');
  sendRpc(ws, 'ac018-unknown', 'describe_resource', { resourceId: 'nonexistent' });
  const resp1 = await waitForResponse(ws, 'ac018-unknown', TIMEOUT_MS);

  verdict.rawUnknown = resp1;
  verdict.unknownResource_errorCode = resp1.error?.code ?? null;
  verdict.unknownResource_errorMessage = resp1.error?.message ?? null;
  verdict.unknownResource_codeIs32602 = resp1.error?.code === -32602;
  verdict.unknownResource_messageMatches = resp1.error?.message === 'Unknown resource: nonexistent';

  console.log(`  Response error code: ${verdict.unknownResource_errorCode}`);
  console.log(`  Response error message: ${verdict.unknownResource_errorMessage}`);
  console.log(`  Code === -32602: ${verdict.unknownResource_codeIs32602}`);
  console.log(`  Message matches: ${verdict.unknownResource_messageMatches}`);

  if (!verdict.unknownResource_codeIs32602 || !verdict.unknownResource_messageMatches) {
    console.error('  FAIL: describe_resource(unknown) did not return expected error');
  } else {
    console.log('  PASS');
  }

  // ---- Test 2: valid resourceId (order-pg) ---------------------------
  console.log('\n[TEST 2] describe_resource with order-pg...');
  sendRpc(ws, 'ac018-pg', 'describe_resource', { resourceId: 'order-pg' });
  const resp2 = await waitForResponse(ws, 'ac018-pg', TIMEOUT_MS);

  verdict.rawPg = resp2;
  verdict.validPg_responseReceived = true;
  const r2 = resp2.result || {};
  verdict.validPg_hasTables = 'tables' in r2;
  verdict.validPg_hasType = 'type' in r2;
  verdict.validPg_hasDatabase = 'database' in r2;
  verdict.validPg_typeIsPostgres = r2.type === 'postgres';
  verdict.validPg_databaseMatches = r2.database === 'relay';
  verdict.validPg_tablesIsArray = Array.isArray(r2.tables);

  console.log(`  Response result keys: ${Object.keys(r2).join(', ')}`);
  console.log(`  has tables: ${verdict.validPg_hasTables}`);
  console.log(`  has type: ${verdict.validPg_hasType}`);
  console.log(`  has database: ${verdict.validPg_hasDatabase}`);
  console.log(`  type === 'postgres': ${verdict.validPg_typeIsPostgres}`);
  console.log(`  database === 'relay': ${verdict.validPg_databaseMatches}`);
  console.log(`  tables is array: ${verdict.validPg_tablesIsArray}`);
  if (Array.isArray(r2.tables)) {
    console.log(`  tables length: ${r2.tables.length}`);
    if (r2.tables.length > 0) {
      console.log(`  first table keys: ${Object.keys(r2.tables[0]).join(', ')}`);
    }
  }

  if (verdict.validPg_hasTables && verdict.validPg_hasType && verdict.validPg_hasDatabase
    && verdict.validPg_typeIsPostgres && verdict.validPg_databaseMatches && verdict.validPg_tablesIsArray) {
    console.log('  PASS');
  } else {
    console.error('  FAIL: describe_resource(order-pg) response shape invalid');
  }

  // ---- Test 3: valid resourceId (order-mongo) ---------------------------
  console.log('\n[TEST 3] describe_resource with order-mongo...');
  sendRpc(ws, 'ac018-mongo', 'describe_resource', { resourceId: 'order-mongo' });
  const resp3 = await waitForResponse(ws, 'ac018-mongo', TIMEOUT_MS);

  verdict.rawMongo = resp3;
  verdict.validMongo_responseReceived = true;
  const r3 = resp3.result || {};
  verdict.validMongo_hasTables = 'tables' in r3;
  verdict.validMongo_hasType = 'type' in r3;
  verdict.validMongo_hasDatabase = 'database' in r3;
  verdict.validMongo_typeIsMongodb = r3.type === 'mongodb';
  verdict.validMongo_databaseMatches = r3.database === 'relay';
  verdict.validMongo_tablesIsArray = Array.isArray(r3.tables);

  console.log(`  Response result keys: ${Object.keys(r3).join(', ')}`);
  console.log(`  has tables: ${verdict.validMongo_hasTables}`);
  console.log(`  has type: ${verdict.validMongo_hasType}`);
  console.log(`  has database: ${verdict.validMongo_hasDatabase}`);
  console.log(`  type === 'mongodb': ${verdict.validMongo_typeIsMongodb}`);
  console.log(`  database === 'relay': ${verdict.validMongo_databaseMatches}`);
  console.log(`  tables is array: ${verdict.validMongo_tablesIsArray}`);
  if (Array.isArray(r3.tables)) {
    console.log(`  tables length: ${r3.tables.length}`);
    if (r3.tables.length > 0) {
      console.log(`  first table keys: ${Object.keys(r3.tables[0]).join(', ')}`);
    }
  }

  if (verdict.validMongo_hasTables && verdict.validMongo_hasType && verdict.validMongo_hasDatabase
    && verdict.validMongo_typeIsMongodb && verdict.validMongo_databaseMatches && verdict.validMongo_tablesIsArray) {
    console.log('  PASS');
  } else {
    console.error('  FAIL: describe_resource(order-mongo) response shape invalid');
  }

  // ---- Final Verdict -------------------------------------------------
  const unknownPass = verdict.unknownResource_codeIs32602 && verdict.unknownResource_messageMatches;
  const pgPass = verdict.validPg_hasTables && verdict.validPg_hasType && verdict.validPg_hasDatabase
    && verdict.validPg_typeIsPostgres && verdict.validPg_databaseMatches && verdict.validPg_tablesIsArray;
  const mongoPass = verdict.validMongo_hasTables && verdict.validMongo_hasType && verdict.validMongo_hasDatabase
    && verdict.validMongo_typeIsMongodb && verdict.validMongo_databaseMatches && verdict.validMongo_tablesIsArray;

  verdict.passed = unknownPass && pgPass && mongoPass;

  console.log('\n=== VERDICT ===');
  const result = {
    id: 'WI-AC-018',
    qa: verdict.passed,
    implementation: verdict.passed,
    defects: [],
  };

  if (!verdict.stubConnected) {
    result.defects.push('expected stub connection; observed could not connect to control-plane stub; evidence ws connection failed');
  }
  if (!unknownPass) {
    result.defects.push(
      `expected error code -32602 and message "Unknown resource: nonexistent"; `
      + `observed code=${JSON.stringify(verdict.unknownResource_errorCode)} message=${JSON.stringify(verdict.unknownResource_errorMessage)}; `
      + `evidence raw response: ${JSON.stringify(verdict.rawUnknown)}`,
    );
  }
  if (!pgPass) {
    result.defects.push(
      `expected {tables, type, database} for order-pg; `
      + `observed hasTables=${verdict.validPg_hasTables} hasType=${verdict.validPg_hasType} hasDatabase=${verdict.validPg_hasDatabase} `
      + `typeMatch=${verdict.validPg_typeIsPostgres} dbMatch=${verdict.validPg_databaseMatches} tablesIsArray=${verdict.validPg_tablesIsArray}; `
      + `evidence: ${JSON.stringify(verdict.rawPg)}`,
    );
  }
  if (!mongoPass) {
    result.defects.push(
      `expected {tables, type, database} for order-mongo; `
      + `observed hasTables=${verdict.validMongo_hasTables} hasType=${verdict.validMongo_hasType} hasDatabase=${verdict.validMongo_hasDatabase} `
      + `typeMatch=${verdict.validMongo_typeIsMongodb} dbMatch=${verdict.validMongo_databaseMatches} tablesIsArray=${verdict.validMongo_tablesIsArray}; `
      + `evidence: ${JSON.stringify(verdict.rawMongo)}`,
    );
  }

  if (result.defects.length === 0) {
    console.log('All checks passed — no defects');
  } else {
    console.log(`Defects: ${result.defects.length}`);
    for (const d of result.defects) console.log(`  - ${d}`);
    result.qa = false;
    result.implementation = false;
  }

  ws.close();
  console.log('\n===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify(result));
  console.log('===HARNESS-VERDICT-END===');
}

main().catch((err) => {
  console.error(`Probe failed: ${err.message}`);
  const result = {
    id: 'WI-AC-018',
    qa: false,
    implementation: false,
    defects: [`probe error: ${err.message}`],
  };
  console.log('\n===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify(result));
  console.log('===HARNESS-VERDICT-END===');
  process.exit(1);
});
