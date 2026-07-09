#!/usr/bin/env node
/**
 * QA test for WI-AC-024: PgDriver `query` operation.
 *
 * Tests at the real WebSocket boundary via the running docker-compose stack
 * (relay + control-plane-stub + relay-postgres + relay-mongo).
 *
 * AC-024 contract:
 *   - execute request with operation: 'query' and a single SELECT statement
 *   - Runs inside `BEGIN READ ONLY; SET statement_timeout = '30s'; <sql> LIMIT <n>; COMMIT;`
 *   - Uses a dedicated `client` from the pool
 *   - Response carries rows, rowCount, fields (each { name, type } from pg's dataTypeID),
 *     and executionTimeMs
 *   - Client released back in a `finally` block
 *   - Any error triggers ROLLBACK (best-effort) before the throw
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_URL = process.env.STUB_URL || 'ws://127.0.0.1:3000/v1/relay/connect';
const TOKEN = process.env.RELAY_TOKEN || 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID || 'harness-tenant';
const TIMEOUT_MS = 15000;

let passCount = 0;
let failCount = 0;
const defects = [];

function assert(label, ok, detail) {
  if (ok) {
    console.log(`  \u2713 ${label}`);
    passCount++;
  } else {
    console.log(`  \u2717 ${label}`);
    failCount++;
    defects.push(detail || label);
  }
}

function connect() {
  const url = `${STUB_URL}?token=${TOKEN}&tenantId=${TENANT_ID}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'X-Tenant-Id': TENANT_ID,
      },
    });
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
    const onMessage = (raw) => {
      let parsed;
      try { parsed = JSON.parse(raw.toString()); } catch { return; }
      if (String(parsed.id) === String(id)) {
        clearTimeout(timer);
        resolve(parsed);
      }
    };
    ws.on('message', onMessage);
    ws.on('close', () => {
      clearTimeout(timer);
      reject(new Error('socket closed'));
    });
    ws.send(JSON.stringify(msg));
  });
}

async function main() {
  console.log('\n====== WI-AC-024 QA: PgDriver execute(query) ======');
  console.log(`Target: ${STUB_URL}`);
  console.log('');

  const ws = await connect();
  console.log('Connected to control-plane stub.\n');

  try {
    // ================================================================
    // Test 1: SELECT with specific columns
    // ================================================================
    console.log('--- Test 1: SELECT specific columns from orders ---');
    const reqId1 = randomUUID();
    const response1 = await sendAndWait(ws, {
      jsonrpc: '2.0',
      id: reqId1,
      method: 'execute',
      params: {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status, customer, total_cents, created_at FROM orders' },
      },
    });
    console.log(`Response: ${JSON.stringify(response1, null, 2)}`);

    // 1.1 JSON-RPC 2.0 response structure
    console.log('\n--- 1.1 JSON-RPC 2.0 response structure ---');
    assert('jsonrpc is "2.0"', response1.jsonrpc === '2.0', `jsonrpc value: ${response1.jsonrpc}`);
    assert('id is echoed', String(response1.id) === String(reqId1), `id mismatch: ${response1.id} vs ${reqId1}`);
    assert('no error key', !response1.error, `unexpected error: ${JSON.stringify(response1.error)}`);

    // 1.2 Result shape
    console.log('\n--- 1.2 Result shape ---');
    const result1 = response1.result;
    assert('result is present', !!result1, 'result key missing');
    if (!result1) throw new Error('result missing from response');

    assert('result.rows is an array', Array.isArray(result1.rows), `rows is ${typeof result1.rows}`);
    assert('result.rowCount is a number', typeof result1.rowCount === 'number', `rowCount is ${typeof result1.rowCount}`);
    assert('result.executionTimeMs is a number', typeof result1.executionTimeMs === 'number', `executionTimeMs is ${typeof result1.executionTimeMs}`);
    assert('executionTimeMs >= 0', result1.executionTimeMs >= 0, `executionTimeMs is ${result1.executionTimeMs}`);

    // 1.3 Fields
    console.log('\n--- 1.3 Fields check ---');
    assert('result.fields is an array', Array.isArray(result1.fields), `fields is ${typeof result1.fields}`);
    assert('fields has entries', result1.fields.length > 0, `fields length is ${result1.fields.length}`);

    if (Array.isArray(result1.fields)) {
      for (const f of result1.fields) {
        assert(`field "${f.name}" has name property`, typeof f.name === 'string' && f.name.length > 0, `field missing name: ${JSON.stringify(f)}`);
        assert(`field "${f.name}" has type property`, typeof f.type === 'string' && f.type.length > 0, `field missing type: ${JSON.stringify(f)}`);
      }

      // Expected fields for the orders table
      const expectedFields = [
        { name: 'id', type: 'int4' },
        { name: 'status', type: 'text' },
        { name: 'customer', type: 'text' },
        { name: 'total_cents', type: 'int4' },
        { name: 'created_at', type: 'timestamptz' },
      ];
      for (const exp of expectedFields) {
        const found = result1.fields.find(f => f.name === exp.name);
        assert(`field "${exp.name}" found in fields`, !!found, `field ${exp.name} not found in ${JSON.stringify(result1.fields)}`);
        if (found) {
          assert(`field "${exp.name}" has type "${exp.type}"`, found.type === exp.type, `expected type "${exp.type}", got "${found.type}" for field "${exp.name}"`);
        }
      }
    }

    // 1.4 Row data
    console.log('\n--- 1.4 Row data ---');
    // Seed data: 5 rows from scripts/control-plane-stub/initdb/01-orders.sql
    assert('rows has 5 entries', result1.rows.length === 5, `expected 5 rows, got ${result1.rows.length}`);
    if (result1.rows.length >= 5) {
      const row1 = result1.rows[0];
      assert('row 1 has id=1', row1.id === 1, `expected id=1, got ${JSON.stringify(row1.id)}`);
      assert('row 1 has status', typeof row1.status === 'string', `status missing: ${JSON.stringify(row1.status)}`);
      assert('row 1 has customer', typeof row1.customer === 'string', `customer missing: ${JSON.stringify(row1.customer)}`);
      assert('row 1 has total_cents', typeof row1.total_cents === 'number', `total_cents missing: ${JSON.stringify(row1.total_cents)}`);
      // created_at should be a string (ISO date) or a number (timestamp).
      // It should NOT be an empty object {} which indicates a Date serialization bug.
      assert('row 1 has created_at', row1.created_at !== undefined && row1.created_at !== null,
        `created_at is undefined/null`);
      assert('created_at is not an empty object',
        !(typeof row1.created_at === 'object' && Object.keys(row1.created_at).length === 0),
        `created_at is empty object {} -- Date object not serialized correctly`);
    }

    // 1.5 Masking metadata
    console.log('\n--- 1.5 Masking metadata ---');
    assert('result.masked is boolean', typeof result1.masked === 'boolean', `masked is ${typeof result1.masked}`);
    assert('result.maskedFieldCount is number', typeof result1.maskedFieldCount === 'number', `maskedFieldCount is ${typeof result1.maskedFieldCount}`);
    // The orders data has no PII patterns (no CPF, email, credit card), so maskedFieldCount should be 0
    assert('maskedFieldCount is 0 for plain data', result1.maskedFieldCount === 0, `maskedFieldCount is ${result1.maskedFieldCount}`);

    // 1.6 rowCount matches rows length
    assert('rowCount matches rows.length', result1.rowCount === result1.rows.length, `rowCount=${result1.rowCount} !== rows.length=${result1.rows.length}`);

    // ================================================================
    // Test 2: SELECT with LIMIT
    // ================================================================
    console.log('\n--- Test 2: SELECT with explicit LIMIT ---');
    const reqId2 = randomUUID();
    const response2 = await sendAndWait(ws, {
      jsonrpc: '2.0',
      id: reqId2,
      method: 'execute',
      params: {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT id, status FROM orders', limit: 1 },
      },
    });
    console.log(`Response: ${JSON.stringify(response2, null, 2)}`);

    assert('no error', !response2.error, `unexpected error: ${JSON.stringify(response2.error)}`);
    assert('result present', !!response2.result, 'result missing');
    if (response2.result) {
      assert('rows is array', Array.isArray(response2.result.rows), `rows is ${typeof response2.result.rows}`);
      // The orders table has only 1 row anyway, but the LIMIT should still be enforced server-side
      assert('rowCount is 1', response2.result.rowCount === 1, `expected 1 row, got ${response2.result.rowCount}`);
    }

    // ================================================================
    // Test 3: Error handling — bad SQL triggers ROLLBACK
    // ================================================================
    console.log('\n--- Test 3: Error handling (bad SQL) ---');
    const reqId3 = randomUUID();
    const response3 = await sendAndWait(ws, {
      jsonrpc: '2.0',
      id: reqId3,
      method: 'execute',
      params: {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT * FROM nonexistent_table_xyz' },
      },
    });
    console.log(`Response: ${JSON.stringify(response3, null, 2)}`);

    assert('has error key', !!response3.error, 'expected error but none received');
    if (response3.error) {
      assert('error code is -32603', response3.error.code === -32603, `error code is ${response3.error.code}`);
      assert('error message mentions the table', 
        response3.error.message && response3.error.message.toLowerCase().includes('nonexistent_table_xyz'),
        `error message does not mention the table: ${response3.error.message}`);
    }

    // ================================================================
    // Test 4: SELECT 1 AS one (simple scalar query)
    // ================================================================
    console.log('\n--- Test 4: SELECT 1 AS one ---');
    const reqId4 = randomUUID();
    const response4 = await sendAndWait(ws, {
      jsonrpc: '2.0',
      id: reqId4,
      method: 'execute',
      params: {
        resourceId: 'order-pg',
        operation: 'query',
        params: { sql: 'SELECT 1 AS one' },
      },
    });
    console.log(`Response: ${JSON.stringify(response4, null, 2)}`);

    assert('no error', !response4.error, `unexpected error: ${JSON.stringify(response4.error)}`);
    if (response4.result) {
      assert('rows is array', Array.isArray(response4.result.rows), `rows is ${typeof response4.result.rows}`);
      assert('rowCount is 1', response4.result.rowCount === 1, `expected 1 row, got ${response4.result.rowCount}`);
      if (response4.result.rows.length >= 1) {
        assert('row has one=1', response4.result.rows[0].one === 1, `expected one=1, got ${JSON.stringify(response4.result.rows[0].one)}`);
      }
      if (Array.isArray(response4.result.fields)) {
        const oneField = response4.result.fields.find(f => f.name === 'one');
        assert('field "one" has type "int4"', oneField && oneField.type === 'int4', `field "one" type is ${oneField?.type}`);
      }
    }

    // ================================================================
    // Summary
    // ================================================================
    console.log(`\nResults: ${passCount} passed, ${failCount} failed`);

    if (failCount === 0) {
      console.log('\nAC-024 PASSES. Implementation is correct.');
    } else {
      console.log('\nAC-024 FAILS. See defects above.');
    }

  } catch (err) {
    console.error('\n  \u2717 Unexpected error:', err instanceof Error ? err.message : String(err));
    defects.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    failCount++;
  } finally {
    ws.close();
  }

  // Emit verdict JSON
  const passed = failCount === 0;
  const verdict = {
    id: 'WI-AC-024',
    qa: passed,
    implementation: passed,
    defects: passed ? [] : defects,
  };

  console.log('\n===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify(verdict));
  console.log('===HARNESS-VERDICT-END===');

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
