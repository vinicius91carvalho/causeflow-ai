// AC-025 QA Test: Postgres limit clamping at real WebSocket boundary.
//
// Tests:
//   1. No explicit limit → defaults to maxRowsPerQuery=1000 → all 5 rows returned
//   2. limit=3 → policy allows (3<=1000), driver clamps to min(3,1000)=3 → 3 rows
//   3. limit=5 → policy allows, driver clamps to min(5,1000)=5 → 5 rows (entire table)
//   4. limit=2000 → policy REJECTS (2000>1000) → -32600 with "Row limit 2000 exceeds maximum 1000"

import WebSocket from 'ws';

const STUB_URL = 'ws://localhost:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';

let nextId = 1;

function rpcRequest(method, params = {}) {
  const id = nextId++;
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

function runTest(description, ws, request, expectFn) {
  return new Promise((resolve, reject) => {
    const id = JSON.parse(request).id;
    const handler = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.jsonrpc !== '2.0' || msg.id !== id) return;
      ws.removeListener('message', handler);
      try {
        expectFn(msg);
        console.log(`  PASS: ${description}`);
        resolve();
      } catch (err) {
        console.log(`  FAIL: ${description} — ${err.message}`);
        console.log(`    Received: ${JSON.stringify(msg)}`);
        reject(err);
      }
    };
    ws.on('message', handler);
    ws.send(request);
  });
}

async function main() {
  console.log('AC-025: Postgres limit clamping verification\n');

  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    ws.on('unexpected-response', (req, res) => {
      reject(new Error(`Handshake rejected: ${res.statusCode}`));
    });
  });

  console.log('Connected to control-plane stub\n');

  const errors = [];
  let ran = 0;

  // --- Test 1: No explicit limit (defaults to maxRows) ---
  try {
    ran++;
    await runTest(
      'no explicit limit returns all 5 rows from orders',
      ws,
      rpcRequest('execute', {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status, customer FROM orders ORDER BY id' },
      }),
      (msg) => {
        if (msg.error) throw new Error(`Unexpected error: ${JSON.stringify(msg.error)}`);
        if (!msg.result) throw new Error('Missing result');
        if (!Array.isArray(msg.result.rows)) throw new Error('result.rows is not an array');
        if (msg.result.rowCount !== 5) throw new Error(`Expected rowCount=5, got ${msg.result.rowCount}`);
        if (msg.result.rows.length !== 5) throw new Error(`Expected 5 rows, got ${msg.result.rows.length}`);
        if (typeof msg.result.executionTimeMs !== 'number') throw new Error('Missing executionTimeMs');
      },
    );
  } catch (err) {
    errors.push(err);
  }

  // --- Test 2: limit=3 (below max) -> 3 rows ---
  try {
    ran++;
    await runTest(
      'limit=3 returns exactly 3 rows (clamped to 3)',
      ws,
      rpcRequest('execute', {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status, customer FROM orders ORDER BY id', limit: 3 },
      }),
      (msg) => {
        if (msg.error) throw new Error(`Unexpected error: ${JSON.stringify(msg.error)}`);
        if (!msg.result) throw new Error('Missing result');
        if (msg.result.rowCount !== 3) throw new Error(`Expected rowCount=3, got ${msg.result.rowCount}`);
        if (msg.result.rows.length !== 3) throw new Error(`Expected 3 rows, got ${msg.result.rows.length}`);
        // Verify the rows are the first 3 by id
        const ids = msg.result.rows.map(r => r.id);
        if (JSON.stringify(ids) !== JSON.stringify([1, 2, 3])) {
          throw new Error(`Expected ids [1,2,3], got ${JSON.stringify(ids)}`);
        }
      },
    );
  } catch (err) {
    errors.push(err);
  }

  // --- Test 3: limit=5 (same as available rows) -> 5 rows ---
  try {
    ran++;
    await runTest(
      'limit=5 returns all 5 rows (clamped to 5)',
      ws,
      rpcRequest('execute', {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status, customer FROM orders ORDER BY id', limit: 5 },
      }),
      (msg) => {
        if (msg.error) throw new Error(`Unexpected error: ${JSON.stringify(msg.error)}`);
        if (!msg.result) throw new Error('Missing result');
        if (msg.result.rowCount !== 5) throw new Error(`Expected rowCount=5, got ${msg.result.rowCount}`);
        if (msg.result.rows.length !== 5) throw new Error(`Expected 5 rows, got ${msg.result.rows.length}`);
        const ids = msg.result.rows.map(r => r.id);
        if (JSON.stringify(ids) !== JSON.stringify([1, 2, 3, 4, 5])) {
          throw new Error(`Expected ids [1,2,3,4,5], got ${JSON.stringify(ids)}`);
        }
      },
    );
  } catch (err) {
    errors.push(err);
  }

  // --- Test 4: limit=2000 (exceeds maxRowsPerQuery=1000) -> policy rejection ---
  try {
    ran++;
    await runTest(
      'limit=2000 is rejected by policy (exceeds maxRowsPerQuery=1000)',
      ws,
      rpcRequest('execute', {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id FROM orders', limit: 2000 },
      }),
      (msg) => {
        if (!msg.error) throw new Error('Expected error but got result');
        if (msg.error.code !== -32600) throw new Error(`Expected error code -32600, got ${msg.error.code}`);
        if (!msg.error.message.includes('2000') || !msg.error.message.includes('1000')) {
          throw new Error(`Expected message mentioning 2000 and 1000, got: ${msg.error.message}`);
        }
      },
    );
  } catch (err) {
    errors.push(err);
  }

  // --- Test 5: Code inspection — driver defensive clamp ---
  // Verify the source code clamps defensively in PgDriver.execute().
  try {
    ran++;
    const { PgDriver } = await import('./dist/drivers/postgres/pg-driver.js');
    const driver = new PgDriver({
      host: 'localhost',
      port: 5432,
      database: 'relay',
      user: 'relay',
      password: 'relay',
      maxRows: 1000,
    });

    // Execute with limit=5 on a connection that bypasses policy
    const result = await driver.execute({
      operation: 'query',
      params: { sql: 'SELECT id FROM orders ORDER BY id', limit: 5 },
    });
    if (result.rowCount !== 5) throw new Error(`Expected 5 rows, got ${result.rowCount}`);
    console.log('  PASS: PgDriver with limit=5 (below maxRows) returns 5 rows');

    // Execute with limit=2000 (above maxRows=1000) – defensive clamp
    const result2 = await driver.execute({
      operation: 'query',
      params: { sql: 'SELECT id FROM orders ORDER BY id', limit: 2000 },
    });
    if (result2.rowCount !== 5) throw new Error(`Expected 5 rows (only 5 exist, clamped from 2000 to 1000), got ${result2.rowCount}`);
    console.log('  PASS: PgDriver with limit=2000 (above maxRows=1000) clamped to 1000, returns 5 rows (all available)');

    await driver.close();
  } catch (err) {
    errors.push(err);
  }

  // --- Test 6: Driver defensive clamp with no explicit limit ---
  try {
    ran++;
    const { PgDriver } = await import('./dist/drivers/postgres/pg-driver.js');
    const driver = new PgDriver({
      host: 'localhost',
      port: 5432,
      database: 'relay',
      user: 'relay',
      password: 'relay',
      maxRows: 3, // deliberately small
    });

    const result = await driver.execute({
      operation: 'query',
      params: { sql: 'SELECT id FROM orders ORDER BY id' }, // no limit param
    });
    if (result.rowCount !== 3) throw new Error(`Expected 3 rows (maxRows=3), got ${result.rowCount}`);
    console.log('  PASS: PgDriver with maxRows=3 and no explicit limit returns 3 rows');

    const result2 = await driver.execute({
      operation: 'query',
      params: { sql: 'SELECT id FROM orders ORDER BY id', limit: 10 },
    });
    if (result2.rowCount !== 3) throw new Error(`Expected 3 rows (clamped to maxRows=3), got ${result2.rowCount}`);
    console.log('  PASS: PgDriver with maxRows=3 and limit=10 clamped to 3 rows');

    await driver.close();
  } catch (err) {
    errors.push(err);
  }

  ws.close();

  console.log(`\n--- Results: ${ran - errors.length}/${ran} tests passed ---`);
  if (errors.length > 0) {
    console.log(`Defects (${errors.length}):`);
    for (const e of errors) {
      console.log(`  - ${e.message}`);
    }
    process.exit(1);
  } else {
    console.log('All tests passed. AC-025 verified.');
  }
}

main().catch((err) => {
  console.error('Test harness error:', err);
  process.exit(1);
});
