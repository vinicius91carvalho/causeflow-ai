#!/usr/bin/env node
/**
 * QA test for WI-AC-023: PgDriver `describe_table` operation.
 *
 * Tests at the real WebSocket boundary via the running docker-compose stack
 * (relay + control-plane-stub + relay-postgres + relay-mongo).
 *
 * AC-023 contract:
 *   - execute request with operation: 'describe_table' and params.params.tableName = 'orders'
 *   - Runs information_schema.columns + information_schema.table_constraints queries
 *     scoped to the 'public' schema and the named table
 *   - Merges column rows and constraint rows (with each constraint row tagged
 *     '_type: 'constraint'') into the response `rows`
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
    console.log(`  ✓ ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ ${label}`);
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
  console.log('\n====== WI-AC-023 QA: PgDriver describe_table ======');
  console.log(`Target: ${STUB_URL}`);
  console.log('');

  const ws = await connect();
  console.log('Connected to control-plane stub.\n');

  let response;

  try {
    // ----------------------------------------------------------------
    // Send execute with operation: 'describe_table'
    // ----------------------------------------------------------------
    console.log('--- Sending execute(describe_table) for table "orders" ---');
    const reqId = randomUUID();
    response = await sendAndWait(ws, {
      jsonrpc: '2.0',
      id: reqId,
      method: 'execute',
      params: {
        resourceId: 'order-pg',
        operation: 'describe_table',
        params: { tableName: 'orders' },
      },
    });
    console.log(`Response: ${JSON.stringify(response, null, 2)}`);

    // ----------------------------------------------------------------
    // 1. Check JSON-RPC 2.0 response structure
    // ----------------------------------------------------------------
    console.log('\n--- 1. JSON-RPC 2.0 response structure ---');
    assert('jsonrpc is "2.0"', response.jsonrpc === '2.0', `jsonrpc value: ${response.jsonrpc}`);
    assert('id is echoed', String(response.id) === String(reqId), `id mismatch: ${response.id} vs ${reqId}`);
    assert('no error key', !response.error, `unexpected error: ${JSON.stringify(response.error)}`);

    // ----------------------------------------------------------------
    // 2. Check result shape
    // ----------------------------------------------------------------
    console.log('\n--- 2. Result shape ---');
    const result = response.result;
    assert('result is present', !!result, 'result key missing');
    if (!result) {
      // Can't continue without result
      throw new Error('result missing from response');
    }

    assert('result.rows is an array', Array.isArray(result.rows), `rows is ${typeof result.rows}`);
    assert('result.rowCount is a number', typeof result.rowCount === 'number', `rowCount is ${typeof result.rowCount}`);
    assert('result.executionTimeMs is a number', typeof result.executionTimeMs === 'number', `executionTimeMs is ${typeof result.executionTimeMs}`);

    // ----------------------------------------------------------------
    // 3. Verify column rows
    // ----------------------------------------------------------------
    console.log('\n--- 3. Column rows (from information_schema.columns) ---');

    // Expected columns in the orders table (from 01-orders.sql)
    const expectedColumns = [
      { name: 'id', type: 'integer', nullable: 'NO', is_pk: true },
      { name: 'status', type: 'text', nullable: 'NO' },
      { name: 'customer', type: 'text', nullable: 'YES' },
      { name: 'total_cents', type: 'integer', nullable: 'NO' },
      { name: 'created_at', type: 'timestamp with time zone', nullable: 'NO' }, // information_schema returns canonical name
    ];

    const columnRows = result.rows.filter(r => !r._type);
    const constraintRows = result.rows.filter(r => r._type === 'constraint');

    assert(
      'column rows are returned (each without _type)',
      columnRows.length === expectedColumns.length,
      `expected ${expectedColumns.length} column rows, got ${columnRows.length}. ` +
      `All rows: ${JSON.stringify(result.rows)}`,
    );

    // Verify each expected column is present
    for (const expected of expectedColumns) {
      const col = columnRows.find(c => c.column_name === expected.name);
      assert(
        `column "${expected.name}" found`,
        !!col,
        `column ${expected.name} not found in ${JSON.stringify(columnRows)}`,
      );
      if (col) {
        assert(
          `column "${expected.name}" has data_type matching`,
          String(col.data_type).toLowerCase() === expected.type ||
            String(col.data_type).toLowerCase().startsWith(expected.type),
          `expected data_type "${expected.type}", got "${col.data_type}" for column ${expected.name}`,
        );
        assert(
          `column "${expected.name}" has is_nullable as "${expected.nullable}"`,
          String(col.is_nullable).toUpperCase() === expected.nullable,
          `expected is_nullable "${expected.nullable}", got "${col.is_nullable}" for ${expected.name}`,
        );
        // All columns should have column_name, data_type, is_nullable keys at minimum
        assert(
          `column "${expected.name}" has column_name key`,
          'column_name' in col,
          `missing column_name in ${JSON.stringify(col)}`,
        );
        assert(
          `column "${expected.name}" has data_type key`,
          'data_type' in col,
          `missing data_type in ${JSON.stringify(col)}`,
        );
        assert(
          `column "${expected.name}" has is_nullable key`,
          'is_nullable' in col,
          `missing is_nullable in ${JSON.stringify(col)}`,
        );
      }
    }

    // Column rows should NOT have _type key
    for (const col of columnRows) {
      assert(
        `column row for "${col.column_name}" does NOT have _type`,
        !('_type' in col),
        `column row ${col.column_name} unexpectedly has _type: ${col._type}`,
      );
    }

    // ----------------------------------------------------------------
    // 4. Verify constraint rows
    // ----------------------------------------------------------------
    console.log('\n--- 4. Constraint rows (from information_schema.table_constraints) ---');

    // Expected: PRIMARY KEY constraint on `id` column
    const expectedConstraint = {
      constraint_name: 'orders_pkey',
      constraint_type: 'PRIMARY KEY',
      column_name: 'id',
    };

    assert(
      'constraint rows exist',
      constraintRows.length >= 1,
      `expected at least 1 constraint row, got ${constraintRows.length}`,
    );

    // Check each constraint row has _type: 'constraint'
    for (const cr of constraintRows) {
      assert(
        `constraint row "${cr.constraint_name}" has _type: "constraint"`,
        cr._type === 'constraint',
        `expected _type "constraint", got "${cr._type}" for constraint ${cr.constraint_name}`,
      );
    }

    // Find the primary key constraint
    const pkey = constraintRows.find(c => c.constraint_name === 'orders_pkey');
    assert(
      'orders_pkey PRIMARY KEY constraint found',
      !!pkey,
      `orders_pkey not found among constraint rows: ${JSON.stringify(constraintRows)}`,
    );

    if (pkey) {
      assert(
        'orders_pkey has constraint_type "PRIMARY KEY"',
        pkey.constraint_type === 'PRIMARY KEY',
        `expected "PRIMARY KEY", got "${pkey.constraint_type}"`,
      );
      assert(
        'orders_pkey has column_name "id"',
        pkey.column_name === 'id',
        `expected column_name "id", got "${pkey.column_name}"`,
      );
    }

    // ----------------------------------------------------------------
    // 5. Verify merged row count
    // ----------------------------------------------------------------
    console.log('\n--- 5. Merged response ---');

    const totalExpected = columnRows.length + constraintRows.length;
    assert(
      'rowCount matches actual rows length',
      result.rowCount === result.rows.length,
      `rowCount=${result.rowCount} !== rows.length=${result.rows.length}`,
    );
    assert(
      `rowCount ${result.rowCount} = ${columnRows.length} columns + ${constraintRows.length} constraints`,
      result.rowCount === columnRows.length + constraintRows.length,
      `expected ${columnRows.length + constraintRows.length} rows, got ${result.rowCount}`,
    );

    // ----------------------------------------------------------------
    // 6. Verify fields is NOT present (describe_table returns raw rows)
    // ----------------------------------------------------------------
    console.log('\n--- 6. Result metadata ---');

    // The describe_table response doesn't include `fields` per the spec
    // (it's not listed in the AC-023 contract)
    assert(
      'masked is boolean (present)',
      typeof result.masked === 'boolean',
      `masked is ${typeof result.masked}: ${JSON.stringify(result.masked)}`,
    );
    assert(
      'maskedFieldCount is a number',
      typeof result.maskedFieldCount === 'number',
      `maskedFieldCount is ${typeof result.maskedFieldCount}`,
    );

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    console.log(`\nResults: ${passCount} passed, ${failCount} failed`);

    if (failCount === 0) {
      console.log('\nAC-023 PASSES. Implementation is correct.');
    } else {
      console.log('\nAC-023 FAILS. See defects above.');
    }

  } catch (err) {
    console.error('\n  ✗ Unexpected error:', err instanceof Error ? err.message : String(err));
    defects.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    failCount++;
    if (response) {
      console.error('Last response:', JSON.stringify(response, null, 2));
    }
  } finally {
    ws.close();
  }

  // Emit verdict JSON
  const passed = failCount === 0;
  const verdict = {
    id: 'WI-AC-023',
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
