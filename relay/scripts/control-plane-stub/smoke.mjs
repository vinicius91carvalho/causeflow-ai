// CauseFlow Relay — one-shot smoke test script.
//
// Opens its own outbound WebSocket to the local control-plane stub (which the
// relay is already connected to), sends health_check + the two execute
// round-trips from AC-053 / AC-054, asserts the response shapes, and exits 0
// on success / non-zero on mismatch.
//
// Usage:
//   node smoke.mjs
//   RELAY_TOKEN=custom TOKEN_ID=custom STUB_URL=ws://... node smoke.mjs
//
// Dependencies: ws + Node stdlib only — zero vendor SDKs.
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const STUB_URL = process.env.STUB_URL || 'ws://localhost:3000/v1/relay/connect';
const TOKEN = process.env.RELAY_TOKEN || 'harness-smoke-token';
const TENANT_ID = process.env.TENANT_ID || 'harness-tenant';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

let exitCode = 0;

function log(msg, extra) {
  if (extra) console.log(`[smoke] ${msg}`, extra);
  else console.log(`[smoke] ${msg}`);
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
      'Authorization': `Bearer ${TOKEN}`,
      'X-Tenant-Id': TENANT_ID,
    },
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  log('connected');

  // ----------------------------------------------------------------
  // 1. health_check (AC-053)
  // ----------------------------------------------------------------
  // Retry up to MAX_RETRIES if the relay is not yet connected to the
  // stub (the stub returns code -32000 "Relay not connected").
  let health;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const healthId = sendRpc(ws, 'health_check', {});
    health = await waitForResponse(ws, healthId);

    if (health.error && health.error.code === -32000 && attempt < MAX_RETRIES) {
      log(`relay not connected yet, retrying (${attempt}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    break;
  }

  log(`health_check result=${JSON.stringify(health.result ?? health.error)}`);

  if (health.error) {
    log(`error: health_check returned error - ${JSON.stringify(health.error)}`);
    exitCode = 1;
  } else if (!health.result || !Array.isArray(health.result)) {
    log(`error: health_check result is not an array`);
    exitCode = 1;
  } else if (health.result.length === 0) {
    log(`error: health_check result is empty`);
    exitCode = 1;
  } else {
    for (const entry of health.result) {
      if (!entry.resourceId || !entry.type || typeof entry.healthy !== 'boolean' || typeof entry.latencyMs !== 'number') {
        log(`error: health_check entry malformed - ${JSON.stringify(entry)}`);
        exitCode = 1;
      }
    }
  }

  // ----------------------------------------------------------------
  // 2. execute SELECT 1 AS one (AC-054)
  // ----------------------------------------------------------------
  const execId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'query',
    params: { sql: 'SELECT 1 AS one' },
  });
  const exec = await waitForResponse(ws, execId);
  log(`execute(SELECT 1) result=${JSON.stringify(exec.result ?? exec.error)}`);

  if (exec.error) {
    log(`error: execute(SELECT 1) returned error - ${JSON.stringify(exec.error)}`);
    exitCode = 1;
  } else if (!exec.result) {
    log(`error: execute(SELECT 1) returned no result`);
    exitCode = 1;
  } else {
    const r = exec.result;
    if (!Array.isArray(r.rows) || r.rows.length !== 1 || r.rows[0].one !== 1) {
      log(`error: execute(SELECT 1) rows mismatch - ${JSON.stringify(r.rows)}`);
      exitCode = 1;
    }
    if (r.rowCount !== 1) {
      log(`error: execute(SELECT 1) rowCount=${r.rowCount} expected 1`);
      exitCode = 1;
    }
    const hasOneField = Array.isArray(r.fields) && r.fields.some((f) => f.name === 'one' && f.type === 'int4');
    if (!hasOneField) {
      log(`error: execute(SELECT 1) fields missing int4 'one' - ${JSON.stringify(r.fields)}`);
      exitCode = 1;
    }
    if (typeof r.executionTimeMs !== 'number') {
      log(`error: execute(SELECT 1) executionTimeMs not a number - ${r.executionTimeMs}`);
      exitCode = 1;
    }
    if (r.masked !== false) {
      log(`error: execute(SELECT 1) masked=${r.masked} expected false`);
      exitCode = 1;
    }
    if (r.maskedFieldCount !== 0) {
      log(`error: execute(SELECT 1) maskedFieldCount=${r.maskedFieldCount} expected 0`);
      exitCode = 1;
    }
  }

  // ----------------------------------------------------------------
  // 3. execute list_tables (AC-054) — assert rows contain 'orders'
  // ----------------------------------------------------------------
  const listId = sendRpc(ws, 'execute', {
    resourceId: 'order-pg',
    operation: 'list_tables',
    params: {},
  });
  const list = await waitForResponse(ws, listId);
  log(`execute(list_tables) result=${JSON.stringify(list.result ?? list.error)}`);

  if (list.error) {
    log(`error: execute(list_tables) returned error - ${JSON.stringify(list.error)}`);
    exitCode = 1;
  } else if (!list.result || !Array.isArray(list.result.rows)) {
    log(`error: execute(list_tables) rows not an array`);
    exitCode = 1;
  } else {
    const hasOrders = list.result.rows.some((row) =>
      (row.table_name && row.table_name === 'orders') ||
      (row.name && row.name === 'orders')
    );
    if (!hasOrders) {
      log(`error: execute(list_tables) rows do not contain 'orders' - ${JSON.stringify(list.result.rows)}`);
      exitCode = 1;
    }
  }

  ws.close();
  log(`exiting with code ${exitCode}`);
  process.exit(exitCode);
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
