// AC-021 Verify-First Probe
// Tests execute response shape with masking at the real WebSocket boundary.
// Connects as a test client to the control-plane stub, sends execute requests,
// and validates the response shape per AC-021.

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_PORT = process.env.STUB_PORT || '5191';
const STUB_URL = `ws://127.0.0.1:${STUB_PORT}/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant`;
const TIMEOUT_MS = 20000;

async function connect() {
  const ws = new WebSocket(STUB_URL);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error('connect timeout')); }, 10000);
    ws.on('open', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
  return ws;
}

function sendRpc(ws, method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws, id, timeoutMs = TIMEOUT_MS) {
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

async function main() {
  console.log('=== AC-021 Verify-First Probe ===\n');
  console.log(`Connecting to stub at ws://127.0.0.1:${STUB_PORT}/v1/relay/connect`);

  const ws = await connect();
  console.log('Connected.\n');

  // ------------------------------------------------------------------
  // Test 1: Execute SELECT id, status FROM orders on order-pg
  // ------------------------------------------------------------------
  console.log('--- Test 1: Execute SELECT id, status FROM orders (order-pg) ---');
  const execId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT id, status FROM orders' },
  });
  const resp = await waitForResponse(ws, execId);
  console.log(`  Response JSON (truncated): ${JSON.stringify(resp).substring(0, 600)}`);

  let allPass = true;
  const failures = [];

  // 1. No error
  if (resp.error) {
    allPass = false;
    failures.push(`error present: ${JSON.stringify(resp.error)}`);
  } else {
    console.log('  PASS: No error in response');
  }

  // 2. jsonrpc is '2.0'
  if (resp.jsonrpc !== '2.0') {
    allPass = false;
    failures.push(`jsonrpc: expected '2.0', got '${resp.jsonrpc}'`);
  } else {
    console.log('  PASS: jsonrpc is "2.0"');
  }

  // 3. id echoed
  if (resp.id !== execId) {
    allPass = false;
    failures.push(`id: expected ${execId}, got ${resp.id}`);
  } else {
    console.log('  PASS: id echoed');
  }

  const r = resp.result;
  if (!r) {
    allPass = false;
    failures.push('result is missing');
  } else {
    // 4. rows is an array
    if (!Array.isArray(r.rows)) {
      allPass = false;
      failures.push(`rows: expected array, got ${typeof r.rows}`);
    } else {
      console.log(`  PASS: rows is an array with ${r.rows.length} entries`);
    }

    // 5. rowCount is a number
    if (typeof r.rowCount !== 'number') {
      allPass = false;
      failures.push(`rowCount: expected number, got ${typeof r.rowCount}`);
    } else {
      console.log(`  PASS: rowCount = ${r.rowCount}`);
    }

    // 6. fields is an array containing id and status
    if (!Array.isArray(r.fields)) {
      allPass = false;
      failures.push('fields: expected array');
    } else {
      const hasId = r.fields.some(f => f.name === 'id');
      const hasStatus = r.fields.some(f => f.name === 'status');
      if (!hasId || !hasStatus) {
        allPass = false;
        failures.push(`fields: missing id and/or status - ${JSON.stringify(r.fields)}`);
      } else {
        console.log('  PASS: fields contain id and status');
      }
    }

    // 7. executionTimeMs is a number >= 0
    if (typeof r.executionTimeMs !== 'number' || r.executionTimeMs < 0) {
      allPass = false;
      failures.push(`executionTimeMs: expected number >= 0, got ${r.executionTimeMs}`);
    } else {
      console.log(`  PASS: executionTimeMs = ${r.executionTimeMs}ms`);
    }

    // 8. masked is a boolean
    if (typeof r.masked !== 'boolean') {
      allPass = false;
      failures.push(`masked: expected boolean, got ${typeof r.masked}`);
    } else {
      console.log(`  PASS: masked = ${r.masked}`);
    }

    // 9. maskedFieldCount is a number
    if (typeof r.maskedFieldCount !== 'number') {
      allPass = false;
      failures.push(`maskedFieldCount: expected number, got ${typeof r.maskedFieldCount}`);
    } else {
      console.log(`  PASS: maskedFieldCount = ${r.maskedFieldCount}`);
    }

    // 10. masked === (maskedFieldCount > 0)
    if (r.masked !== (r.maskedFieldCount > 0)) {
      allPass = false;
      failures.push(`masked (${r.masked}) !== (maskedFieldCount > 0) (${r.maskedFieldCount > 0})`);
    } else {
      console.log('  PASS: masked === (maskedFieldCount > 0)');
    }
  }

  // ------------------------------------------------------------------
  // Test 2: Verify masking with PII data (CPF)
  // ------------------------------------------------------------------
  console.log('\n--- Test 2: Execute with PII (CPF in data) to verify masking ---');
  const maskId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: {
      sql: "SELECT '123.456.789-00' AS cpf, 'plain text' AS plain",
    },
  });
  const maskResp = await waitForResponse(ws, maskId);
  console.log(`  Response JSON (truncated): ${JSON.stringify(maskResp).substring(0, 600)}`);

  if (maskResp.error) {
    allPass = false;
    failures.push(`Masking test error: ${JSON.stringify(maskResp.error)}`);
  } else {
    const mr = maskResp.result;
    if (!mr) {
      allPass = false;
      failures.push('Masking test: result missing');
    } else {
      if (mr.masked !== true) {
        allPass = false;
        failures.push(`masked=true expected with PII, got ${mr.masked}`);
      } else {
        console.log('  PASS: masked=true when PII present');
      }

      if (typeof mr.maskedFieldCount !== 'number' || mr.maskedFieldCount <= 0) {
        allPass = false;
        failures.push(`maskedFieldCount > 0 expected with PII, got ${mr.maskedFieldCount}`);
      } else {
        console.log(`  PASS: maskedFieldCount = ${mr.maskedFieldCount} (> 0)`);
      }

      if (mr.rows && mr.rows[0]) {
        if (mr.rows[0].cpf !== '***.***.***-**') {
          allPass = false;
          failures.push(`CPF not masked: "${mr.rows[0].cpf}"`);
        } else {
          console.log('  PASS: CPF masked to "***.***.***-**"');
        }

        if (mr.rows[0].plain !== 'plain text') {
          allPass = false;
          failures.push(`plain text changed: "${mr.rows[0].plain}"`);
        } else {
          console.log('  PASS: plain text unchanged');
        }
      }
    }
  }

  ws.close();

  console.log('\n=== Summary ===');
  if (allPass) {
    console.log('AC-021: ALL CHECKS PASSED');
  } else {
    console.log('AC-021: FAILED');
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Probe error:', err);
  process.exit(1);
});
