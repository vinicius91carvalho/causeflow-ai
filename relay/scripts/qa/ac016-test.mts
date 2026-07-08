import { WebSocketServer, WebSocket } from 'ws';
import { WsClient } from '../../src/transport/ws-client.ts';

const received: any[] = [];

const server = new WebSocketServer({ port: 0 }, () => {
  const port = (server.address() as any).port;
  const url = `ws://127.0.0.1:${port}`;

  const client = new WsClient({
    url,
    token: 'tok',
    tenantId: 't1',
    onMessage: (req) => received.push(req),
  });

  let sendCount = 0;
  server.on('connection', (socket: WebSocket) => {
    socket.send('not-json{'); // invalid JSON -> warn + drop
    socket.send(Buffer.from('{"jsonrpc":"2.0","method":"health_check","id":"5"}')); // buffer, well-formed -> forward
    socket.send(JSON.stringify({ jsonrpc: '1.0', method: 'execute', id: '1' })); // wrong jsonrpc -> drop
    socket.send(JSON.stringify({ jsonrpc: '2.0', id: '2' })); // missing method -> drop
    socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'execute', id: '3' })); // well-formed -> forward
    socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'list_resources', id: '4', params: {} })); // forward
    sendCount = 6;
  });

  client.connect();

  setTimeout(() => {
    console.log('FORWARDED_COUNT=' + received.length);
    console.log('FORWARDED=' + JSON.stringify(received));
    const ids = received.map((r) => r.id).sort();
    const ok =
      received.length === 3 &&
      ids.join(',') === '3,4,5' &&
      received.every((r) => r.jsonrpc === '2.0' && typeof r.method === 'string');
    console.log('AC016_RESULT=' + (ok ? 'PASS' : 'FAIL'));
    client.close();
    server.close();
    process.exit(ok ? 0 : 1);
  }, 500);
});
