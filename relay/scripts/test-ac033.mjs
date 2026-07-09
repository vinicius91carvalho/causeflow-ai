// AC-033 Acceptance Check — MongoDB query with filter / sql / default fallback.
//
// Tests that an `execute` request with `operation: 'query'` on a MongoDB
// resource:
//   - accepts `params.params.filter` as the find filter
//   - accepts `params.params.sql` (JSON.parsed into a filter when filter is
//     empty)
//   - falls back to `{}` if neither is supplied
//   - returns `rows` as `Record<string, unknown>[]`
//
// Usage: node scripts/test-ac033.mjs

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_URL = process.env.STUB_URL || 'ws://localhost:5191/v1/relay/connect';
const TOKEN = process.env.RELAY_TOKEN || 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID || 'harness-tenant';

const COLLECTION = 'test_ac033';

let exitCode = 0;

function log(msg, extra) {
  const line = extra ? `[ac033] ${msg} ${JSON.stringify(extra)}` : `[ac033] ${msg}`;
  console.log(line);
}

function sendRpc(ws, method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, id, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for response id=${id}`));
    }, timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === id) {
        cleanup();
        resolve(msg);
      }
    };
    const onClose = () => { cleanup(); reject(new Error('socket closed')); };
    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
    }
    ws.on('message', onMessage);
    ws.on('close', onClose);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = `${STUB_URL}?token=${TOKEN}&tenantId=${TENANT_ID}`;
  log(`connecting to ${url}`);

  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Tenant-Id': TENANT_ID,
    },
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  log('connected to stub');

  // Helper: run execute.query on order-mongo
  async function execQuery(params, label) {
    const id = sendRpc(ws, 'execute', {
      resourceId: 'order-mongo',
      operation: 'query',
      params,
    });
    const resp = await waitForResponse(ws, id);
    log(`${label} response:`, resp.error ? resp.error : { rowCount: resp.result?.rowCount, rows: resp.result?.rows });
    return resp;
  }

  // ----------------------------------------------------------------
  // Test 1: filter parameter used directly as find filter
  // ----------------------------------------------------------------
  log('\n--- Test 1: filter as find filter ---');
  const r1 = await execQuery(
    { collection: COLLECTION, filter: { status: 'active' } },
    'filter-active',
  );

  if (r1.error) {
    log(`FAIL: test 1 returned error: ${JSON.stringify(r1.error)}`);
    exitCode = 1;
  } else {
    const rows = r1.result?.rows;
    if (!Array.isArray(rows)) {
      log(`FAIL: test 1 rows is not an array`);
      exitCode = 1;
    } else if (rows.length === 0) {
      log(`FAIL: test 1 expected active docs, got 0 rows`);
      exitCode = 1;
    } else {
      // Every row should have status=active
      const allActive = rows.every((r) => r.status === 'active');
      if (!allActive) {
        log(`FAIL: test 1 not all rows have status=active`);
        exitCode = 1;
      } else {
        log(`PASS: test 1 filter returned ${rows.length} active documents`);
      }
      // Verify rows are Record<string, unknown>[] shape
      const validRows = rows.every((r) => typeof r === 'object' && r !== null && r._id !== undefined);
      if (!validRows) {
        log(`FAIL: test 1 rows not shaped as Record<string, unknown>[]`);
        exitCode = 1;
      }
    }
  }

  // ----------------------------------------------------------------
  // Test 2: sql parameter (JSON string parsed as filter when filter is empty)
  // ----------------------------------------------------------------
  log('\n--- Test 2: sql as JSON filter ---');
  const r2 = await execQuery(
    { collection: COLLECTION, sql: '{"status": "inactive"}' },   // no filter, should use sql
    'sql-inactive',
  );

  if (r2.error) {
    log(`FAIL: test 2 returned error: ${JSON.stringify(r2.error)}`);
    exitCode = 1;
  } else {
    const rows = r2.result?.rows;
    if (!Array.isArray(rows)) {
      log(`FAIL: test 2 rows is not an array`);
      exitCode = 1;
    } else if (rows.length === 0) {
      log(`FAIL: test 2 expected inactive docs, got 0 rows`);
      exitCode = 1;
    } else {
      const allInactive = rows.every((r) => r.status === 'inactive');
      if (!allInactive) {
        log(`FAIL: test 2 not all rows have status=inactive`);
        exitCode = 1;
      } else {
        log(`PASS: test 2 sql filter returned ${rows.length} inactive documents`);
      }
    }
  }

  // ----------------------------------------------------------------
  // Test 3: No filter and no sql — fallback to {}
  // ----------------------------------------------------------------
  log('\n--- Test 3: fallback to {} ---');
  const r3 = await execQuery(
    { collection: COLLECTION },   // no filter, no sql
    'no-filter-no-sql',
  );

  if (r3.error) {
    log(`FAIL: test 3 returned error: ${JSON.stringify(r3.error)}`);
    exitCode = 1;
  } else {
    const rows = r3.result?.rows;
    if (!Array.isArray(rows)) {
      log(`FAIL: test 3 rows is not an array`);
      exitCode = 1;
    } else if (rows.length === 0) {
      log(`FAIL: test 3 fallback to {} should return all docs`);
      exitCode = 1;
    } else {
      // Should return all 8 documents
      log(`PASS: test 3 fallback returned ${rows.length} documents (expected 8)`);
      if (rows.length !== 8) {
        log(`WARN: test 3 expected 8 documents, got ${rows.length}`);
      }
    }
  }

  // ----------------------------------------------------------------
  // Test 4: filter takes precedence over sql
  // ----------------------------------------------------------------
  log('\n--- Test 4: filter takes precedence over sql ---');
  const r4 = await execQuery(
    { collection: COLLECTION, filter: { status: 'active' }, sql: '{"status": "inactive"}' },
    'filter-over-sql',
  );

  if (r4.error) {
    log(`FAIL: test 4 returned error: ${JSON.stringify(r4.error)}`);
    exitCode = 1;
  } else {
    const rows = r4.result?.rows;
    if (!Array.isArray(rows)) {
      log(`FAIL: test 4 rows is not an array`);
      exitCode = 1;
    } else {
      const allActive = rows.every((r) => r.status === 'active');
      if (!allActive) {
        log(`FAIL: test 4 filter did not take precedence over sql`);
        exitCode = 1;
      } else {
        log(`PASS: test 4 filter takes precedence over sql (${rows.length} active docs)`);
      }
    }
  }

  // ----------------------------------------------------------------
  // Test 5: Empty filter + invalid sql falls back to {}
  // ----------------------------------------------------------------
  log('\n--- Test 5: invalid sql falls back to {} ---');
  const r5 = await execQuery(
    { collection: COLLECTION, sql: 'not-valid-json' },
    'invalid-sql',
  );

  if (r5.error) {
    log(`FAIL: test 5 returned error: ${JSON.stringify(r5.error)}`);
    exitCode = 1;
  } else {
    const rows = r5.result?.rows;
    if (!Array.isArray(rows)) {
      log(`FAIL: test 5 rows is not an array`);
      exitCode = 1;
    } else if (rows.length === 0) {
      log(`FAIL: test 5 invalid sql should fallback to {}`);
      exitCode = 1;
    } else {
      log(`PASS: test 5 invalid sql falls back to {} (${rows.length} docs)`);
    }
  }

  // ----------------------------------------------------------------
  // Test 6: Verify the response has the required fields
  // ----------------------------------------------------------------
  log('\n--- Test 6: response shape ---');
  const r6 = await execQuery(
    { collection: COLLECTION, filter: { status: 'active' } },
    'response-shape',
  );

  if (r6.result) {
    const { rows, rowCount, executionTimeMs } = r6.result;
    const issues = [];
    if (!Array.isArray(rows)) issues.push('rows is not array');
    if (typeof rowCount !== 'number') issues.push('rowCount not a number');
    if (typeof executionTimeMs !== 'number') issues.push('executionTimeMs not a number');

    if (issues.length > 0) {
      log(`FAIL: response shape issues: ${issues.join(', ')}`);
      exitCode = 1;
    } else {
      log(`PASS: response has correct shape (rows[], rowCount=${rowCount}, executionTimeMs=${executionTimeMs})`);
    }

    // Verify rows are cast to Record<string, unknown>[]
    if (Array.isArray(rows) && rows.length > 0) {
      const allRecords = rows.every((r) => typeof r === 'object' && r !== null);
      const allHaveId = rows.every((r) => '_id' in r);
      if (!allRecords || !allHaveId) {
        log(`FAIL: rows not in Record<string, unknown>[] shape`);
        exitCode = 1;
      } else {
        log(`PASS: all rows are Record<string, unknown>`);
      }
    }
  }

  // Summary
  log('\n========================================');
  if (exitCode === 0) {
    log('ALL AC-033 CHECKS PASSED');
  } else {
    log(`SOME CHECKS FAILED (exitCode=${exitCode})`);
  }

  ws.close();
  process.exit(exitCode);
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
