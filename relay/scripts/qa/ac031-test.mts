// QA test for AC-031: MongoDB list_tables operation.
//
// Connects to the running relay-mongo container (localhost:27017),
// seeds a test collection, exercises MongoDriver.execute({ operation: 'list_tables' }),
// and verifies the response shape matches { name, type }[].
//
// Usage: npx tsx scripts/qa/ac031-test.mts
// Returns JSON verdict on stdout.

import { MongoClient } from 'mongodb';
import { MongoDriver } from '../../src/drivers/mongodb/mongo-driver.js';
import { setTimeout as sleep } from 'node:timers/promises';

const MONGO_URI = 'mongodb://localhost:27017';
const DATABASE = 'relay';

async function main(): Promise<{ pass: boolean; details: string; data: any }> {
  // ---------------------------------------------------------------------------
  // 1. Seed a known collection so list_tables has something to return
  // ---------------------------------------------------------------------------
  const seedClient = new MongoClient(MONGO_URI);
  await seedClient.connect();
  const db = seedClient.db(DATABASE);

  const seededCollections = new Set<string>();

  // Create and seed ac031_customers
  await db.collection('ac031_customers').insertMany([
    { name: 'Alice', email: 'alice@test.com' },
    { name: 'Bob', email: 'bob@test.com' },
  ]);
  seededCollections.add('ac031_customers');

  // Create and seed ac031_orders
  await db.collection('ac031_orders').insertOne({ item: 'widget', qty: 5 });
  seededCollections.add('ac031_orders');

  // Give Mongo a moment to settle
  await sleep(500);

  // ---------------------------------------------------------------------------
  // 2. Test MongoDriver.list_tables
  // ---------------------------------------------------------------------------
  const driver = new MongoDriver({
    uri: MONGO_URI,
    database: DATABASE,
    maxRows: 1000,
  });

  let result;
  try {
    result = await driver.execute({ operation: 'list_tables', params: {} });
  } finally {
    // Clean up seeded collections
    for (const name of seededCollections) {
      try {
        await db.collection(name).drop();
      } catch {
        // Ignore drop failures during cleanup
      }
    }
    await driver.close();
    await seedClient.close();
  }

  // ---------------------------------------------------------------------------
  // 3. Verify the response shape
  // ---------------------------------------------------------------------------
  const checks: string[] = [];

  // Check rows is an array
  const hasRows = Array.isArray(result.rows);
  checks.push(`rows is array: ${hasRows}`);

  // Check every row has { name, type }
  const allHaveNameAndType = result.rows.every(
    (row: any) => typeof row.name === 'string' && typeof row.type === 'string',
  );
  checks.push(`all rows have name+type: ${allHaveNameAndType}`);

  // Check that rowCount matches rows.length
  const rowCountMatch = result.rowCount === result.rows.length;
  checks.push(`rowCount matches rows.length: ${rowCountMatch}`);

  // Check executionTimeMs is a positive number
  const hasExecutionTime = typeof result.executionTimeMs === 'number' && result.executionTimeMs >= 0;
  checks.push(`executionTimeMs is valid: ${hasExecutionTime}`);

  // Check that our seeded collections appear in the result
  const collectionNames = result.rows.map((r: any) => r.name);
  const seededFound = Array.from(seededCollections).every((name) => collectionNames.includes(name));
  checks.push(`seeded collections found in result: ${seededFound}`);

  // Check that system collections (like "ac031_customers") are also present - verifying
  // that listCollections().toArray() was actually called and returned the mapped result
  const allTypesAreCollection = result.rows.every((row: any) => row.type === 'collection');
  checks.push(`all returned types are 'collection': ${allTypesAreCollection}`);

  const pass = hasRows && allHaveNameAndType && rowCountMatch && hasExecutionTime && seededFound;
  const details = checks.join('; ');

  return {
    pass,
    details,
    data: {
      rowCount: result.rowCount,
      collectionNames,
      executionTimeMs: result.executionTimeMs,
      sampleRow: result.rows.length > 0 ? result.rows[0] : null,
    },
  };
}

main()
  .then((verdict) => {
    const output = {
      id: 'AC-031',
      qa: verdict.pass,
      implementation: true,
      defects: verdict.pass
        ? []
        : [`list_tables failed: ${verdict.details}. Data: ${JSON.stringify(verdict.data)}`],
    };
    console.log(JSON.stringify(output));
    process.exit(verdict.pass ? 0 : 1);
  })
  .catch((err) => {
    const output = {
      id: 'AC-031',
      qa: false,
      implementation: false,
      defects: [`Test script threw: ${err.message}. Stack: ${err.stack}`],
    };
    console.log(JSON.stringify(output));
    process.exit(1);
  });
