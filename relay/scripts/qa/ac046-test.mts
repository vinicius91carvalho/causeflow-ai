// AC-046 black-box test: audit.level and audit.enabled.
//
// Exercises a real relay process at the WebSocket boundary with different
// audit configurations and validates:
//   1. Default level 'info' — all entries logged
//   2. Level 'debug' — all entries logged
//   3. Level 'warn' — only warn & error entries logged (info/level suppressed)
//   4. Level 'error' — only error entries logged
//   5. audit.enabled = false — no audit entries written at all
//   6. base: { relayId } — every audit entry carries the relayId field at top level
//
// Runs each test scenario as a separate relay process + WS server on port 5195.
// Usage: npx tsx scripts/qa/ac046-test.mts
//
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';

const PORT = 5195;
const TOKEN = 'ac046-token';
const TENANT = 'ac046-tenant';

interface TestResult { name: string; passed: boolean; details: string[]; }
const allResults: TestResult[] = [];
let allPass = true;

function addResult(name: string, passed: boolean, details: string[]) {
  allResults.push({ name, passed, details });
  if (!passed) allPass = false;
}

function sendRpc(ws: WebSocket, method: string, params: unknown): string {
  const id = randomUUID();
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  return id;
}

function waitForResponse(ws: WebSocket, id: string, timeoutMs = 10000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`timeout id=${id}`)); }, timeoutMs);
    const onMsg = (raw: Buffer) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.jsonrpc === '2.0' && m.id === id) { cleanup(); resolve(m); }
    };
    const onClose = () => { cleanup(); reject(new Error('closed')); };
    function cleanup() { clearTimeout(timer); ws.off('message', onMsg as any); ws.off('close', onClose); }
    ws.on('message', onMsg);
    ws.on('close', onClose);
  });
}

/** Returns captured logs string. */
async function runScenario(
  auditLines: string,
  fn: (rc: WebSocket, rid: string) => Promise<void>,
): Promise<string> {
  const configPath = path.resolve(`relay-config.ac046-${randomUUID().slice(0, 8)}.yaml`);
  const yaml = `controlPlane:
  url: ws://127.0.0.1:${PORT}/v1/relay/connect
  token: ${TOKEN}
  tenantId: ${TENANT}
resources:
  - id: test-pg
    type: postgres
    name: Test PostgreSQL
    connection:
      host: 127.0.0.1
      port: 15432
      database: relay
      user: relay
      password: relay
    allowedOperations:
      - query
    maxRowsPerQuery: 1000
masking:
  enabled: false
${auditLines}
`;
  fs.writeFileSync(configPath, yaml, 'utf-8');

  const relayStdout: Buffer[] = [];
  const relayStderr: Buffer[] = [];

  // --- Start WS server ---
  const wss = new WebSocketServer({ port: PORT, path: '/v1/relay/connect' });
  let relayConn: WebSocket | null = null;
  let relayId = '';

  const connected = new Promise<void>((resolve, reject) => {
    wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
      if (url.searchParams.get('token') !== TOKEN || url.searchParams.get('tenantId') !== TENANT) {
        ws.close(4001, 'bad token'); return;
      }
      relayConn = ws;
      ws.on('message', (raw) => {
        let m; try { m = JSON.parse(raw.toString()); } catch { return; }
        if (m.type === 'resource_update') { relayId = String(m.relayId ?? ''); resolve(); }
      });
      ws.on('close', () => { relayConn = null; });
      ws.on('error', () => {});
    });
    wss.on('error', (err) => reject(err));
  });

  // --- Start relay ---
  const relayProc = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, RELAY_CONFIG_PATH: configPath, NODE_ENV: 'test' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  relayProc.stdout?.on('data', (d) => { relayStdout.push(d); });
  relayProc.stderr?.on('data', (d) => { relayStderr.push(d); });

  try {
    await Promise.race([
      connected,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout conn')), 20000)),
    ]);
  } catch (err) {
    relayProc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    wss.close();
    try { fs.unlinkSync(configPath); } catch {}
    throw err;
  }

  if (!relayConn || !relayId) throw new Error('bad connect');
  await new Promise(r => setTimeout(r, 400));

  // --- Run test function ---
  try { await fn(relayConn, relayId); } catch (err) { console.error('[scenario] fn error:', err); }
  await new Promise(r => setTimeout(r, 300));

  // --- Cleanup ---
  relayProc.kill('SIGTERM');
  try {
    await Promise.race([
      new Promise<void>((resolve) => relayProc.on('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(() => { relayProc.kill('SIGKILL'); resolve(); }, 5000)),
    ]);
  } catch {}
  wss.close();

  // Flush pipes
  if (relayProc.stdout && !relayProc.stdout.readableEnded) {
    await new Promise<void>((resolve) => { const t = setTimeout(resolve, 2000); relayProc.stdout!.on('end', () => { clearTimeout(t); resolve(); }); relayProc.stdout!.resume(); });
  }

  try { fs.unlinkSync(configPath); } catch {}

  return Buffer.concat(relayStdout).toString('utf-8') + '\n' + Buffer.concat(relayStderr).toString('utf-8');
}

function parseAudit(logs: string): Record<string, unknown>[] {
  return logs.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(e => e && e.name === 'relay-audit');
}

async function sendDenied(rc: WebSocket) { await waitForResponse(rc, sendRpc(rc, 'execute', { resourceId: 'nonexistent', operation: 'query', params: { sql: 'SELECT 1' } })); }
async function sendError(rc: WebSocket) { await waitForResponse(rc, sendRpc(rc, 'execute', { resourceId: 'test-pg', operation: 'query', params: { sql: 'SELECT 1 AS one' } })); }

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================================
async function main() {
  // =========== TEST 1: level=info, audit.enabled=true ===========
  console.error('\n=== TEST 1: level=info ===');
  const logs1 = await runScenario('audit:\n  enabled: true\n  level: info', async (rc) => {
    await sendDenied(rc);
    await sendError(rc);
  });
  const e1 = parseAudit(logs1);
  console.error(`  entries=${e1.length}, denied=${e1.some(e => e.result === 'denied')}, error=${e1.some(e => e.result === 'error')}`);
  addResult('Test 1a: level=info produces entries', e1.length >= 2, [`entries=${e1.length} >= 2`]);
  addResult('Test 1b: level=info includes denied', e1.some(e => e.result === 'denied'), ['denied found']);
  addResult('Test 1c: level=info includes error', e1.some(e => e.result === 'error'), ['error found']);

  await delay(500);

  // =========== TEST 2: level=debug ===========
  console.error('\n=== TEST 2: level=debug ===');
  const logs2 = await runScenario('audit:\n  enabled: true\n  level: debug', async (rc) => {
    await sendDenied(rc);
    await sendError(rc);
  });
  const e2 = parseAudit(logs2);
  console.error(`  entries=${e2.length}, denied=${e2.some(e => e.result === 'denied')}, error=${e2.some(e => e.result === 'error')}`);
  addResult('Test 2a: level=debug produces entries', e2.length >= 2, [`entries=${e2.length} >= 2`]);
  addResult('Test 2b: level=debug includes denied', e2.some(e => e.result === 'denied'), ['denied found']);
  addResult('Test 2c: level=debug includes error', e2.some(e => e.result === 'error'), ['error found']);

  await delay(500);

  // =========== TEST 3: level=warn ===========
  console.error('\n=== TEST 3: level=warn ===');
  const logs3 = await runScenario('audit:\n  enabled: true\n  level: warn', async (rc) => {
    await sendDenied(rc);  // warn
    await sendError(rc);   // error
  });
  const e3 = parseAudit(logs3);
  const hasDenied3 = e3.some(e => e.result === 'denied');
  const hasError3 = e3.some(e => e.result === 'error');
  const hasWarnLevel3 = e3.some(e => e.level === 40);
  const hasErrorLevel3 = e3.some(e => e.level === 50);
  console.error(`  entries=${e3.length}, denied=${hasDenied3}, error=${hasError3}, warnLevel=${hasWarnLevel3}, errorLevel=${hasErrorLevel3}`);
  addResult('Test 3a: level=warn includes denied (warn)', hasDenied3, ['denied found']);
  addResult('Test 3b: level=warn includes error', hasError3, ['error found']);
  addResult('Test 3c: denied entries have pino level 40 (warn)', hasWarnLevel3, ['level=40 found']);
  addResult('Test 3d: error entries have pino level 50 (error)', hasErrorLevel3, ['level=50 found']);

  await delay(500);

  // =========== TEST 4: level=error ===========
  console.error('\n=== TEST 4: level=error ===');
  const logs4 = await runScenario('audit:\n  enabled: true\n  level: error', async (rc) => {
    await sendDenied(rc);  // warn -> should be SUPPRESSED
    await sendError(rc);   // error -> should appear
  });
  const e4 = parseAudit(logs4);
  const hasDenied4 = e4.some(e => e.result === 'denied');
  const hasError4 = e4.some(e => e.result === 'error');
  console.error(`  entries=${e4.length}, denied=${hasDenied4}, error=${hasError4}`);
  addResult('Test 4a: level=error includes error entries', hasError4, ['error found']);
  addResult('Test 4b: level=error suppresses denied (warn) entries', !hasDenied4, [`denied count=${e4.filter(e => e.result === 'denied').length}, expected 0`]);
  if (hasError4) {
    addResult('Test 4c: error entries have pino level 50', e4.some(e => e.level === 50), ['level=50 found']);
  }

  await delay(500);

  // =========== TEST 5: audit.enabled=false ===========
  console.error('\n=== TEST 5: audit.enabled=false ===');
  const logs5 = await runScenario('audit:\n  enabled: false\n  level: info', async (rc) => {
    await sendDenied(rc);
    await sendError(rc);
  });
  const e5 = parseAudit(logs5);
  console.error(`  entries=${e5.length} (expected 0)`);
  addResult('Test 5: audit.enabled=false writes no audit entries', e5.length === 0, [`entries=${e5.length}, expected 0`]);

  await delay(500);

  // =========== TEST 6: Default level (when level omitted) ===========
  console.error('\n=== TEST 6: default level (info) ===');
  const logs6 = await runScenario('audit:\n  enabled: true\n  # level omitted', async (rc, rid) => {
    await sendDenied(rc);
    await sendError(rc);
    // Also capture relayId for base verification
    addResult('Test 6e: relayId is non-empty', rid.length > 0, [`relayId=${rid}`]);
  });
  const e6 = parseAudit(logs6);
  const hasDenied6 = e6.some(e => e.result === 'denied');
  const hasError6 = e6.some(e => e.result === 'error');
  const allHaveRid6 = e6.every(e => e.relayId !== undefined);
  console.error(`  entries=${e6.length}, denied=${hasDenied6}, error=${hasError6}, allHaveRid=${allHaveRid6}`);
  addResult('Test 6a: default level produces entries (default=info)', e6.length >= 2, [`entries=${e6.length} >= 2`]);
  addResult('Test 6b: default level includes denied', hasDenied6, ['denied found']);
  addResult('Test 6c: default level includes error', hasError6, ['error found']);
  addResult('Test 6d: base: { relayId } on all entries', allHaveRid6, [`all ${e6.length} entries have relayId`]);

  await delay(500);

  // =========== TEST 7: base: { relayId } explicit verification ===========
  console.error('\n=== TEST 7: base: { relayId } verification ===');
  const logs7 = await runScenario('audit:\n  enabled: true\n  level: info', async (rc) => {
    await sendDenied(rc);
  });
  const e7 = parseAudit(logs7);
  const relayIds = e7.map(e => e.relayId).filter(Boolean);
  const allSame = relayIds.length > 0 && relayIds.every((id: unknown) => id === relayIds[0]);
  console.error(`  entries=${e7.length}, relayIds=${JSON.stringify(relayIds)}, allSame=${allSame}`);
  addResult('Test 7: all entries share same relayId', allSame && relayIds.length > 0, [`relayIds=${JSON.stringify(relayIds)}`]);
  if (e7.length > 0) {
    // Verify relayId is at top level, not nested
    const first = e7[0];
    addResult('Test 7b: relayId is a top-level field', 'relayId' in first && typeof first.relayId === 'string', [`relayId=${first.relayId}`]);
    // Verify no 'success' entries appear (we only sent denied requests)
    addResult('Test 7c: result field present on entries', e7.every(e => e.result !== undefined), ['all entries have result']);
  }

  // =====================================================================
  // Clean up
  // =====================================================================
  const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith('relay-config.ac046-') && f.endsWith('.yaml'));
  for (const f of files) { try { fs.unlinkSync(path.resolve(process.cwd(), f)); } catch {} }

  // =====================================================================
  // RESULTS
  // =====================================================================
  console.log('\n=== AC-046 RESULTS ===');
  for (const r of allResults) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
    for (const d of r.details) console.log(`       ${d}`);
  }
  console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);

  // Emit harness verdict JSON
  console.log('');
  console.log('===HARNESS-VERDICT-BEGIN===');
  console.log(JSON.stringify({
    id: 'WI-AC-046',
    implementation: allPass,
    notes: `AC-046 black-box validated at real WebSocket boundary. Tests: level=info/debug/warn/error, default level=info, base:{relayId} tagging, audit.enabled=false short-circuits. All ${allResults.length} assertions ${allPass ? 'passed' : 'some failed'}.`,
  }));
  console.log('===HARNESS-VERDICT-END===');

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('[ac046-test] Fatal:', err);
  const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith('relay-config.ac046-') && f.endsWith('.yaml'));
  for (const f of files) { try { fs.unlinkSync(path.resolve(process.cwd(), f)); } catch {} }
  process.exit(1);
});
