// CauseFlow local control-plane stub.
//
// A minimal WebSocket server that speaks the same /v1/relay/connect JSON-RPC 2.0
// contract the real CauseFlow control plane does, so the relay can boot against
// it with zero paid/external SaaS credentials. Imports only `ws` and the Node
// stdlib — no AWS SDK, no Stripe, no @clerk/*, no @sentry/*, no other vendor SDK.
//
// Behavior:
//   - listens on 0.0.0.0:3000
//   - accepts the relay's WebSocket handshake on /v1/relay/connect
//   - validates the ?token=<RELAY_TOKEN>&tenantId=<TENANT_ID> query string
//   - on `resource_update` → logs `[stub] resource_update from relayId=<id> resources=<n>`
//   - on `heartbeat` → logs at debug
//   - when SMOKE=1, after the first resource_update it runs a one-shot
//     health_check + execute { SELECT 1 AS one } + execute { list_tables }
//     round-trip against the relay over the open socket and prints the results.
//   - Any client that connects with token/tenant and sends a JSON-RPC request
//     has that request forwarded to the relay; the relay's response is sent
//     back to that client. This lets external test tools drive the relay
//     through the stub.
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);
const EXPECTED_TOKEN = process.env.RELAY_TOKEN ?? 'harness-smoke-token';
const EXPECTED_TENANT = process.env.TENANT_ID ?? 'harness-tenant';
const RUN_SMOKE = (process.env.SMOKE ?? '0') === '1';

function log(msg, extra) {
  if (extra) console.log(`[stub] ${msg}`, extra);
  else console.log(`[stub] ${msg}`);
}

log(`listening on 0.0.0.0:${PORT} expect token=${EXPECTED_TOKEN} tenant=${EXPECTED_TENANT} smoke=${RUN_SMOKE}`);

const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });

// Track the relay WebSocket and pending RPC request routing.
let relayWs = null;
const pendingRpc = new Map();

async function forwardResponseToClient(raw) {
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (msg.jsonrpc === '2.0' && msg.id !== undefined) {
    const pending = pendingRpc.get(String(msg.id));
    if (pending && pending.ws.readyState === pending.ws.OPEN) {
      pending.ws.send(JSON.stringify(msg));
      pendingRpc.delete(String(msg.id));
    }
  }
}

function sendRpc(ws, method, params) {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

async function waitForResponse(ws, id, timeoutMs = 15000) {
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

async function runSmoke(ws, relayId) {
  let exitCode = 0;
  try {
    // Health check (AC-053): send health_check, assert response shape.
    // Allow individual drivers to be unhealthy (partial results still exit 0).
    const healthId = sendRpc(ws, 'health_check', {});
    const health = await waitForResponse(ws, healthId);
    log(`health_check result=${JSON.stringify(health.result)}`);

    if (health.error) {
      log(`smoke error: health_check returned error - ${JSON.stringify(health.error)}`);
      exitCode = 1;
    } else if (!health.result || !Array.isArray(health.result)) {
      log(`smoke error: health_check result is not an array`);
      exitCode = 1;
    } else if (health.result.length === 0) {
      log(`smoke error: health_check result is empty`);
      exitCode = 1;
    } else {
      for (const entry of health.result) {
        if (!entry.resourceId || !entry.type || typeof entry.healthy !== 'boolean' || typeof entry.latencyMs !== 'number') {
          log(`smoke error: health_check entry malformed - ${JSON.stringify(entry)}`);
          exitCode = 1;
        }
      }
    }

    // Execute SELECT 1 (AC-054) — assert response shape: rows has { one: 1 },
    // rowCount=1, fields includes name:'one' type:'int4', masked=false.
    const execId = sendRpc(ws, 'execute', {
      resourceId: 'order-pg',
      operation: 'query',
      params: { sql: 'SELECT 1 AS one' },
    });
    const exec = await waitForResponse(ws, execId);
    log(`execute(SELECT 1) result=${JSON.stringify(exec.result ?? exec.error)}`);
    if (exec.error) {
      log(`smoke error: execute(SELECT 1) returned error - ${JSON.stringify(exec.error)}`);
      exitCode = 1;
    } else if (!exec.result) {
      log(`smoke error: execute(SELECT 1) returned no result`);
      exitCode = 1;
    } else {
      const r = exec.result;
      if (!Array.isArray(r.rows) || r.rows.length !== 1 || r.rows[0].one !== 1) {
        log(`smoke error: execute(SELECT 1) rows mismatch - ${JSON.stringify(r.rows)}`);
        exitCode = 1;
      }
      if (r.rowCount !== 1) {
        log(`smoke error: execute(SELECT 1) rowCount=${r.rowCount} expected 1`);
        exitCode = 1;
      }
      const hasOneField = Array.isArray(r.fields) && r.fields.some(f => f.name === 'one' && f.type === 'int4');
      if (!hasOneField) {
        log(`smoke error: execute(SELECT 1) fields missing int4 'one' - ${JSON.stringify(r.fields)}`);
        exitCode = 1;
      }
      if (typeof r.executionTimeMs !== 'number') {
        log(`smoke error: execute(SELECT 1) executionTimeMs not a number - ${r.executionTimeMs}`);
        exitCode = 1;
      }
      if (r.masked !== false) {
        log(`smoke error: execute(SELECT 1) masked=${r.masked} expected false`);
        exitCode = 1;
      }
      if (r.maskedFieldCount !== 0) {
        log(`smoke error: execute(SELECT 1) maskedFieldCount=${r.maskedFieldCount} expected 0`);
        exitCode = 1;
      }
    }

    // Execute list_tables (AC-054) — assert result.rows contains an 'orders' row.
    const listId = sendRpc(ws, 'execute', {
      resourceId: 'order-pg',
      operation: 'list_tables',
      params: {},
    });
    const list = await waitForResponse(ws, listId);
    log(`execute(list_tables) result=${JSON.stringify(list.result ?? list.error)}`);
    if (list.error) {
      log(`smoke error: execute(list_tables) returned error - ${JSON.stringify(list.error)}`);
      exitCode = 1;
    } else if (!list.result || !Array.isArray(list.result.rows)) {
      log(`smoke error: execute(list_tables) rows not an array`);
      exitCode = 1;
    } else {
      const hasOrders = list.result.rows.some(row =>
        (row.table_name && row.table_name === 'orders') ||
        (row.name && row.name === 'orders')
      );
      if (!hasOrders) {
        log(`smoke error: execute(list_tables) rows do not contain 'orders' - ${JSON.stringify(list.result.rows)}`);
        exitCode = 1;
      }
    }
  } catch (err) {
    log(`smoke fatal: ${err.message}`);
    exitCode = 1;
  }

  log(`smoke exiting with code ${exitCode}`);
  process.exit(exitCode);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const tenantId = url.searchParams.get('tenantId');
  if (token !== EXPECTED_TOKEN || tenantId !== EXPECTED_TENANT) {
    log(`rejecting handshake token=${token} tenantId=${tenantId}`);
    ws.close(4001, 'invalid token/tenant');
    return;
  }

  log('client connected');

  let smokeStarted = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'resource_update') {
      // This connection is the relay — track it for RPC forwarding.
      relayWs = ws;
      // Forward JSON-RPC responses from the relay to the originating test client.
      relayWs.on('message', forwardResponseToClient);
      const n = Array.isArray(msg.resources) ? msg.resources.length : 0;
      log(`resource_update from relayId=${msg.relayId} resources=${n}`);
      if (RUN_SMOKE && !smokeStarted) {
        smokeStarted = true;
        runSmoke(ws, msg.relayId).catch((err) => {
          log(`smoke fatal: ${err.message}`);
          process.exit(1);
        });
      }
    } else if (msg.type === 'heartbeat') {
      log(`heartbeat from relayId=${msg.relayId} (debug)`);
    } else if (msg.jsonrpc === '2.0' && msg.id && msg.method) {
      if (!relayWs) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          error: { code: -32000, message: 'Relay not connected' },
        }));
        return;
      }
      if (relayWs === ws) {
        log('ignoring RPC from relay');
        return;
      }
      // Forward JSON-RPC request to the relay connection.
      const requestId = msg.id;
      pendingRpc.set(String(requestId), { ws, id: requestId });
      relayWs.send(JSON.stringify(msg));
    }
  });

  ws.on('close', () => {
    if (ws === relayWs) {
      log('relay disconnected');
      relayWs = null;
    } else {
      log('client disconnected');
    }
    // Clean up any pending RPCs from this client
    for (const [id, pending] of pendingRpc) {
      if (pending.ws === ws) pendingRpc.delete(id);
    }
  });
  ws.on('error', (err) => log(`socket error: ${err.message}`));
});

wss.on('error', (err) => log(`server error: ${err.message}`));

process.on('SIGTERM', () => { wss.close(() => process.exit(0)); });
process.on('SIGINT', () => { wss.close(() => process.exit(0)); });
