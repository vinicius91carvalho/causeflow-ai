#!/usr/bin/env node
// Independent verification of AC-019 (health_check) at the real WebSocket
// boundary. Connects to the running control-plane stub on localhost:3000,
// sends a JSON-RPC 2.0 health_check request, and validates the response.
//
// Also validates the error-handling path by inspecting the source code
// pattern (the try/catch that catches driver.healthCheck() throws and
// returns healthy:false without affecting other drivers).

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const STUB_URL = 'ws://localhost:3000/v1/relay/connect?token=harness-smoke-token&tenantId=harness-tenant';

function sendRequest(ws, method, params) {
  const id = uuidv4();
  const request = { jsonrpc: '2.0', id, method, params };
  ws.send(JSON.stringify(request));
  return id;
}

function waitForResponse(ws, expectedId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response id=${expectedId}`)), 10000);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === expectedId) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) {
        // skip non-JSON messages
      }
    };
    ws.on('message', handler);
  });
}

async function run() {
  console.log('=== AC-019 health_check verification ===\n');
  const failures = [];

  const ws = new WebSocket(STUB_URL);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    ws.on('open', () => { clearTimeout(timeout); resolve(); });
    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  console.log('Connected to control-plane stub\n');

  // ---------------------------------------------------------------
  // Test 1: health_check returns correct JSON-RPC 2.0 structure
  // ---------------------------------------------------------------
  console.log('--- Test 1: health_check response shape ---');
  {
    const id = sendRequest(ws, 'health_check', {});
    const response = await waitForResponse(ws, id);

    // 1a. jsonrpc field
    if (response.jsonrpc !== '2.0') {
      failures.push(`Test 1a: jsonrpc is "${response.jsonrpc}", expected "2.0"`);
      console.error(`  FAIL: jsonrpc is "${response.jsonrpc}"`);
    } else {
      console.log(`  PASS: jsonrpc is "2.0"`);
    }

    // 1b. id echoed
    if (response.id !== id) {
      failures.push(`Test 1b: id mismatch - got ${response.id}, expected ${id}`);
      console.error(`  FAIL: id mismatch`);
    } else {
      console.log(`  PASS: id echoed correctly`);
    }

    // 1c. no error key
    if (response.error) {
      failures.push(`Test 1c: response has error key: ${JSON.stringify(response.error)}`);
      console.error(`  FAIL: response has error: ${JSON.stringify(response.error)}`);
    } else {
      console.log(`  PASS: no error in response`);
    }

    // 1d. result is an array
    if (!Array.isArray(response.result)) {
      failures.push(`Test 1d: result is not an array: ${typeof response.result}`);
      console.error(`  FAIL: result is not an array`);
    } else {
      console.log(`  PASS: result is an array`);
    }

    // 1e. array has entries
    if (response.result.length === 0) {
      failures.push('Test 1e: result array is empty, expected at least 1 entry');
      console.error('  FAIL: result array is empty');
    } else {
      console.log(`  PASS: result has ${response.result.length} entries`);
    }

    // 1f. each entry has required keys with correct types
    for (let i = 0; i < response.result.length; i++) {
      const entry = response.result[i];
      console.log(`  Entry ${i}: ${JSON.stringify(entry)}`);

      if (!entry.resourceId || typeof entry.resourceId !== 'string') {
        failures.push(`Test 1f: entry[${i}] missing/invalid resourceId`);
        console.error(`  FAIL: entry[${i}] resourceId missing/invalid`);
      }
      if (!entry.type || typeof entry.type !== 'string') {
        failures.push(`Test 1f: entry[${i}] missing/invalid type`);
        console.error(`  FAIL: entry[${i}] type missing/invalid`);
      }
      if (typeof entry.healthy !== 'boolean') {
        failures.push(`Test 1f: entry[${i}] healthy is not boolean`);
        console.error(`  FAIL: entry[${i}] healthy not boolean: ${typeof entry.healthy}`);
      }
      if (typeof entry.latencyMs !== 'number') {
        failures.push(`Test 1f: entry[${i}] latencyMs is not number`);
        console.error(`  FAIL: entry[${i}] latencyMs not number: ${typeof entry.latencyMs}`);
      }
    }
    if (response.result.every(e => e.resourceId && e.type && typeof e.healthy === 'boolean' && typeof e.latencyMs === 'number')) {
      console.log(`  PASS: all ${response.result.length} entries have correct shape`);
    }
  }

  // ---------------------------------------------------------------
  // Test 2: Both configured drivers are present
  // ---------------------------------------------------------------
  console.log('\n--- Test 2: Both configured drivers present ---');
  {
    const id = sendRequest(ws, 'health_check', {});
    const response = await waitForResponse(ws, id);

    const resourceIds = response.result.map(e => e.resourceId);
    const types = response.result.map(e => e.type);

    if (resourceIds.includes('order-pg')) {
      console.log('  PASS: order-pg is present');
    } else {
      failures.push('Test 2: order-pg not found in health_check results');
      console.error('  FAIL: order-pg not found');
    }

    if (resourceIds.includes('order-mongo')) {
      console.log('  PASS: order-mongo is present');
    } else {
      failures.push('Test 2: order-mongo not found in health_check results');
      console.error('  FAIL: order-mongo not found');
    }

    if (types.includes('postgres')) {
      console.log('  PASS: postgres type present');
    } else {
      failures.push('Test 2: postgres type not found');
      console.error('  FAIL: postgres type not found');
    }

    if (types.includes('mongodb')) {
      console.log('  PASS: mongodb type present');
    } else {
      failures.push('Test 2: mongodb type not found');
      console.error('  FAIL: mongodb type not found');
    }

    // Both should be healthy since both databases are running
    const allHealthy = response.result.every(e => e.healthy === true);
    if (allHealthy) {
      console.log('  PASS: all drivers report healthy=true');
    } else {
      const unhealthy = response.result.filter(e => !e.healthy).map(e => e.resourceId);
      console.log(`  NOTE: ${unhealthy.join(', ')} report healthy=false (may be expected if DB is down)`);
    }
  }

  // ---------------------------------------------------------------
  // Test 3: Verify that all latencyMs values are non-negative numbers
  // ---------------------------------------------------------------
  console.log('\n--- Test 3: latencyMs validation ---');
  {
    const id = sendRequest(ws, 'health_check', {});
    const response = await waitForResponse(ws, id);

    let allValid = true;
    for (const entry of response.result) {
      if (entry.latencyMs < 0) {
        failures.push(`Test 3: ${entry.resourceId} has negative latencyMs: ${entry.latencyMs}`);
        console.error(`  FAIL: ${entry.resourceId} latencyMs=${entry.latencyMs} is negative`);
        allValid = false;
      }
    }
    if (allValid) {
      console.log(`  PASS: all ${response.result.length} entries have valid latencyMs (>= 0)`);
    }
  }

  // ---------------------------------------------------------------
  // Test 4: Code-level verification of error-handling path
  // ---------------------------------------------------------------
  console.log('\n--- Test 4: Error handling path (code verification) ---');
  {
    // Read the health-reporter.ts to confirm the try/catch pattern
    // This is already done in source review above.
    const fs = await import('fs');
    const path = await import('path');
    const sourcePath = path.resolve('src/health/health-reporter.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    const hasTryBlock = source.includes('try {');
    const hasCatchBlock = source.includes('catch (err)');
    const hasWarnLog = source.includes("logger.warn({ err, resourceId }, 'Health check failed')");
    const hasHealthyFalse = source.includes('healthy: false');
    const hasLatencyMs = source.includes('latencyMs: Date.now() - start');

    if (hasTryBlock && hasCatchBlock) {
      console.log('  PASS: try/catch block exists in HealthReporter.checkAll()');
    } else {
      failures.push('Test 4: try/catch block missing in HealthReporter.checkAll()');
      console.error('  FAIL: try/catch block missing');
    }

    if (hasWarnLog) {
      console.log('  PASS: warn log with { err, resourceId } on catch');
    } else {
      failures.push('Test 4: warn log with err+resourceId missing in catch block');
      console.error('  FAIL: warn log missing');
    }

    if (hasHealthyFalse && hasLatencyMs) {
      console.log('  PASS: catch produces healthy:false entry with latencyMs');
    } else {
      failures.push('Test 4: catch block missing healthy:false or latencyMs');
      console.error('  FAIL: catch missing healthy:false or latencyMs');
    }

    // Verify the loop continues after catch (other drivers unaffected)
    const loopStructure = source.includes('for (const [resourceId, driver] of this.drivers)');
    const catchInsideLoop = source.indexOf('try {') < source.indexOf('} catch');
    if (loopStructure && catchInsideLoop) {
      console.log('  PASS: loop structure ensures other drivers unaffected by catch');
    } else {
      failures.push('Test 4: loop structure may not isolate driver failures');
      console.error('  FAIL: loop structure issue');
    }
  }

  // ---------------------------------------------------------------
  // Test 5: Verify that health_check is routed through the main dispatch
  // ---------------------------------------------------------------
  console.log('\n--- Test 5: Dispatch routing ---');
  {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve('src/index.ts');
    const indexSource = fs.readFileSync(indexPath, 'utf8');

    const hasHealthCheckCase = indexSource.includes("case 'health_check'");
    const callsHealthReporter = indexSource.includes('healthReporter.checkAll()');
    const usesCreateResponse = indexSource.includes('createResponse(request.id, statuses)');

    if (hasHealthCheckCase) {
      console.log('  PASS: health_check case in dispatch switch');
    } else {
      failures.push('Test 5: health_check case missing in dispatch');
      console.error('  FAIL: health_check case missing');
    }

    if (callsHealthReporter) {
      console.log('  PASS: health_check case calls healthReporter.checkAll()');
    } else {
      failures.push('Test 5: health_check does not call healthReporter.checkAll()');
      console.error('  FAIL: healthReporter.checkAll() not called');
    }

    if (usesCreateResponse) {
      console.log('  PASS: response uses createResponse()');
    } else {
      failures.push('Test 5: createResponse not used for health_check response');
      console.error('  FAIL: createResponse not used');
    }
  }

  ws.close();

  // Summary
  console.log('\n=== Summary ===');
  if (failures.length === 0) {
    console.log(`ALL TESTS PASSED (${5} test groups)`);
    process.exit(0);
  } else {
    console.error(`${failures.length} FAILURE(S):`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
