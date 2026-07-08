#!/usr/bin/env node
// Black-box test for AC-047: graceful shutdown on SIGTERM/SIGINT.
//
// Tests:
// 1. Sends SIGTERM to the relay container
// 2. Verifies the relay logs "Shutting down..." before exiting
// 3. Verifies the container exits with code 0
// 4. Verifies that a second SIGTERM cannot be delivered (process already gone)

import { execSync, spawn } from 'node:child_process';
import { once } from 'node:events';

const RELAY_CONTAINER = 'relay';
const COMPOSE_PROJECT = 'relay';

async function getContainerPid(containerName) {
  try {
    const pid = execSync(
      `docker inspect ${containerName} --format '{{.State.Pid}}'`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return pid;
  } catch {
    return null;
  }
}

async function getContainerStatus(containerName) {
  try {
    const status = execSync(
      `docker inspect ${containerName} --format '{{.State.Status}}'`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return status;
  } catch {
    return 'not-found';
  }
}

async function getContainerExitCode(containerName) {
  try {
    const exitCode = execSync(
      `docker inspect ${containerName} --format '{{.State.ExitCode}}'`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return parseInt(exitCode, 10);
  } catch {
    return -1;
  }
}

async function getRelayLogs(lines = 50) {
  try {
    return execSync(
      `docker compose -p ${COMPOSE_PROJECT} logs relay --tail ${lines} 2>&1`,
      { encoding: 'utf8', timeout: 10000 }
    );
  } catch {
    return '';
  }
}

async function waitForContainerToExit(containerName, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getContainerStatus(containerName);
    if (status === 'exited' || status === 'not-found') {
      return status;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return 'timeout';
}

async function main() {
  console.log('=== AC-047: Graceful Shutdown (SIGTERM) ===\n');

  // Step 0: Check relay is running
  const statusBefore = await getContainerStatus(RELAY_CONTAINER);
  console.log(`[STEP 0] Relay container status before: ${statusBefore}`);
  if (statusBefore !== 'running') {
    console.error('FAIL: Relay container is not running');
    process.exit(1);
  }

  // Capture logs from just before the SIGTERM
  const logsBefore = await getRelayLogs(100);
  if (!logsBefore.includes('Connected to control plane')) {
    console.error('FAIL: Relay did not connect to control plane before test');
    process.exit(1);
  }
  console.log('[STEP 0] Relay is connected to control plane - OK\n');

  // Step 1: Send SIGTERM to the relay container
  console.log('[STEP 1] Sending SIGTERM to relay container...');
  try {
    execSync(`docker compose -p ${COMPOSE_PROJECT} kill -s SIGTERM relay`, {
      encoding: 'utf8', timeout: 10000, stdio: 'pipe'
    });
    console.log('[STEP 1] SIGTERM sent - OK');
  } catch (err) {
    // The kill command might fail because the container stops
    if (err.message?.includes('exit code')) {
      console.log('[STEP 1] SIGTERM sent (container may have already exited)');
    } else {
      console.error(`FAIL: Could not send SIGTERM: ${err.message}`);
      process.exit(1);
    }
  }

  // Step 2: Wait for container to exit
  console.log('\n[STEP 2] Waiting for container to exit...');
  const exitStatus = await waitForContainerToExit(RELAY_CONTAINER, 15000);
  console.log(`[STEP 2] Container exit status: ${exitStatus}`);

  if (exitStatus === 'timeout') {
    console.error('FAIL: Container did not exit within timeout');
    process.exit(1);
  }

  const exitCode = await getContainerExitCode(RELAY_CONTAINER);
  console.log(`[STEP 2] Container exit code: ${exitCode}`);

  // Step 3: Verify exit code is 0
  console.log('\n[STEP 3] Verifying exit code is 0...');
  if (exitCode !== 0) {
    console.error(`FAIL: Expected exit code 0, got ${exitCode}`);
    process.exit(1);
  }
  console.log('[STEP 3] Exit code is 0 - OK\n');

  // Step 4: Check logs for shutdown sequence
  console.log('[STEP 4] Checking logs for shutdown sequence...');
  const logsAfter = await getRelayLogs(100);

  // The shutdown handler should log "Shutting down..."
  if (!logsAfter.includes('Shutting down...')) {
    console.error('FAIL: Expected "Shutting down..." in relay logs');
    console.error('--- relay logs ---');
    console.error(logsAfter);
    console.error('--- end ---');
    process.exit(1);
  }
  console.log('[STEP 4] "Shutting down..." found in logs - OK');

  // Now let's also test part 2: a second SIGTERM after the first completes
  // has no effect (the process is already gone). We just verify the container
  // is already in 'exited' state and sending another signal does nothing.
  console.log('\n[STEP 5] Verifying second SIGTERM has no effect (process already gone)...');
  const statusAfter = await getContainerStatus(RELAY_CONTAINER);
  console.log(`[STEP 5] Container status after first SIGTERM: ${statusAfter}`);
  if (statusAfter !== 'exited') {
    console.error(`FAIL: Expected container status 'exited', got '${statusAfter}'`);
    process.exit(1);
  }

  // Try sending another SIGTERM - should be harmless since process is gone
  try {
    execSync(`docker compose -p ${COMPOSE_PROJECT} kill -s SIGTERM relay 2>&1`, {
      encoding: 'utf8', timeout: 5000, stdio: 'pipe'
    });
  } catch {
    // Expected to fail since container is already stopped
  }

  const statusAfterSecond = await getContainerStatus(RELAY_CONTAINER);
  console.log(`[STEP 5] Container status after second SIGTERM: ${statusAfterSecond}`);
  if (statusAfterSecond !== 'exited') {
    console.error(`FAIL: Container should still be 'exited' after second SIGTERM, got '${statusAfterSecond}'`);
    process.exit(1);
  }
  console.log('[STEP 5] Second SIGTERM has no effect - OK\n');

  console.log('=== AC-047 PASSED ===');
  console.log(JSON.stringify({
    test: 'AC-047',
    passed: true,
    details: {
      shutdownMessage: true,
      exitCode: exitCode,
      secondSigtermHarmless: true,
    },
  }));
}

main().catch((err) => {
  console.error(`Test failed with error: ${err.message}`);
  process.exit(1);
});
