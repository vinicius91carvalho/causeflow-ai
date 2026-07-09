// AC-017 black-box probe: drive the real relay over a real WebSocket.
// Stub control-plane listens on 127.0.0.1:PORT, accepts the relay handshake,
// then sends a JSON-RPC 2.0 `list_resources` request (no params) and validates
// the relay's response shape.
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PROBE_PORT ?? 5189);
const EXPECTED = {
  token: 'ac017-token',
  tenantId: 'ac017-tenant',
  resources: [
    { id: 'order-pg', type: 'postgres', name: 'Order Service PostgreSQL', database: 'orders' },
    { id: 'order-mongo', type: 'mongodb', name: 'Order Service MongoDB', database: 'orders' },
  ],
};

const verdict = {
  relayConnected: false,
  tokenOk: false,
  tenantOk: false,
  listResourcesSent: false,
  responseReceived: false,
  jsonrpcOk: false,
  idMatches: false,
  resultIsArray: false,
  resourceCountOk: false,
  allResourcesMapped: false,
  perResourceShapeOk: false,
  readOnlyOk: false,
  typeOk: false,
  databaseOk: false,
  nameOk: false,
  helperShapeOk: false,
  raw: null,
  resources: null,
  passed: false,
};

const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });

const expectedIds = EXPECTED.resources.map((r) => r.id).sort();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const tok = url.searchParams.get('token');
  const ten = url.searchParams.get('tenantId');
  verdict.relayConnected = true;
  verdict.tokenOk = tok === EXPECTED.token;
  verdict.tenantOk = ten === EXPECTED.tenantId;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    // Wait for the resource_update on connect, then send list_resources.
    if (msg.type === 'resource_update') {
      // Send a JSON-RPC list_resources request (no params).
      const req2 = { jsonrpc: '2.0', id: 'req-ac017-1', method: 'list_resources', params: {} };
      ws.send(JSON.stringify(req2));
      verdict.listResourcesSent = true;
      return;
    }
    // Treat anything with jsonrpc + id as a response.
    if (msg.jsonrpc === '2.0' && 'id' in msg) {
      verdict.responseReceived = true;
      verdict.raw = msg;
      verdict.jsonrpcOk = msg.jsonrpc === '2.0';
      verdict.idMatches = msg.id === 'req-ac017-1';
      const result = msg.result;
      verdict.resultIsArray = Array.isArray(result);
      if (Array.isArray(result)) {
        verdict.resources = result;
        const gotIds = result.map((r) => r.resourceId).sort();
        verdict.resourceCountOk = result.length === EXPECTED.resources.length;
        verdict.allResourcesMapped = JSON.stringify(gotIds) === JSON.stringify(expectedIds);
        verdict.perResourceShapeOk = result.every((r) => {
          const keys = Object.keys(r).sort();
          return JSON.stringify(keys) === JSON.stringify(['database', 'name', 'readOnly', 'resourceId', 'type']);
        });
        verdict.readOnlyOk = result.every((r) => r.readOnly === true);
        verdict.typeOk = result.every((r) => r.type === 'postgres' || r.type === 'mongodb');
        const expectedByName = Object.fromEntries(EXPECTED.resources.map((r) => [r.id, r]));
        verdict.databaseOk = result.every((r) => r.database === expectedByName[r.resourceId].database);
        verdict.nameOk = result.every((r) => r.name === expectedByName[r.resourceId].name);
      }
    }
  });
});

// Reproduce the helper output to confirm createResponse equivalence.
function createResponse(id, result) { return { jsonrpc: '2.0', id, result }; }
const helperResources = EXPECTED.resources.map((r) => ({
  resourceId: r.id, type: r.type, name: r.name, database: r.database, readOnly: true,
}));
const helperOut = createResponse('req-ac017-1', helperResources);
verdict.helperShapeOk = JSON.stringify(Object.keys(helperOut)) === JSON.stringify(['jsonrpc', 'id', 'result'])
  && Array.isArray(helperOut.result)
  && helperOut.result.every((r) => Object.keys(r).sort().join(',') === 'database,name,readOnly,resourceId,type');

setTimeout(() => {
  verdict.passed = verdict.relayConnected && verdict.tokenOk && verdict.tenantOk
    && verdict.listResourcesSent && verdict.responseReceived && verdict.jsonrpcOk
    && verdict.idMatches && verdict.resultIsArray && verdict.resourceCountOk
    && verdict.allResourcesMapped && verdict.perResourceShapeOk
    && verdict.readOnlyOk && verdict.typeOk && verdict.databaseOk && verdict.nameOk
    && verdict.helperShapeOk;
  console.log(JSON.stringify(verdict, null, 2));
  wss.close(() => process.exit(verdict.passed ? 0 : 1));
}, 4000);
