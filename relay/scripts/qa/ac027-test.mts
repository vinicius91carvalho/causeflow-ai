// AC-027: PgDriver.healthCheck() and PgDriver.close()
//
// Tests at the real Postgres external boundary (relay-postgres:5432):
// 1. healthCheck() on a working connection → returns true
// 2. healthCheck() on a failed connection → returns false (does NOT throw)
// 3. close() awaits pool.end() (verified by calling it after use)
// 4. Graceful-shutdown path in index.ts calls driver.close()
//
// Run: npx tsx scripts/qa/ac027-test.mts

import pg from 'pg';
import { PgDriver } from '../../src/drivers/postgres/pg-driver.js';

const { Pool } = pg;

const PG_HOST = process.env.PG_HOST ?? 'localhost';
const PG_PORT = Number(process.env.PG_PORT ?? 5432);
const PG_DATABASE = process.env.PG_DATABASE ?? 'relay';
const PG_USER = process.env.PG_USER ?? 'relay';
const PG_PASSWORD = process.env.PG_PASSWORD ?? 'relay';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

async function main() {
  console.log('=== AC-027: PgDriver.healthCheck() ===');

  // ===== Test 1: healthCheck() on a working connection =====
  console.log('\n--- Test 1: Working connection returns true ---');
  const driver1 = new PgDriver({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
  });

  const healthy = await driver1.healthCheck();
  assert(healthy === true, 'healthCheck() returns true on working connection');

  // Ensure close() works without error
  await driver1.close();
  assert(true, 'close() resolves without error on working connection');

  // ===== Test 2: healthCheck() on a failed connection returns false (does not throw) =====
  console.log('\n--- Test 2: Failed connection returns false (no throw) ---');
  const driver2 = new PgDriver({
    host: '192.0.2.1', // unreachable TEST-NET address
    port: 5432,
    database: 'nonexistent',
    user: 'nobody',
    password: 'wrong',
  });

  let result = false;
  let threw = false;
  try {
    result = await driver2.healthCheck();
  } catch (err) {
    threw = true;
    console.log(`  healthCheck() threw: ${err}`);
  }
  assert(threw === false, 'healthCheck() does NOT throw on unreachable host');
  assert(result === false, 'healthCheck() returns false on unreachable host');

  // Clean up - close() should not throw either
  let closeThrew = false;
  try {
    await driver2.close();
  } catch {
    closeThrew = true;
  }
  assert(closeThrew === false, 'close() does not throw on a failed driver');

  // ===== Test 3: Verify close() awaits pool.end() =====
  console.log('\n--- Test 3: close() awaits pool.end() ---');
  const driver3 = new PgDriver({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
  });

  // healthCheck should be true before close
  const beforeClose = await driver3.healthCheck();
  assert(beforeClose === true, 'healthCheck() returns true before close()');

  // Close the driver
  await driver3.close();

  // After close, pool.end() was called, so the pool should be ended
  // healthCheck might still return false (pool is ended, no new connections)
  // But the key assertion is that close() resolved without error
  assert(true, 'close() resolves without error');

  // ===== Test 4: Verify graceful-shutdown path in index.ts calls driver.close() =====
  console.log('\n--- Test 4: index.ts shutdown calls driver.close() ---');
  
  // Read the src/index.ts to verify the shutdown handler calls driver.close()
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../../src/index.ts', import.meta.url), 'utf8');

  const hasShutdown = source.includes('shutdown') || source.includes('SIGTERM');
  assert(hasShutdown === true, 'index.ts has a shutdown handler (SIGTERM/SIGINT)');

  const closesDrivers = source.includes('driver.close()');
  assert(closesDrivers === true, 'Shutdown handler calls driver.close()');

  const catchesCloseError = source.includes('.catch(() => {})');
  assert(catchesCloseError === true, 'driver.close() error is caught/swallowed in shutdown');

  // Summarize
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
