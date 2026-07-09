# QA Journal — WI-AC-036 / AC-036

**Date:** 2026-07-09
**Work Item:** WI-AC-036 (mongo-driver healthCheck + close + construction params)
**QA Agent:** harness qa-agent

## Tests performed

### Test 1: health_check RPC via WebSocket
- Sent JSON-RPC 2.0 `health_check` request to the relay through the running control-plane stub on port 5191
- **Expected:** order-mongo entry reports `healthy: true`
- **Observed:** `{ resourceId: "order-mongo", type: "mongodb", healthy: true, latencyMs: 1 }`
- **Result:** PASS — Mongo driver reports healthy=true via the real WebSocket boundary

### Test 2: Verify MongoDriver construction parameters
- Read `src/drivers/mongodb/mongo-driver.ts` and checked the `MongoClient` constructor options
- **Expected:** `maxPoolSize: 5` and `serverSelectionTimeoutMS: 10000`
- **Observed:** `new MongoClient(config.uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 })`
- **Result:** PASS — both parameters match the spec

### Test 3: Direct MongoClient healthCheck() and close()
- Connected to `mongodb://localhost:27017` (the running relay-mongo container), ran `db.admin().ping()`
- **Expected:** `ping()` succeeds with `{ ok: 1 }`, `client.close()` resolves without error, ping fails after close
- **Observed:** `ping()` returned `{ "ok": 1 }`, `close()` resolved cleanly, ping after close threw
- **Result:** PASS — `db.admin().ping()` works, `client.close()` works, post-close ping fails

### Test 4: healthCheck returns false on error (bad URI)
- Connected to unreachable host `mongodb://192.0.2.1:27017` with `serverSelectionTimeoutMS: 2000`
- **Expected:** ping throws / returns false, close() resolves or errors gracefully
- **Observed:** ping failed as expected, close() resolved on failed client
- **Result:** PASS — healthCheck correctly returns false on connection failure

## Source code verification

- `MongoDriver.healthCheck()` (lines 103-110): runs `await this.db.admin().ping()` inside try/catch, returns `true` / `false`
- `MongoDriver.close()` (lines 117-119): `await this.client.close()`
- Constructor (lines 19-21): `new MongoClient(config.uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 })`

## Independent QA Verification (2026-07-09)

### Test script: `tests/ac-036.spec.ts`
Used `npx tsx` to import the actual `MongoDriver` from `src/drivers/mongodb/mongo-driver.ts` and exercised against the live `relay-mongo` container on `mongodb://localhost:27017`.

### Test 5: Direct healthCheck() on MongoDriver
- Instantiated `MongoDriver` with `uri=mongodb://localhost:27017`, called `healthCheck()`
- **Expected:** `true`
- **Observed:** `true` (MongoDB ping succeeded)
- **Result:** PASS

### Test 6: healthCheck() returns false on unreachable host
- Instantiated `MongoDriver` with `uri=mongodb://localhost:27018` (nothing listening), called `healthCheck()`
- **Expected:** `false`
- **Observed:** `false` after serverSelectionTimeout
- **Result:** PASS

### Test 7: close() resolves without error
- Called `await driver.close()` on both drivers
- **Expected:** resolves cleanly
- **Observed:** no throw on either
- **Result:** PASS

### Test 8: Source code audit for construction params
- **Expected:** `maxPoolSize: 5`, `serverSelectionTimeoutMS: 10000`
- **Observed:** `new MongoClient(config.uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 })` (lines 23-25)
- **Observed:** `healthCheck()` runs `this.db.admin().ping()` (line 121)
- **Observed:** `close()` runs `await this.client.close()` (line 132)
- **Result:** PASS

## Verdict

- **qa:** true — all test groups pass (4 original + 4 independent)
- **implementation:** true — `src/drivers/mongodb/mongo-driver.ts` satisfies the full AC-036 contract
- **Defects:** none
