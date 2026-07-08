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
//   - Any client that connects with token/tenant and sends a JSON-RPC request
//     has that request forwarded to the relay; the relay's response is sent
//     back to that client. This lets external test tools drive the relay
//     through the stub.
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);
const EXPECTED_TOKEN = process.env.RELAY_TOKEN ?? 'harness-smoke-token';
const EXPECTED_TENANT = process.env.TENANT_ID ?? 'harness-tenant';

function log(msg, extra) {
  if (extra) console.log(`[stub] ${msg}`, extra);
  else console.log(`[stub] ${msg}`);
}

log(`listening on 0.0.0.0:${PORT} expect token=${EXPECTED_TOKEN} tenant=${EXPECTED_TENANT}`);

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
