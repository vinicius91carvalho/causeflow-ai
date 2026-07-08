// AC-039 black-box test: unknown resource rejection at policy engine.
//
// Exercises the relay's JSON-RPC 2.0 execute method at the WebSocket boundary:
//   1. Send an execute request with resourceId='unknown-resource'
//   2. Expect JSON-RPC -32600 error with reason "Unknown resource: unknown-resource"
//   3. Expect audit entry with result: 'denied' and policyChecks.reason
//
// Usage: npx tsx scripts/qa/ac039-test.mts
//
// Starts a local WS control-plane server on PORT, spawns the relay as a child
// process with a temp config, sends the execute request, validates the
// response and audit log, cleans up, and exits 0/1.
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';

const PORT = 5192;
const TOKEN = 'ac039-token';
const TENANT = 'ac039-tenant';

function log(...args: unknown[]) {
  console.error('[ac039-test]', ...args);
}

function sendRpc(ws: WebSocket, method: string, params: unknown): string {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws: WebSocket, id: string, timeoutMs = 10000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for response id=${id}`));
    }, timeoutMs);
    const onMessage = (raw: Buffer) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.jsonrpc === '2.0' && msg.id === id) {
        cleanup();
        resolve(msg);
      }
    };
    const onClose = () => { cleanup(); reject(new Error('socket closed')); };
    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage as (...args: unknown[]) => void);
      ws.off('close', onClose);
    }
    ws.on('message', onMessage);
    ws.on('close', onClose);
  });
}

async function main() {
  // --- write a temporary config YAML ---
  const configPath = path.resolve('relay-config.ac039-test.yaml');
  const configYaml = `controlPlane:
  url: ws://127.0.0.1:${PORT}/v1/relay/connect
  token: ${TOKEN}
  tenantId: ${TENANT}
resources:
  - id: test-pg
    type: postgres
    name: Test PostgreSQL
    connection:
      host: 127.0.0.1
      port: 5432
      database: relay
      user: relay
      password: relay
    allowedOperations:
      - query
    maxRowsPerQuery: 1000
masking:
  enabled: false
audit:
  enabled: true
  level: debug
`;
  fs.writeFileSync(configPath, configYaml, 'utf-8');

  // --- accumulate relay stdout (pino logs to stdout) ---
  const chunks: Buffer[] = [];

  // --- start the control-plane WS server ---
  let relayConn: WebSocket | null = null;
  let relayId = '';
  const relayConnected = new Promise<void>((resolve, reject) => {
    const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });
    wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token');
      const tenantId = url.searchParams.get('tenantId');
      if (token !== TOKEN || tenantId !== TENANT) {
        log(`rejecting wrong token=${token} tenantId=${tenantId}`);
        ws.close(4001, 'invalid token/tenant');
        return;
      }
      relayConn = ws;
      log('relay connected to stub');

      ws.on('message', (raw) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.type === 'resource_update') {
          relayId = String(msg.relayId ?? '');
          const n = Array.isArray(msg.resources) ? msg.resources.length : 0;
          log(`resource_update from relayId=${relayId} resources=${n}`);
          resolve();
        }
      });

      ws.on('close', () => { relayConn = null; });
      ws.on('error', (err) => log(`socket error: ${err.message}`));
    });
    wss.on('error', (err) => reject(err));
  });

  // --- start the relay ---
  const relayProc: ChildProcess = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RELAY_CONFIG_PATH: configPath,
      NODE_ENV: 'test',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  relayProc.stdout?.on('data', (d: Buffer) => {
    chunks.push(d);
    process.stdout.write('[relay:out] ' + d.toString());
  });
  relayProc.stderr?.on('data', (d: Buffer) => {
    process.stderr.write('[relay:err] ' + d.toString());
  });

  // --- wait for relay to connect ---
  let connected = false;
  try {
    await Promise.race([
      relayConnected,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for relay connection')), 15000)),
    ]);
    connected = true;
  } catch (err) {
    log('relay failed to connect:', err);
  }

  // --- short wait so the relay is settled after connect ---
  if (connected && relayConn) {
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!connected || !relayConn) {
    log('Relay never connected — marking test as FAIL');
    await cleanup(configPath, relayProc);
    log('VERDICT={"test_unknown_resource":false}');
    process.exit(1);
  }

  // --- TEST: execute with unknown resource ---
  log('--- Test: execute with resourceId=unknown-resource (expect -32600) ---');
  const testId = sendRpc(relayConn, 'execute', {
    resourceId: 'unknown-resource',
    operation: 'query',
    params: { sql: 'SELECT 1' },
  });
  const resp = await waitForResponse(relayConn, testId);
  log('Response:', JSON.stringify(resp));

  // Validate response
  const error = resp.error as Record<string, unknown> | undefined;
  const hasCorrectCode = error?.code === -32600;
  const hasReasonInMessage = typeof error?.message === 'string' && error.message.includes('Unknown resource: unknown-resource');
  const testResponseValid = hasCorrectCode && hasReasonInMessage;

  log(`Response code=${error?.code}, message=${error?.message}`);
  log(`hasCorrectCode=${hasCorrectCode}, hasReasonInMessage=${hasReasonInMessage}`);

  // Validate audit log from captured stdout.
  // Kill the relay first so all pending writes are flushed.
  await cleanup(configPath, relayProc);

  const fullStderr = Buffer.concat(chunks).toString('utf-8');
  log('Captured stderr length:', fullStderr.length);
  log('Last 500 chars:', fullStderr.slice(-500));

  const hasAuditDenied = fullStderr.includes('"result":"denied"');
  const hasPolicyReason = fullStderr.includes('"policyChecks"') && fullStderr.includes('Unknown resource: unknown-resource');
  const testAuditValid = hasAuditDenied && hasPolicyReason;

  log(`Audit result=denied: ${hasAuditDenied}, policyChecks.reason: ${hasPolicyReason}`);

  const allPass = testResponseValid && testAuditValid;
  log(`\n=== RESULTS ===`);
  log(`Test (unknown resource → -32600 with reason): ${testResponseValid ? 'PASS' : 'FAIL'}`);
  log(`Audit (result=denied, policyChecks.reason): ${testAuditValid ? 'PASS' : 'FAIL'}`);
  log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

  // --- already cleaned up above ---

  log('VERDICT={"test_unknown_resource":' + JSON.stringify(allPass) + '}');
  process.exit(allPass ? 0 : 1);
}

async function cleanup(configPath: string, relayProc: ChildProcess) {
  relayProc.kill('SIGTERM');
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        relayProc.kill('SIGKILL');
        resolve();
      }, 3000);
      relayProc.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch { /* ignore */ }
  // Wait for stdout pipe to flush all buffered data
  if (relayProc.stdout && !relayProc.stdout.readableEnded) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      relayProc.stdout!.on('end', () => { clearTimeout(timer); resolve(); });
      relayProc.stdout!.resume();
    });
  }
  try { fs.unlinkSync(configPath); } catch { /* ignore */ }
}

main().catch((err) => {
  console.error('[ac039-test] Fatal:', err);
  process.exit(1);
});
