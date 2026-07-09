#!/usr/bin/env node
/**
 * QA test for WI-AC-022: PgDriver `list_tables` operation.
 *
 * Tests against the real relay-postgres container (already running via docker-compose).
 * Verifies the exact AC-022 contract:
 *   - Runs SELECT table_name, table_type FROM information_schema.tables
 *     WHERE table_schema = 'public' ORDER BY table_name
 *   - Returns rows as `rows`
 *   - Returns fields: [{ name: 'table_name', type: 'text' }, { name: 'table_type', type: 'text' }]
 */

import { PgDriver } from '../../dist/drivers/postgres/pg-driver.js';

const PG_HOST = process.env.PG_HOST ?? 'localhost';
const PG_PORT = Number(process.env.PG_PORT ?? 5432);
const PG_DATABASE = process.env.PG_DATABASE ?? 'relay';
const PG_USER = process.env.PG_USER ?? 'relay';
const PG_PASSWORD = process.env.PG_PASSWORD ?? 'relay';

let passCount = 0;
let failCount = 0;
const defects: string[] = [];

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ ${label}`);
    failCount++;
    defects.push(detail ?? label);
  }
}

async function main() {
  console.log(`\nWI-AC-022 QA: PgDriver list_tables`);
  console.log(`Target: postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`);
  console.log('');

  const driver = new PgDriver({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
  });

  try {
    // First verify we can connect and Postgres is alive
    const healthy = await driver.healthCheck();
    assert('Postgres health check passes', healthy, 'healthCheck returned false');

    // --- Test: list_tables ---
    const result = await driver.execute({
      operation: 'list_tables',
      params: {},
    });

    // Core AC-022 assertions
    assert('result has rows (array)', Array.isArray(result.rows), `rows is ${typeof result.rows}`);
    assert(
      'result.rows contains at least the orders table',
      result.rows.some((r: Record<string, unknown>) => r.table_name === 'orders'),
      `orders table not found in rows: ${JSON.stringify(result.rows)}`,
    );
    assert('result has rowCount (number)', typeof result.rowCount === 'number', `rowCount is ${typeof result.rowCount}`);
    assert('result has executionTimeMs (number)', typeof result.executionTimeMs === 'number', `executionTimeMs is ${typeof result.executionTimeMs}`);
    assert('result has fields (array)', Array.isArray(result.fields), `fields is ${typeof result.fields}`);

    // Check fields match AC-022 spec
    if (Array.isArray(result.fields)) {
      const tableNameField = result.fields.find((f: { name: string }) => f.name === 'table_name');
      const tableTypeField = result.fields.find((f: { name: string }) => f.name === 'table_type');

      assert('fields includes table_name', !!tableNameField, 'table_name field missing');
      assert('fields includes table_type', !!tableTypeField, 'table_type field missing');

      if (tableNameField) {
        assert(
          'table_name type is "text"',
          tableNameField.type === 'text',
          `table_name type is "${tableNameField.type}" expected "text"`,
        );
      }
      if (tableTypeField) {
        assert(
          'table_type type is "text"',
          tableTypeField.type === 'text',
          `table_type type is "${tableTypeField.type}" expected "text"`,
        );
      }
    }

    // Verify the rows contain correct columns
    for (const row of result.rows) {
      assert(
        `row has table_name property (got ${Object.keys(row).join(',')})`,
        'table_name' in row,
        `missing table_name in ${JSON.stringify(row)}`,
      );
      assert(
        `row has table_type property`,
        'table_type' in row,
        `missing table_type in ${JSON.stringify(row)}`,
      );
    }

    // Verify the SQL ran correctly by checking that orders has expected type
    const ordersRow = result.rows.find((r: Record<string, unknown>) => r.table_name === 'orders');
    if (ordersRow) {
      assert(
        'orders table_type is "BASE TABLE"',
        ordersRow.table_type === 'BASE TABLE',
        `orders table_type is "${ordersRow.table_type}" expected "BASE TABLE"`,
      );
    }

    // --- Summary ---
    console.log(`\nResults: ${passCount} passed, ${failCount} failed`);

    if (failCount === 0) {
      console.log('\nAC-022 PASSES. Implementation is correct.');
    } else {
      console.log('\nAC-022 FAILS. See defects above.');
    }

  } catch (err) {
    console.error('\n  ✗ Unexpected error:', err instanceof Error ? err.message : String(err));
    defects.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    failCount++;
  } finally {
    await driver.close();
  }

  // Emit verdict JSON
  const passed = failCount === 0;
  const verdict = {
    id: 'WI-AC-022',
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
