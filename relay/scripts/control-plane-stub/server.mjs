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
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);
const EXPECTED_TOKEN = process.env.RELAY_TOKEN ?? 'harness-smoke-token';
const EXPECTED_TENANT = process.env.TENANT_ID ?? 'harness-tenant';
const RUN_SMOKE = (process.env.SMOKE ?? '0') === '1';

function log(msg, extra) {
  // Plain stdout so `docker compose logs relay-control-plane-stub` is greppable.
  if (extra) console.log(`[stub] ${msg}`, extra);
  else console.log(`[stub] ${msg}`);
}

log(`listening on 0.0.0.0:${PORT} expect token=${EXPECTED_TOKEN} tenant=${EXPECTED_TENANT} smoke=${RUN_SMOKE}`);

const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });

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

    // Execute SELECT 1 (AC-054) — log-only, does not affect exit code.
    // When Postgres is running this succeeds; when Postgres is stopped (for
    // AC-053's partial-health scenario) it fails gracefully.
    const execId = sendRpc(ws, 'execute', {
      resourceId: 'order-pg',
      operation: 'query',
      params: { sql: 'SELECT 1 AS one' },
    });
    const exec = await waitForResponse(ws, execId);
    log(`execute(SELECT 1) result=${JSON.stringify(exec.result ?? exec.error)}`);

    // Execute list_tables (AC-054) — log-only, does not affect exit code.
    const listId = sendRpc(ws, 'execute', {
      resourceId: 'order-pg',
      operation: 'list_tables',
      params: {},
    });
    const list = await waitForResponse(ws, listId);
    log(`execute(list_tables) result=${JSON.stringify(list.result ?? list.error)}`);
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
  log('relay connected');

  let smokeStarted = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'resource_update') {
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
    } else if (msg.jsonrpc === '2.0' && msg.method) {
      // The relay only sends relay-initiated messages; JSON-RPC requests come
      // from the stub. If a stray JSON-RPC request arrives, ignore it.
    }
  });

  ws.on('close', () => log('relay disconnected'));
  ws.on('error', (err) => log(`socket error: ${err.message}`));
});

wss.on('error', (err) => log(`server error: ${err.message}`));

process.on('SIGTERM', () => { wss.close(() => process.exit(0)); });
process.on('SIGINT', () => { wss.close(() => process.exit(0)); });
