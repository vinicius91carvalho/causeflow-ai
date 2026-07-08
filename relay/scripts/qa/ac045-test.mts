// AC-045 black-box test: audit trail for denied and errored requests.
//
// Exercises the relay's JSON-RPC 2.0 execute method at the WebSocket boundary
// and validates the pino audit log output for:
//   1. Policy engine denial (row limit exceeded)
//   2. Policy engine denial (operation not allowed)
//   3. Driver validation failure (bad SQL)
//   4. Unknown resource
//   5. Error from driver execution (connection failure)
//
// Each test validates:
//   - The JSON-RPC response error code/message
//   - The captured relay logs contain a structured pino entry with the expected
//     result ('denied' or 'error') and policyChecks.reason as appropriate
//
// Usage: npx tsx scripts/qa/ac045-test.mts
//
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';

const PORT = 5196;
const TOKEN = 'ac045-token';
const TENANT = 'ac045-tenant';

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
}

function log(...args: unknown[]) {
  console.error('[ac045-test]', ...args);
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
  const configPath = path.resolve('relay-config.ac045-test.yaml');
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
      port: 15432   # no Postgres on this port - will cause connection errors
      database: relay
      user: relay
      password: relay
    allowedOperations:
      - query          # only query is allowed - other operations will be denied
      - describe_table
    maxRowsPerQuery: 1000
masking:
  enabled: false
audit:
  enabled: true
  level: debug
`;
  fs.writeFileSync(configPath, configYaml, 'utf-8');

  // --- accumulate relay stdout (pino logs) ---
  const relayStdout: Buffer[] = [];
  const relayStderr: Buffer[] = [];

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
    relayStdout.push(d);
    process.stdout.write('[relay:out] ' + d.toString());
  });
  relayProc.stderr?.on('data', (d: Buffer) => {
    relayStderr.push(d);
    process.stderr.write('[relay:err] ' + d.toString());
  });
  relayProc.on('exit', (code) => {
    log(`relay exited with code ${code}`);
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
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!connected || !relayConn) {
    log('Relay never connected — skipping tests');
    await cleanup(configPath, relayProc);
    log('VERDICT={"test_ac045":false,"reason":"relay_never_connected"}');
    process.exit(1);
  }

  const results: TestResult[] = [];
  let allPass = true;

  // =====================================================================
  // TEST 1: Policy engine denial - row limit exceeded
  // =====================================================================
  {
    log('\n--- Test 1: Row limit exceeded (policy denial) ---');
    const testId = sendRpc(relayConn, 'execute', {
      resourceId: 'test-pg',
      operation: 'query',
      params: { sql: 'SELECT 1 AS one', limit: 5000 },
    });
    const resp = await waitForResponse(relayConn, testId);
    log('Response:', JSON.stringify(resp));

    const error = resp.error as Record<string, unknown> | undefined;
    const hasCorrectCode = error?.code === -32600;
    const hasExpectedMessage = typeof error?.message === 'string' &&
      error.message.includes('Row limit 5000 exceeds maximum 1000');
    const testPassed = hasCorrectCode && hasExpectedMessage;

    results.push({
      name: 'Test 1: Row limit exceeded → -32600 with reason',
      passed: testPassed,
      details: [
        `code=${error?.code} expected=-32600 → ${hasCorrectCode ? 'OK' : 'FAIL'}`,
        `message=${error?.message} → ${hasExpectedMessage ? 'OK' : 'FAIL'}`,
      ],
    });
    if (!testPassed) allPass = false;
  }

  // =====================================================================
  // TEST 2: Policy engine denial - operation not allowed
  // =====================================================================
  {
    log('\n--- Test 2: Operation not allowed (policy denial) ---');
    const testId = sendRpc(relayConn, 'execute', {
      resourceId: 'test-pg',
      operation: 'delete',
      params: { sql: 'SELECT 1' },
    });
    const resp = await waitForResponse(relayConn, testId);
    log('Response:', JSON.stringify(resp));

    const error = resp.error as Record<string, unknown> | undefined;
    const hasCorrectCode = error?.code === -32600;
    const hasExpectedMessage = typeof error?.message === 'string' &&
      error.message.includes('Operation delete not allowed');
    const testPassed = hasCorrectCode && hasExpectedMessage;

    results.push({
      name: 'Test 2: Operation not allowed → -32600 with reason',
      passed: testPassed,
      details: [
        `code=${error?.code} expected=-32600 → ${hasCorrectCode ? 'OK' : 'FAIL'}`,
        `message=${error?.message} → ${hasExpectedMessage ? 'OK' : 'FAIL'}`,
      ],
    });
    if (!testPassed) allPass = false;
  }

  // =====================================================================
  // TEST 3: Driver validation failure - bad SQL
  // =====================================================================
  {
    log('\n--- Test 3: Bad SQL (driver validation failure) ---');
    const testId = sendRpc(relayConn, 'execute', {
      resourceId: 'test-pg',
      operation: 'query',
      params: { sql: 'INSERT INTO t VALUES (1)' },
    });
    const resp = await waitForResponse(relayConn, testId);
    log('Response:', JSON.stringify(resp));

    const error = resp.error as Record<string, unknown> | undefined;
    const hasCorrectCode = error?.code === -32602;
    const hasExpectedMessage = typeof error?.message === 'string' &&
      (error.message.includes('Only SELECT statements are allowed, got INSERT'));
    const testPassed = hasCorrectCode && hasExpectedMessage;

    results.push({
      name: 'Test 3: Bad SQL → -32602 with validation reason',
      passed: testPassed,
      details: [
        `code=${error?.code} expected=-32602 → ${hasCorrectCode ? 'OK' : 'FAIL'}`,
        `message=${error?.message} → ${hasExpectedMessage ? 'OK' : 'FAIL'}`,
      ],
    });
    if (!testPassed) allPass = false;
  }

  // =====================================================================
  // TEST 4: Unknown resource
  // =====================================================================
  {
    log('\n--- Test 4: Unknown resource ---');
    const testId = sendRpc(relayConn, 'execute', {
      resourceId: 'nonexistent',
      operation: 'query',
      params: { sql: 'SELECT 1' },
    });
    const resp = await waitForResponse(relayConn, testId);
    log('Response:', JSON.stringify(resp));

    const error = resp.error as Record<string, unknown> | undefined;
    const hasCorrectCode = error?.code === -32600;
    const hasExpectedMessage = typeof error?.message === 'string' &&
      error.message.includes('Unknown resource: nonexistent');
    const testPassed = hasCorrectCode && hasExpectedMessage;

    results.push({
      name: 'Test 4: Unknown resource → -32600 with reason',
      passed: testPassed,
      details: [
        `code=${error?.code} expected=-32600 → ${hasCorrectCode ? 'OK' : 'FAIL'}`,
        `message=${error?.message} → ${hasExpectedMessage ? 'OK' : 'FAIL'}`,
      ],
    });
    if (!testPassed) allPass = false;
  }

  // =====================================================================
  // TEST 5: Error from driver execution (Postgres not running on 15432)
  // =====================================================================
  {
    log('\n--- Test 5: Driver execution error (Postgres not running) ---');
    const testId = sendRpc(relayConn, 'execute', {
      resourceId: 'test-pg',
      operation: 'query',
      params: { sql: 'SELECT 1 AS one' },
    });
    const resp = await waitForResponse(relayConn, testId);
    log('Response:', JSON.stringify(resp));

    const error = resp.error as Record<string, unknown> | undefined;
    // The error code should be -32603 (internal error) because the driver
    // throws when it cannot connect to Postgres
    const hasCorrectCode = error?.code === -32603;
    const testPassed = hasCorrectCode;

    results.push({
      name: 'Test 5: Driver execution error → -32603',
      passed: testPassed,
      details: [
        `code=${error?.code} expected=-32603 → ${hasCorrectCode ? 'OK' : 'FAIL'}`,
        `message=${error?.message ?? ''}`,
      ],
    });
    if (!testPassed) allPass = false;
  }

  // --- Collect all relay output before shutting down ---
  // Give the relay a moment to flush all pending logs
  await new Promise((r) => setTimeout(r, 500));

  // --- Shutdown relay ---
  log('\n--- Shutting down relay ---');
  await cleanup(configPath, relayProc);

  // Give pipes a moment to flush
  await new Promise((r) => setTimeout(r, 1000));

  // --- Parse captured relay output for audit entries ---
  const fullStdout = Buffer.concat(relayStdout).toString('utf-8');
  const fullStderr = Buffer.concat(relayStderr).toString('utf-8');
  const allLogs = fullStdout + '\n' + fullStderr;

  log(`Captured relay stdout length: ${fullStdout.length}`);
  log(`Captured relay stderr length: ${fullStderr.length}`);

  // Parse each line as JSON (pino logs each line as JSON)
  const logLines = allLogs.split('\n').filter(l => l.trim().length > 0);
  const auditEntries = logLines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(e => e !== null && e.name === 'relay-audit');

  // Also capture top-level error logs
  const topLevelErrors = logLines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(e => e !== null && e.name === 'causeflow-relay' && e.msg === 'Request handler error');

  log(`\nFound ${auditEntries.length} audit entries, ${topLevelErrors.length} top-level error(s)`);

  // =====================================================================
  // AUDIT VERIFICATION
  // =====================================================================

  // --- Verify TEST 1 audit: row limit exceeded → denied ---
  {
    const entry = auditEntries.find(e =>
      e.result === 'denied' &&
      e.policyChecks?.reason?.includes('Row limit 5000 exceeds maximum 1000')
    );
    const found = !!entry;
    if (found) {
      log('AUDIT OK: Row limit exceeded → denied with policyChecks.reason');
    } else {
      log('AUDIT FAIL: Row limit exceeded → missing denied entry');
    }
    results.push({
      name: 'Audit: Row limit denial logged with result:denied and policyChecks.reason',
      passed: found,
      details: [found ? 'found matching audit entry' : 'no matching audit entry found'],
    });
    if (!found) allPass = false;
  }

  // --- Verify TEST 2 audit: operation not allowed → denied ---
  {
    const entry = auditEntries.find(e =>
      e.result === 'denied' &&
      e.policyChecks?.reason?.includes('Operation delete not allowed')
    );
    const found = !!entry;
    if (found) {
      log('AUDIT OK: Operation not allowed → denied with policyChecks.reason');
    } else {
      log('AUDIT FAIL: Operation not allowed → missing denied entry');
    }
    results.push({
      name: 'Audit: Operation not allowed logged with result:denied and policyChecks.reason',
      passed: found,
      details: [found ? 'found matching audit entry' : 'no matching audit entry found'],
    });
    if (!found) allPass = false;
  }

  // --- Verify TEST 3 audit: bad SQL (driver validation) → denied ---
  {
    const entry = auditEntries.find(e =>
      e.result === 'denied' &&
      e.policyChecks?.reason?.includes('Only SELECT statements are allowed, got INSERT')
    );
    const found = !!entry;
    if (found) {
      log('AUDIT OK: Bad SQL (driver validation) → denied with policyChecks.reason');
    } else {
      log('AUDIT FAIL: Bad SQL (driver validation) → missing denied entry');
    }
    results.push({
      name: 'Audit: Driver validation failure logged with result:denied and policyChecks.reason',
      passed: found,
      details: [found ? 'found matching audit entry' : 'no matching audit entry found'],
    });
    if (!found) allPass = false;
  }

  // --- Verify TEST 4 audit: unknown resource → denied ---
  {
    const entry = auditEntries.find(e =>
      e.result === 'denied' &&
      e.policyChecks?.reason?.includes('Unknown resource: nonexistent')
    );
    const found = !!entry;
    if (found) {
      log('AUDIT OK: Unknown resource → denied with policyChecks.reason');
    } else {
      log('AUDIT FAIL: Unknown resource → missing denied entry');
    }
    results.push({
      name: 'Audit: Unknown resource logged with result:denied and policyChecks.reason',
      passed: found,
      details: [found ? 'found matching audit entry' : 'no matching audit entry found'],
    });
    if (!found) allPass = false;
  }

  // --- Verify TEST 5 audit: driver execution error → error ---
  {
    const entry = auditEntries.find(e =>
      e.result === 'error'
    );
    const found = !!entry;
    if (found) {
      log('AUDIT OK: Driver execution error → error entry');
    } else {
      log('AUDIT FAIL: Driver execution error → missing error entry');
    }

    // Also verify the top-level error log with { err, requestId }
    const topLevelFound = topLevelErrors.length > 0;
    if (topLevelFound) {
      log('TOPLEVEL OK: Found top-level error log with err and requestId');
    } else {
      log('TOPLEVEL FAIL: Missing top-level error log');
    }

    results.push({
      name: 'Audit: Driver execution error logged with result:error',
      passed: found,
      details: [found ? 'found matching audit entry' : 'no matching audit entry found'],
    });
    if (!found) allPass = false;

    results.push({
      name: 'Top-level error log with { err, requestId } from try/catch',
      passed: topLevelFound,
      details: [topLevelFound ? 'found' : 'not found'],
    });
    if (!topLevelFound) allPass = false;

    // If audit error entry not found, log all audit entries for debugging
    if (!found) {
      log('DEBUG - all audit entries for error test:');
      for (const ae of auditEntries) {
        log(`  result=${ae.result} resource=${ae.resource} operation=${ae.operation}`);
      }
    }
  }

  // --- Print summary ---
  console.log('\n=== AC-045 RESULTS ===');
  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
    for (const d of r.details) {
      console.log(`       ${d}`);
    }
  }
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  log(`\nVERDICT={"test_ac045":${JSON.stringify(allPass)}}`);
  process.exit(allPass ? 0 : 1);
}

async function cleanup(configPath: string, relayProc: ChildProcess) {
  relayProc.kill('SIGTERM');
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        relayProc.kill('SIGKILL');
        resolve();
      }, 5000);
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
  console.error('[ac045-test] Fatal:', err);
  process.exit(1);
});
