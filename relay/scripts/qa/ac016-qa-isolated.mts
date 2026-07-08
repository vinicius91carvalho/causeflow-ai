import { WebSocketServer, WebSocket } from 'ws';
import { WsClient } from '../../src/transport/ws-client.ts';

const PORT = 5173;
const TOKEN = 'ac016-qa-token';
const TENANT = 'ac016-qa-tenant';

interface Forwarded { jsonrpc?: string; id?: string; method?: string; params?: unknown }

async function main() {
  const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });

  const forwarded: Forwarded[] = [];
  let serverSocket: WebSocket | null = null;
  let connectedUrl = '';
  const connectionPromise = new Promise<boolean>((resolve) => {
    wss.on('connection', (sock, req) => {
      connectedUrl = req.url || '';
      serverSocket = sock;
      const tokenOk = connectedUrl.includes(`token=${TOKEN}`);
      const tenantOk = connectedUrl.includes(`tenantId=${TENANT}`);
      resolve(tokenOk && tenantOk);
    });
  });

  const client = new WsClient({
    url: `ws://127.0.0.1:${PORT}/v1/relay/connect`,
    token: TOKEN,
    tenantId: TENANT,
    onMessage: (data) => { forwarded.push(data as Forwarded); },
  });

  client.connect();

  const connected = await Promise.race([
    connectionPromise,
    new Promise<boolean>((_, rej) => setTimeout(() => rej(new Error('timeout-connect')), 5000)),
  ]);

  const t0 = Date.now();
  while (!serverSocket && Date.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!serverSocket) throw new Error('no server socket');

  await new Promise((r) => setTimeout(r, 300));

  const send = (payload: string, asBuffer = false) => {
    if (!serverSocket) throw new Error('no socket');
    if (asBuffer) serverSocket.send(Buffer.from(payload));
    else serverSocket.send(payload);
  };

  const cases: { payload: string; buf?: boolean }[] = [
    { payload: '{ not valid json' },                                  // invalid JSON string -> warn+drop
    { payload: '{"jsonrpc":', buf: true },                            // invalid JSON buffer -> warn+drop
    { payload: '{"jsonrpc":"1.0","method":"foo","id":"x"}' },         // wrong jsonrpc -> drop
    { payload: '{"jsonrpc":"2.0","id":"4"}' },                        // missing method -> drop
    { payload: '{"jsonrpc":"2.0","id":"1","method":"list_resources","params":{}}' },      // valid string
    { payload: '{"jsonrpc":"2.0","id":"2","method":"health_check","params":{}}', buf: true }, // valid buffer
    { payload: '{"jsonrpc":"2.0","id":"3","method":"execute","params":{"resourceId":"r"}}' }, // valid
    { payload: '42' },                                                // valid JSON non-object -> drop
    { payload: '{}' },                                                // empty object -> drop
  ];

  for (const c of cases) {
    send(c.payload, c.buf);
    await new Promise((r) => setTimeout(r, 80));
  }

  await new Promise((r) => setTimeout(r, 400));

  client.close();
  wss.close();

  const forwardedIds = forwarded.map((f) => f.id);
  const allJsonrpc2 = forwarded.every((f) => f.jsonrpc === '2.0');
  const allHaveMethod = forwarded.every((f) => typeof f.method === 'string' && f.method.length > 0);

  const verdict = {
    connected,
    connectedUrl,
    forwardedCount: forwarded.length,
    forwardedIds,
    forwardedMethods: forwarded.map((f) => f.method),
    allJsonrpc2,
    allHaveMethod,
    exactlyThreeForwarded: forwarded.length === 3,
    forwardedIdsMatch: JSON.stringify(forwardedIds) === JSON.stringify(['1', '2', '3']),
  };

  // Verdict to stderr (fd 2) so pino stdout logs are separate.
  console.error('VERDICT=' + JSON.stringify(verdict));
  const pass = verdict.connected && verdict.exactlyThreeForwarded && verdict.allJsonrpc2 &&
    verdict.allHaveMethod && verdict.forwardedIdsMatch;
  console.error(pass ? 'AC016_RESULT=PASS' : 'AC016_RESULT=FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
