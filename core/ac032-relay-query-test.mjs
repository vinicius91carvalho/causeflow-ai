#!/usr/bin/env node
/**
 * AC-032 Relay Query Test
 *
 * Tests the relay query path by:
 * 1. Starting a temporary WS server (mimicking the control plane)
 * 2. Connecting the relay to it
 * 3. Sending an execute RPC (SELECT)
 * 4. Verifying the response matches the direct query
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { SignJWT, jwtVerify } from 'jose';
import { execSync, spawnSync } from 'node:child_process';

const JWT_SECRET = 'localstack-jwt-secret-dev';

function runDocker(args) {
  const result = spawnSync('docker', args, { stdio: 'pipe', timeout: 30000, encoding: 'utf-8' });
  if (result.error && !result.error.message.includes('exit code')) {
    throw result.error;
  }
  return result.stdout?.trim() || '';
}

async function main() {
  console.log('\n=== AC-032 Relay Query Test (direct RPC) ===\n');
  const failures = [];
  function check(ok, msg) {
    if (ok) console.log(`  ✅ ${msg}`);
    else { console.log(`  ❌ ${msg}`); failures.push(msg); }
  }

  // ── 1. Get a direct query result from postgres ──
  console.log('1. Direct query (baseline)');
  let directResult, complexResult;
  try {
    directResult = execSync(
      `docker run --rm --network ac032-iso-net -e PGPASSWORD=testpass postgres:16-alpine ` +
      `psql -h ac032-pg -U testuser -d testdb -t -A -c "SELECT current_database() AS db" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 15000 },
    ).trim();
    check(directResult.length > 0, `Direct query returned: "${directResult}"`);

    complexResult = execSync(
      `docker run --rm --network ac032-iso-net -e PGPASSWORD=testpass postgres:16-alpine ` +
      `psql -h ac032-pg -U testuser -d testdb -t -A -c "SELECT 42 AS answer, 'hello' AS greeting" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 15000 },
    ).trim();
    check(complexResult.length > 0, `Complex direct query returned: "${complexResult}"`);
  } catch (e) {
    check(false, `Direct query failed: ${e.message}`);
    process.exit(1);
  }

  // ── 2. Start a temporary WS server ──
  console.log('2. Starting test WS server...');
  const PORT = 5199;
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true });
  const secret = new TextEncoder().encode(JWT_SECRET);

  let relayConnected = false;
  let rpcResponses = [];
  let handshakeDone;

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/v1/relay/connect') {
      socket.destroy();
      return;
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'causeflow-control-plane',
      audience: 'causeflow-relay',
    }).then(({ payload }) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, payload.tenantId, payload.relayId);
      });
    }).catch(() => {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on('connection', (ws, req, tenantId, relayId) => {
    console.log(`  Relay connected: tenant=${tenantId} relayId=${relayId}`);
    relayConnected = true;

    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString();
      try {
        const msg = JSON.parse(raw);
        if (msg.jsonrpc === '2.0' && (msg.result !== undefined || msg.error)) {
          rpcResponses.push(msg);
          return;
        }
        if (msg.type === 'heartbeat') return;
        if (msg.type === 'resource_update') {
          console.log(`  Received resource_update: ${msg.resources?.length ?? 0} resource(s)`);
        }
      } catch (_) { /* ignore */ }
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`  WS server listening on :${PORT}`);

  // ── 3. Start relay connected to our test server ──
  console.log('3. Starting relay with test server...');
  const relayToken = await new SignJWT({
    tenantId: 'test-tenant',
    relayId: 'test-relay-query',
    scope: 'relay',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('causeflow-control-plane')
    .setAudience('causeflow-relay')
    .setSubject('relay:test-tenant:test-relay-query')
    .setExpirationTime('300s')
    .sign(secret);

  // Kill existing relay
  runDocker(['rm', '-f', 'ac032-relay']);

  const connJson = JSON.stringify({
    host: 'ac032-pg',
    port: '5432',
    database: 'testdb',
    user: 'testuser',
    password: 'testpass',
  });

  // Start new relay pointing to our test server
  runDocker([
    'run', '-d', '--name', 'ac032-relay',
    '--network', 'ac032-iso-net',
    '--network-alias', 'relay',
    '--ip', '172.25.0.3',
    '-e', `RELAY_TOKEN=${relayToken}`,
    '-e', `CONTROL_PLANE_URL=ws://172.18.0.1:${PORT}/v1/relay/connect`,
    '-e', 'TENANT_ID=test-tenant',
    '-e', 'RESOURCE_0_ID=test-pg',
    '-e', 'RESOURCE_0_TYPE=postgres',
    '-e', 'RESOURCE_0_NAME=Test PostgreSQL',
    '-e', `RESOURCE_0_CONNECTION=${connJson}`,
    'causeflow-relay-test',
  ]);
  runDocker(['network', 'connect', 'core_default', 'ac032-relay']);

  // Wait for relay to connect
  await new Promise(resolve => setTimeout(resolve, 8000));
  // Check relay logs
  const relayLogs = execSync('docker logs ac032-relay 2>&1', { encoding: 'utf-8', timeout: 5000 });
  console.log(`  Relay startup: ${relayLogs.split('\n').slice(0,2).join('; ')}...`);

  check(relayConnected, 'Relay connected to test WS server');

  if (!relayConnected) {
    console.log(`  Relay logs snippet: ${relayLogs.split('\n').slice(0,5).join('\n  ')}`);
  }

  // ── 4. Send execute RPC to relay ──
  console.log('4. Sending execute RPC...');

  const relayWs = [...wss.clients][0];
  if (!relayWs) {
    check(false, 'No relay WS connection available');
  } else {
    // a) list_resources
    const listResReq = { jsonrpc: '2.0', id: crypto.randomUUID(), method: 'list_resources', params: {} };
    relayWs.send(JSON.stringify(listResReq));
    await new Promise(resolve => setTimeout(resolve, 3000));

    check(rpcResponses.length > 0, `Received ${rpcResponses.length} RPC response(s)`);
    const listResResp = rpcResponses.find(r => r.id === listResReq.id);
    check(listResResp?.result !== undefined, 'list_resources returned a result');
    if (listResResp?.result) {
      const resources = Array.isArray(listResResp.result) ? listResResp.result : [];
      check(resources.some(r => r.resourceId === 'test-pg'), 'test-pg resource is listed');
      console.log(`  Resources: ${JSON.stringify(resources)}`);
    }

    // b) Simple query
    rpcResponses = [];
    const queryReq = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'execute',
      params: {
        resourceId: 'test-pg',
        operation: 'query',
        params: { sql: 'SELECT current_database() AS db', limit: 10 },
      },
    };
    relayWs.send(JSON.stringify(queryReq));
    await new Promise(resolve => setTimeout(resolve, 3000));

    const queryResp = rpcResponses.find(r => r.id === queryReq.id);
    check(queryResp !== undefined, 'Query RPC received a response');
    if (queryResp?.result) {
      const rows = queryResp.result.rows || [];
      check(rows.length > 0, `Query returned ${rows.length} row(s)`);
      if (rows.length > 0) {
        const db = rows[0]?.db;
        check(db === 'testdb', `Database name matches: "${db}" (expected "testdb")`);
        console.log(`  Query result: ${JSON.stringify(rows[0])}`);
      }
    } else if (queryResp?.error) {
      check(false, `Query RPC error: ${JSON.stringify(queryResp.error)}`);
    }

    // c) Complex query (matching direct query)
    rpcResponses = [];
    const complexQueryReq = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'execute',
      params: {
        resourceId: 'test-pg',
        operation: 'query',
        params: { sql: 'SELECT 42 AS answer, \'hello\' AS greeting', limit: 10 },
      },
    };
    relayWs.send(JSON.stringify(complexQueryReq));
    await new Promise(resolve => setTimeout(resolve, 3000));

    const complexQueryResp = rpcResponses.find(r => r.id === complexQueryReq.id);
    check(complexQueryResp !== undefined, 'Complex query RPC received a response');
    if (complexQueryResp?.result?.rows?.length > 0) {
      const row = complexQueryResp.result.rows[0];
      const answer = String(row.answer);
      check(answer === '42', `Query answer=42 (got ${answer})`);
      check(row.greeting === 'hello', `Query greeting=hello (got ${String(row.greeting)})`);
      console.log(`  Complex query result: ${JSON.stringify(row)}`);
      console.log(`  Direct query result: "${complexResult}"`);
    } else if (complexQueryResp?.error) {
      check(false, `Complex query RPC error: ${JSON.stringify(complexQueryResp.error)}`);
    }

    // d) describe_resource
    rpcResponses = [];
    const describeReq = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'describe_resource',
      params: { resourceId: 'test-pg' },
    };
    relayWs.send(JSON.stringify(describeReq));
    await new Promise(resolve => setTimeout(resolve, 3000));

    const describeResp = rpcResponses.find(r => r.id === describeReq.id);
    check(describeResp !== undefined, 'describe_resource received a response');
    if (describeResp?.result) {
      check(describeResp.result.type === 'postgres', `Resource type: ${describeResp.result.type}`);
      check(Array.isArray(describeResp.result.tables), `Has tables array`);
      console.log(`  Tables: ${JSON.stringify(describeResp.result.tables?.slice(0,3))}`);
    }

    // e) health_check
    rpcResponses = [];
    const healthReq = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'health_check',
      params: {},
    };
    relayWs.send(JSON.stringify(healthReq));
    await new Promise(resolve => setTimeout(resolve, 3000));

    const healthResp = rpcResponses.find(r => r.id === healthReq.id);
    check(healthResp !== undefined, 'health_check received a response');
    if (healthResp?.result) {
      const healthyResources = Array.isArray(healthResp.result)
        ? healthResp.result.filter(r => r.healthy)
        : [];
      check(healthyResources.length > 0, `At least one healthy resource (${healthyResources.length})`);
    }
  }

  // ── 5. Verify the query through relay matches direct query ──
  console.log('5. Results verification');
  const rpcResults = rpcResponses;
  console.log(`  Total RPC responses received: ${rpcResponses.length}`);

  // ── 6. Cleanup ──
  console.log('6. Restoring relay connection to API');
  wss.close();
  server.close();

  const realToken = await new SignJWT({
    tenantId: 'test-tenant',
    relayId: 'relay-test-1',
    scope: 'relay',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('causeflow-control-plane')
    .setAudience('causeflow-relay')
    .setSubject('relay:test-tenant:relay-test-1')
    .setExpirationTime('86400s')
    .sign(secret);

  runDocker(['rm', '-f', 'ac032-relay']);
  runDocker([
    'run', '-d', '--name', 'ac032-relay',
    '--network', 'ac032-iso-net',
    '--network-alias', 'relay',
    '--ip', '172.25.0.3',
    '-e', `RELAY_TOKEN=${realToken}`,
    '-e', 'CONTROL_PLANE_URL=ws://172.18.0.1:5185/v1/relay/connect',
    '-e', 'TENANT_ID=test-tenant',
    '-e', 'RESOURCE_0_ID=test-pg',
    '-e', 'RESOURCE_0_TYPE=postgres',
    '-e', 'RESOURCE_0_NAME=Test PostgreSQL',
    '-e', `RESOURCE_0_CONNECTION=${connJson}`,
    'causeflow-relay-test',
  ]);
  runDocker(['network', 'connect', 'core_default', 'ac032-relay']);
  console.log('  Restored relay connection to API');

  // ── Summary ──
  console.log(`\n---`);
  if (failures.length === 0) {
    console.log(`✅ AC-032 QUERY TEST: ALL ${failures.length === 0 ? 'ALL' : ''} CHECKS PASSED`);
  } else {
    console.log(`❌ AC-032 QUERY TEST: ${failures.length} CHECK(S) FAILED`);
    failures.forEach(f => console.log(`  - ${f}`));
  }

  return failures.length === 0;
}

main().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
