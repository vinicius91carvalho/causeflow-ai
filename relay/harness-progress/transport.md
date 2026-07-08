# transport workflow journal

## WI-AC-012 — Verify-first (transport)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

Boundary exercised at a real WebSocket boundary: a `ws` probe server on `127.0.0.1:5173` (`/v1/relay/connect`) plus the real `node dist/index.js` process built from `src/`. No mocks of the relay itself.

Setup:
- `npm install` → exit 0; `npx tsc --noEmit` → exit 0; `npm run build` → exit 0 (`dist/transport/ws-client.js`, `dist/transport/protocol.js` produced).
- `relay-config.yaml` with `controlPlane.url = ws://127.0.0.1:5173/v1/relay/connect`, `token=ac012-token`, `tenantId=ac012-tenant`, one bogus Postgres resource (driver init is lazy; the pool never connects within the test window — heartbeat is independent of resources).
- Probe server (`ws.WebSocketServer`) accepts the handshake, validates `?token=&tenantId=`, and records every inbound message for ~38s.

Observations:
- Relay logs `Connected to control plane` carrying `relayId` + `url`; probe records the relay connection with `token=ac012-token tenantId=ac012-tenant`.
- After the WebSocket opens, exactly one `heartbeat` arrives at the ~30s mark (within the 38s window). Probe verdict:
  `{"totalMessages":2,"heartbeatCount":1,"relayIds":["e0b74691-..."],"tenantIds":["ac012-tenant"],"shapeOk":true,"relayIdUuid":true,"sameRelayId":true,"tenantOk":true,"countOk":true,"passed":true}`
- The `resource_update` on connect was the other recorded message (out of AC-012 scope but confirms the open path).

AC-012 contract checks (all pass):
- `WsClient` sends a `heartbeat` while the WebSocket is open, on a 30s `setInterval` started in the `open` handler (`src/transport/ws-client.ts` `startHeartbeat`).
- `relayId` is a UUID generated once in the constructor (`private readonly relayId = uuidv4()`) and reused for every heartbeat — `sameRelayId=true`, `relayIdUuid=true`.
- `tenantId` matches the configured `controlPlane.tenantId` — `tenantOk=true`.
- Heartbeat is built via `createHeartbeat(this.relayId, this.opts.tenantId)` and serialized to exactly `{ type: 'heartbeat', relayId, tenantId }` — `shapeOk=true` (keys are exactly `relayId,tenantId,type`), matching `HeartbeatMessage`.

No root-cause fix required: the existing code already satisfies AC-012 at the real boundary.

## WI-AC-012 — QA audit (independent)

**Result: qa=true, implementation=true**

Independent audit on isolated worktree. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran a real `ws.WebSocketServer` on `127.0.0.1:5173` at `/v1/relay/connect`, instantiated the real `WsClient` (`dist/transport/ws-client.js`) with `token=tok-xyz`, `tenantId=tenant-abc-123`, and waited ~31.5s.

Evidence:
- `client.id` (constructor UUID) = `33089e22-7a9d-475d-8bc2-0bb4d3ec49df`.
- Server received exactly one inbound message within the window: `{"type":"heartbeat","relayId":"33089e22-7a9d-475d-8bc2-0bb4d3ec49df","tenantId":"tenant-abc-123"}` at the ~30s mark (30s `setInterval` started on `open`).
- `createHeartbeat(relayId, tenantId)` direct call serializes to `{ type: 'heartbeat', relayId, tenantId }` — matches `HeartbeatMessage`.
- Verified: heartbeat fires while WS open; relayId is a UUID generated once in the constructor and reused (heartbeat relayId === `client.id`); tenantId equals configured value; message shape and helper output match exactly.

No defects found.

### Out of scope

`resource_update` payload (AC-013), reconnect/backoff (AC-014), connect URL/headers (AC-015), and message parsing (AC-016) are separate work items. AC-012's boundary is the 30s heartbeat send path only.

## 2026-07-08T03:00Z — Integrated Verification (qa-agent on latest main)

**Result: integration=true, implementation=true, qa=true**

Integrated verification on latest main (`1c15b51`) at a real WebSocket boundary. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran a real `ws.WebSocketServer` on `127.0.0.1:5173` at `/v1/relay/connect`, instantiated the real `WsClient` (`dist/transport/ws-client.js`) with `token=ac012-qa-token`, `tenantId=ac012-qa-tenant`, and waited ~62s to capture two heartbeats.

Evidence (probe verdict JSON):
- `connected=true`; relay log `Connected to control plane` carrying `relayId` + `url`.
- `heartbeatCount=2`; `firstHeartbeatAtMs=30003`, `secondHeartbeatAtMs=60002`, `intervalMs=29999` → `intervalOk=true` (30s cadence confirmed by two beats within the 62s window).
- `relayIdFromClient=f9ffc6e0-...` is a UUID (`relayIdUuid=true`); `relayIdMatchesClient=true`; `sameRelayIdAcrossBeats=true` (same UUID reused for every beat).
- `tenantOk=true` (heartbeat `tenantId === ac012-qa-tenant`, the configured value).
- `shapeOk=true` — keys are exactly `relayId,tenantId,type`; `typeOk=true`.
- `createHeartbeat(relayId, tenantId)` direct call returns exactly `{ type:'heartbeat', relayId, tenantId }` (`helperShapeOk=true`, 3 keys) — matches `HeartbeatMessage`.
- Raw wire bytes: `{"type":"heartbeat","relayId":"f9ffc6e0-...","tenantId":"ac012-qa-tenant"}` (x2, identical relayId).

No defects found. AC-012 satisfied at the real boundary on integrated main.

## 2026-07-08T02:46:15.190Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T02:53:05.276Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-012
- AcceptanceChecks: AC-012
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-012-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-013 — Verify-first (transport)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

Boundary exercised at a real WebSocket boundary: a `ws.WebSocketServer` probe on `127.0.0.1:5173` (`/v1/relay/connect`) plus the real `node dist/index.js` process built from `src/`. No mocks of the relay itself.

Setup:
- `npm run build` → exit 0; `npx tsc --noEmit` → exit 0 (`dist/transport/ws-client.js`, `dist/transport/protocol.js` produced).
- `relay-config.yaml` with `controlPlane.url = ws://127.0.0.1:5173/v1/relay/connect`, `token=ac013-token`, `tenantId=ac013-tenant`, and two resources: `order-pg` (postgres) + `order-mongo` (mongodb). Driver init is lazy (`pg.Pool` / `MongoClient` constructors never connect), so no DB is needed to exercise the open-path resource_update send.
- Probe (`scripts/probe-ac013.mjs`) accepts the handshake, validates `?token=&tenantId=`, and records every inbound message for 8s.

Observations (probe verdict):
- `connections=1`; relay log `Config loaded` carrying `resources=2`, `tenantId=ac013-tenant`; probe records `connection token=ac013-token tenantId=ac013-tenant`.
- Exactly one inbound message in the window: `type=resource_update`, arriving immediately on WebSocket `open`.
- Verdict: `{"passed":true,"resourceUpdateCount":1,"shapeOk":true,"relayIdUuid":true,"tenantOk":true,"typeOk":true,"perResourceShapeOk":true,"readOnlyOk":true,"resourceCountOk":true,"allResourcesMapped":true,"helperShapeOk":true,"relayId":"5fe78b8d-...","resources":[{order-pg,postgres,Order Service PostgreSQL,orders,readOnly:true},{order-mongo,mongodb,Order Service MongoDB,orders,readOnly:true}]}`.

AC-013 contract checks (all pass):
- On WebSocket `open`, the relay sends a `resource_update` — `onConnect` callback in `src/index.ts` calls `wsClient.sendResourceUpdate(...)` and the `open` handler in `src/transport/ws-client.ts` invokes `this.opts.onConnect?.()` after `startHeartbeat()`.
- The message carries every resource from the loaded config (2/2 — `order-pg` + `order-mongo`) — `resourceCountOk=true`, `allResourcesMapped=true`.
- Each resource maps to `{ resourceId, type: 'postgres'|'mongodb', name, database, readOnly: true }` — `perResourceShapeOk=true` (keys exactly `database,name,readOnly,resourceId,type`), `readOnlyOk=true` (every entry `readOnly === true`), `typeOk=true` (types in `{postgres,mongodb}`).
- Constructed via `createResourceUpdate(relayId, tenantId, resources)` — `sendResourceUpdate` calls `createResourceUpdate(this.relayId, this.opts.tenantId, resources)`; `helperShapeOk=true` (rebuilding via the helper reproduces the exact wire bytes).
- Matches `ResourceUpdateMessage` — `shapeOk=true` (top-level keys exactly `relayId,resources,tenantId,type`), `relayIdUuid=true`, `tenantOk=true` (tenantId === configured `ac013-tenant`).

No root-cause fix required: the existing code already satisfies AC-013 at the real boundary.

## WI-AC-013 — Checkpoint

- Attempt: 1/3
- WorkItem: WI-AC-013
- Outcome: implementation=true (zero-diff)
- NextAction: Integrated Verification

## WI-AC-013 — QA audit (independent)

**Result: qa=true, implementation=true**

Independent audit on isolated worktree. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran a real `ws.WebSocketServer` on `127.0.0.1:5173` at `/v1/relay/connect` and the real `node dist/index.js` process with env-var fallback config (2 resources: `res-pg` postgres + `res-mg` mongodb; `TENANT_ID=tn-123`).

Evidence:
- On WebSocket `open`, the relay sent exactly one inbound message to the stub:
  `{"type":"resource_update","relayId":"b63e9ec4-...","tenantId":"tn-123","resources":[{"resourceId":"res-pg","type":"postgres","name":"main-pg","database":"maindb","readOnly":true},{"resourceId":"res-mg","type":"mongodb","name":"main-mg","database":"mainmg","readOnly":true}]}`
- Every configured resource is present (2/2), each mapped to `{ resourceId, type: 'postgres'|'mongodb', name, database, readOnly: true }`.
- Message is constructed via `createResourceUpdate(relayId, tenantId, resources)` (`src/transport/ws-client.ts` `sendResourceUpdate` → `this.send(createResourceUpdate(this.relayId, this.opts.tenantId, resources))`), invoked from the `onConnect` callback wired in `src/index.ts` on the WS `open` event.
- Shape matches `ResourceUpdateMessage` (`src/transport/protocol.ts`): `type`/`relayId`/`tenantId`/`resources[]` keys present with correct types; `readOnly` is `true` for every resource.
- Validation verdict from the probe: `PASS`.

No defects found.

## 2026-07-08T03:01:06.863Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-013
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T04:10Z — Integrated Verification (qa-agent on latest main)

**Result: integration=true, implementation=true, qa=true**

Integrated verification on latest main (`cc2b61b`) at a real WebSocket boundary. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran a real `ws.WebSocketServer` on `127.0.0.1:5173` at `/v1/relay/connect` and the real `node dist/index.js` process using the env-var fallback config (no YAML file — `RELAY_CONFIG_PATH=/nonexistent/...`), with two resources: `order-pg` (postgres) + `order-mongo` (mongodb). Driver init is lazy (`pg.Pool` / `MongoClient` constructors never connect), so no DB is required to exercise the open-path resource_update send. Probe captured inbound messages for 6s.

Evidence (probe verdict JSON, `/tmp/ac013-qa-verdict.json`):
- `connections=1`; relay stdout contains `Connected to control plane` (`relayStdoutHasConnected=true`).
- `totalMessages=1`, `resourceUpdateCount=1` — exactly one inbound message in the window, `type=resource_update`, arriving immediately on WebSocket `open`.
- `shapeOk=true` — top-level keys exactly `relayId,resources,tenantId,type` (matches `ResourceUpdateMessage`).
- `typeOk=true`; `relayIdOk=true` (`relayId=505aaa2c-ea43-49e7-8837-1c59947d2cdb`, UUID); `tenantOk=true` (tenantId === `ac013-qa-tenant`).
- `resourceCountOk=true` (2/2 resources); `allResourcesMapped=true` — every configured resource (`order-pg` postgres + `order-mongo` mongodb, with matching `name`/`database`) is present.
- `perResourceShapeOk=true` — each resource's keys exactly `database,name,readOnly,resourceId,type`; `readOnlyOk=true` (every entry `readOnly === true`); `typeValuesOk=true` (types in `{postgres,mongodb}`).
- Wire bytes: `{"type":"resource_update","relayId":"505aaa2c-...","tenantId":"ac013-qa-tenant","resources":[{"resourceId":"order-pg","type":"postgres","name":"Order Service PostgreSQL","database":"orders","readOnly":true},{"resourceId":"order-mongo","type":"mongodb","name":"Order Service MongoDB","database":"orders","readOnly":true}]}`.
- `createResourceUpdate(relayId, tenantId, resources)` direct call serializes to `{ type:'resource_update', relayId, tenantId, resources }` (keys exactly `relayId,resources,tenantId,type`) — matches `ResourceUpdateMessage`. The relay sends it via `WsClient.sendResourceUpdate` → `send(createResourceUpdate(this.relayId, this.opts.tenantId, resources))`, invoked from the `onConnect` callback wired in `src/index.ts` on the WS `open` event.

AC-013 contract satisfied at the real boundary on integrated main. No defects found.

## 2026-07-08T04:10Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-013
- AcceptanceChecks: AC-013
- Outcome: passed on integrated main
- Evidence: /tmp/ac013-qa-verdict.json
- NextAction: next Ready Work Item

## 2026-07-08T03:32:14.165Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-013
- AcceptanceChecks: AC-013
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-013-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-014 — Verify-first (transport)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

Boundary exercised at a real WebSocket boundary: a `ws.WebSocketServer` probe on `127.0.0.1:5173` (`/v1/relay/connect`) plus the real `WsClient` from `dist/transport/ws-client.js` (built from `src/`; `npx tsc --noEmit` → 0; `npm run build` → 0). No mocks of the relay.

Setup / observations:
- Test A (non-intentional close → reconnect via setTimeout): probe server accepts the relay handshake (conn #1 at +107ms). Probe force-closes the socket (code 4000). The `close` handler emits `Disconnected from control plane`, then `scheduleReconnect` logs `Scheduling reconnect delayMs=1000`. A second server connection lands at +1509ms (delta ≈1400ms ≈ the 1000ms timer + handshake) → `connect()` is invoked from the timer. Verdict: `testA_reconnectLanded=true`, `testA_reconnectDelta=1403`, `testA_reconnectAround1000=true`.
- Test A (intentional close → no reconnect): `clientA.close()` sets `intentionalClose=true` first, then closes the socket. After a 2500ms wait, server connection count is unchanged → `testA_noReconnectAfterIntentional=true`.
- Test B (doubling up to cap): point a second `WsClient` at a dead port (127.0.0.1:5999, nothing listening). Every `connect()` fails with ECONNREFUSED → `error` log → `close` → `scheduleReconnect`. Captured `delayMs` sequence from pino logs over ~93s: `1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000`. This proves doubling (1000→2000→4000→8000→16000), the clamp at `maxReconnectDelay = 30000` (16000*2=32000 → 30000), and the cap staying at 30000 on subsequent retries.

AC-014 contract checks (all pass):
- `src/transport/ws-client.ts`: `private reconnectDelay = 1000;` (starts at 1000ms); `private readonly maxReconnectDelay = 30000;`.
- `scheduleReconnect()` sets `reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay)` then `this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)` — i.e. the next `connect()` is invoked from the timer with the current delay, and the delay doubles up to 30000.
- The `close` handler calls `scheduleReconnect()` only `if (!this.intentionalClose)`.
- `close()` sets `this.intentionalClose = true` first, clears any pending `reconnectTimer`, then closes the socket — so an intentional close does not schedule a reconnect.

No root-cause fix required: the existing code already satisfies AC-014 at the real boundary.

## WI-AC-014 — QA audit (independent)

**Result: qa=true, implementation=true**

Independent audit on isolated worktree. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Drove the real `WsClient` (`dist/transport/ws-client.js`) against a real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`) and a dead port (`127.0.0.1:5999`) for the backoff sequence. No mocks of the relay.

Evidence:
- **Test A (non-intentional close → reconnect via setTimeout):** probe force-closed conn #1 (code 4000) at ~700ms. Pino logs: `Disconnected from control plane` then `Scheduling reconnect delayMs=1000`. Server saw conn #2 land ~1003ms after the close (close ts=1783482199316, reconnect-open ts=1783482200319, delta=1003ms) → the next `connect()` was invoked from the 1000ms `setTimeout` timer. `testA_opened=true`.
- **Test B (doubling from 1000 → cap 30000):** pointed a `WsClient` at dead port 5999 (ECONNREFUSED → `error` → `close` → `scheduleReconnect`). Captured `delayMs` sequence from pino logs over ~92s: `[1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]`. Confirms starting at 1000ms, doubling (1000→2000→4000→8000→16000), the clamp at `maxReconnectDelay = 30000` (16000*2=32000 → 30000), and the cap staying at 30000 on subsequent retries. `firstIs1000=true`, `doubles=true`, `reaches30000=true`, `staysAt30000=true`.
- **Test C (intentional close → no reconnect):** `client.close()` sets `intentionalClose=true` first, then closes the socket. After a 2600ms wait, `connect()` call count was unchanged (`callsBefore=1, callsAfter=1`) and the server saw no second connection → `intentionalNoReconnect=true`.
- Source checks (`src/transport/ws-client.ts`): `private reconnectDelay = 1000;` (starts at 1000ms); `private readonly maxReconnectDelay = 30000;`; `scheduleReconnect()` sets `reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay)` then `this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)`; the `close` handler calls `scheduleReconnect()` only `if (!this.intentionalClose)`; `close()` sets `this.intentionalClose = true` first, clears any pending `reconnectTimer`, then closes the socket.

No defects found. AC-014 satisfied at the real boundary.

## 2026-07-08T03:46:39.214Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T04:35Z — Integrated Verification (qa-agent on latest main)

**Result: integration=true, implementation=true, qa=true**

Integrated verification on latest main (`895503b`) at a real WebSocket boundary. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Drove the real `WsClient` (`dist/transport/ws-client.js`) against a real `ws.WebSocketServer` on `127.0.0.1:5173/5174` at `/v1/relay/connect` and a dead port `127.0.0.1:5999` (ECONNREFUSED → error → close → scheduleReconnect). No mocks of the relay.

Evidence (`/tmp/ac014-verdict.json`):
- **Test A (non-intentional close → reconnect via setTimeout):** probe force-closed conn #1 (code 4000). The `close` handler emitted `Disconnected from control plane` then `scheduleReconnect` logged `Scheduling reconnect delayMs=1000`. Server saw conn #2 land ~1005ms after the force-close → the next `connect()` was invoked from the 1000ms `setTimeout` timer. `reconnectLanded=true`, `reconnectDeltaMs=1005`, `reconnectAround1000=true`, `tokenOk=true`, `tenantOk=true`.
- **Test B (doubling from 1000 → cap 30000):** pointed a `WsClient` at dead port 5999 (ECONNREFUSED → `error` → `close` → `scheduleReconnect`). Intercepted `globalThis.setTimeout` to record reconnect-timer delays over ~70s: `[1000, 2000, 4000, 8000, 16000, 30000, 30000]`. Confirms starting at 1000ms, doubling (1000→2000→4000→8000→16000), the clamp at `maxReconnectDelay = 30000` (16000*2=32000 → 30000), and the cap staying at 30000 on subsequent retries. `firstIs1000=true`, `doubles=true`, `reaches30000=true`, `staysAt30000=true`.
- **Test C (intentional close → no reconnect):** `client.close()` sets `intentionalClose=true` first, then closes the socket. After a 2800ms wait (well past the would-be 1000ms reconnect timer), `connCount === 1` and the server saw no second connection → `intentionalNoReconnect=true`.
- Source checks (`src/transport/ws-client.ts`): `private reconnectDelay = 1000;` (starts at 1000ms); `private readonly maxReconnectDelay = 30000;`; `scheduleReconnect()` sets `reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay)` then `this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)`; the `close` handler calls `scheduleReconnect()` only `if (!this.intentionalClose)`; `close()` sets `this.intentionalClose = true` first, clears any pending `reconnectTimer`, then closes the socket.

AC-014 contract satisfied at the real boundary on integrated main. No defects found.

## 2026-07-08T04:35Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-014
- AcceptanceChecks: AC-014
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-014-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T04:00:11.263Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-014
- AcceptanceChecks: AC-014
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-014-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-016 — Verify-first (transport)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

WorkItem: WI-AC-016 — verify AC-016 (`message` event JSON parsing + JSON-RPC 2.0 forwarding) against the existing code at a real WebSocket boundary.

Boundary: real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`) + the real compiled `WsClient` (`dist/transport/ws-client.js`, built via `npx tsc --noEmit` → 0, `npm run build` → 0). No mocks of the relay. Pino logs captured from stdout (fd 1); verdict printed to stderr (fd 2).

Source checks (`src/transport/ws-client.ts` `message` handler):
```
this.ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(typeof data === 'string' ? data : data.toString());
    if (parsed.jsonrpc === '2.0' && parsed.method) {
      this.opts.onMessage(parsed as RpcRequest);
    }
  } catch (err) {
    logger.warn({ err }, 'Invalid message from control plane');
  }
});
```

Probe verdict (`/tmp/ac016-verdict.json` + `/tmp/ac016-stdout.log`):
- `tokenOk=true`, `tenantOk=true`, `relayOpen=true` (relay connected to probe server).
- Sent 9 inbound messages from the server to the relay:
  1. `{ not valid json` (invalid JSON, string) → dropped, warn.
  2. `{"jsonrpc":` (invalid JSON, buffer) → dropped, warn.
  3. `{"jsonrpc":"1.0","method":"foo"}` (jsonrpc !== '2.0') → dropped, no warn.
  4. `{"jsonrpc":"2.0","id":"x"}` (no method) → dropped, no warn.
  5. `{"jsonrpc":"2.0","id":"1","method":"list_resources","params":{}}` (string) → forwarded.
  6. `{"jsonrpc":"2.0","id":"2","method":"health_check","params":{}}` (buffer) → forwarded.
  7. `{"jsonrpc":"2.0","id":"3","method":"execute","params":{"resourceId":"r"}}` (string) → forwarded.
  8. `42` (valid JSON, non-object → jsonrpc undefined) → dropped, no warn.
  9. `{}` (empty object → no method) → dropped, no warn.
- `forwardedCount=3`, `exactlyThreeForwarded=true`; forwarded ids `1,2,3`; `forwardedAllJsonrpc2=true`; `forwardedAllHaveMethod=true`.
- Parse-failure warn lines (level 40) in stdout log: exactly 2 — both `msg="Invalid message from control plane"` with `err.type="SyntaxError"` and the parse-error message attached (cases 1 & 2). `warnCount=2`.

AC-016 contract checks (all pass):
- On `message`, `WsClient` JSON-parses the payload handling both string and buffer (`typeof data === 'string' ? data : data.toString()` → `JSON.parse`).
- Messages that fail to parse are logged at warn (`logger.warn({ err }, 'Invalid message from control plane')`, pino level 40) with the parse error (`err` = SyntaxError) and dropped (catch does not call `onMessage`).
- Messages where `parsed.jsonrpc !== '2.0'` (cases 3, 8) or `parsed.method` is missing (cases 4, 9) are dropped (the `if` guard fails; `onMessage` not called).
- Only well-formed JSON-RPC 2.0 requests (jsonrpc === '2.0' AND method present) are forwarded to `opts.onMessage` — exactly the 3 valid requests, in order, with their full parsed object.

No root-cause fix required: the existing code already satisfies AC-016 at the real boundary.

## WI-AC-015 — Verify-first (transport)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

WorkItem: WI-AC-015 — verify AC-015 (connect URL/headers + open/error/close logging) against the existing code at a real WebSocket boundary.

Boundary: real `ws.WebSocketServer` on `127.0.0.1:5173/v1/relay/connect` + a dead port `127.0.0.1:5999` (ECONNREFUSED → error → close). Drove the real compiled `WsClient` (`dist/transport/ws-client.js`, built via `npx tsc --noEmit` → 0, `npm run build` → 0). No mocks of the relay.

Source checks (`src/transport/ws-client.ts`):
- `connect()` parses `new URL(this.opts.url)`, calls `url.searchParams.set('token', …)` and `url.searchParams.set('tenantId', …)`, then `new WebSocket(url.toString(), { headers: { Authorization: 'Bearer <token>', 'X-Tenant-Id': <tenantId> } })`.
- `open` handler: `logger.info({ relayId: this.relayId, url: this.opts.url }, 'Connected to control plane')`.
- `error` handler: `logger.error({ err }, 'WS error')`.
- `close` handler: `logger.info('Disconnected from control plane')`, then `scheduleReconnect()` only `if (!this.intentionalClose)`.

Probe verdict (`/tmp/ac015-verdict.json`):
- URL query carries `token=ac015-token` ✓ and `tenantId=ac015-tenant` ✓ (server-side `req.url` = `/v1/relay/connect?token=ac015-token&tenantId=ac015-tenant`).
- Headers: `Authorization: Bearer ac015-token` ✓, `X-Tenant-Id: ac015-tenant` ✓.
- `open` log `Connected to control plane` (info, level 30) emitted with `relayId` + `url` ✓.
- `error` log emitted at level 50 on the dead-port ECONNREFUSED ✓.
- `close` log `Disconnected from control plane` (info, level 30) emitted ✓.
- Non-intentional close → `Scheduling reconnect` invoked (delayMs 1000 then 2000) ✓.
- Intentional close (`client.close()` after a successful open) → `Disconnected from control plane` with NO subsequent `Scheduling reconnect` ✓ (the next log lines were the dead-port client's, not a reconnect) — `intentionalClose` suppresses reconnect.

AC-015 contract satisfied at the real boundary on integrated main. No defects found. No code changes.

## WI-AC-015 — QA audit (independent)

**Result: qa=true, implementation=true**

Independent audit on isolated worktree. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Drove the real compiled `WsClient` (`dist/transport/ws-client.js`) against a real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`) plus a dead port `127.0.0.1:5999` (ECONNREFUSED). No mocks of the relay.

Evidence (`/tmp/ac015-qa-verdict.json` + error-path probe):
- **connect() URL query:** server-side `req.url` = `/v1/relay/connect?token=ac015-qa-token&tenantId=ac015-qa-tenant` → `urlHasToken=true`, `urlHasTenantId=true`. The query is built via `new URL(this.opts.url)` + `url.searchParams.set('token', …)` / `set('tenantId', …)` then `new WebSocket(url.toString(), …)`.
- **headers:** `Authorization: Bearer ac015-qa-token` ✓, `X-Tenant-Id: ac015-qa-tenant` ✓ (read from the inbound HTTP upgrade request).
- **open log (info):** `Connected to control plane` emitted at level 30 with `relayId` (UUID) and `url` attached (`openLogHasRelayId=true`, `openLogHasUrl=true`).
- **error log (error):** dead-port client emitted `WS error` at level 50 with `err` (`{code:'ECONNREFUSED', ...}`) attached — `errorLogEmitted=true`, `errorLogLevel=50`.
- **close log (info):** `Disconnected from control plane` emitted at level 30 on both intentional and non-intentional closes — `closeLogEmitted=true`, `closeLogLevel=30`.
- **non-intentional close → scheduleReconnect:** server force-closed connB (code 4000); `close` handler logged `Disconnected from control plane` then `Scheduling reconnect delayMs=1000`; a new connection landed ~1s later (`connCountAfterCloseB=2` → `connCountAfterReconnectWindowB=3`, `nonIntentionalReconnect=true`).
- **intentional close → no reconnect:** `clientA.close()` (sets `intentionalClose=true` first) at 1200ms; `connCountBeforeB=1` at 1900ms (no reconnect from A) → `intentionalNoReconnect=true`.

Source checks (`src/transport/ws-client.ts`): `connect()` builds the URL via `new URL(...)` + `searchParams.set('token'/'tenantId')` and passes `{ headers: { Authorization: 'Bearer <token>', 'X-Tenant-Id': <tenantId> } }` to `new WebSocket`; `open` → `logger.info({ relayId, url }, 'Connected to control plane')`; `error` → `logger.error({ err }, 'WS error')`; `close` → `logger.info('Disconnected from control plane')` then `scheduleReconnect()` only `if (!this.intentionalClose)`.

AC-015 contract satisfied at the real boundary. No defects found.

## 2026-07-08T05:10Z — QA audit passed (isolated)

- Attempt: 1/3
- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- Outcome: isolated QA passed (qa=true, implementation=true)
- Evidence: /tmp/ac015-qa-verdict.json + dead-port error-path probe
- NextAction: Integrated Verification

## 2026-07-08T04:09:50.816Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-015
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T05:30Z — Integrated Verification (qa-agent on latest main)

**Result: integration=true, implementation=true, qa=true**

Integrated verification on latest main at a real WebSocket boundary. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Drove the real compiled `WsClient` (`dist/transport/ws-client.js`) against a real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`) plus a dead port `127.0.0.1:5174` (ECONNREFUSED → error). No mocks of the relay.

Evidence (boundary probe on integrated main):
- **connect() URL query:** server-side `req.url` = `/v1/relay/connect?token=ac015-bearer-token&tenantId=ac015-tenant` → query carries both `token` and `tenantId`. Built via `new URL(this.opts.url)` + `url.searchParams.set('token', …)` / `set('tenantId', …)` then `new WebSocket(url.toString(), …)`.
- **headers:** `Authorization: Bearer ac015-bearer-token` ✓, `X-Tenant-Id: ac015-tenant` ✓ (read from the inbound HTTP upgrade request headers).
- **open log (info):** `Connected to control plane` emitted at pino level 30 with `relayId` (UUID `04bd3501-…`) and `url` (`ws://localhost:5173/v1/relay/connect`) attached.
- **error log (error):** dead-port client (`ws://localhost:5174/...`) emitted `WS error` at level 50 with `err` (`{code:'ECONNREFUSED', ...}`) attached — error-level log fires on the `error` event.
- **close log (info):** `Disconnected from control plane` emitted at level 30 on every close.
- **non-intentional close → scheduleReconnect:** probe force-closed the first two connections; `close` handler logged `Disconnected from control plane` then `Scheduling reconnect delayMs=1000`; a new connection landed ~1s later each time (`reconnectConnects=2`, `openCount=2`).
- **intentional close → no reconnect:** after a successful open, `client.close()` (sets `intentionalClose=true` first) was followed by a 1500ms wait during which no new server connection arrived → `intentionalCloseNoReconnect=true`.

Source checks (`src/transport/ws-client.ts`): `connect()` builds the URL via `new URL(...)` + `searchParams.set('token'/'tenantId')` and passes `{ headers: { Authorization: 'Bearer <token>', 'X-Tenant-Id': <tenantId> } }` to `new WebSocket`; `open` → `logger.info({ relayId, url }, 'Connected to control plane')`; `error` → `logger.error({ err }, 'WS error')`; `close` → `logger.info('Disconnected from control plane')` then `scheduleReconnect()` only `if (!this.intentionalClose)`.

AC-015 contract satisfied at the real boundary on integrated main. No defects found.

## 2026-07-08T05:30Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- Outcome: passed on integrated main
- NextAction: next Ready Work Item

## 2026-07-08T04:13:42.061Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-015-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T06:25Z — QA audit passed (isolated, WI-AC-016)

- Attempt: 1/3
- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- Outcome: isolated QA passed (qa=true, implementation=true)
- Boundary: real `ws.WebSocketServer` + real `WsClient` (tsx, src/transport/ws-client.ts). No mocks of the relay.
- Evidence: `scripts/qa/ac016-test.mts` — server pushes invalid JSON (string), valid JSON with wrong jsonrpc, valid JSON missing method, a well-formed JSON-RPC 2.0 request (string), and a well-formed request sent as a Buffer. Asserts exactly the well-formed requests are forwarded to `opts.onMessage`; invalid JSON logged at pino warn (level 40) with the SyntaxError attached and dropped; wrong-jsonrpc / missing-method dropped silently.
- Result: FORWARDED_COUNT=3 (ids 3,4,5), all with jsonrpc==='2.0' and a string method; one warn line `Invalid message from control plane` with `err.type=SyntaxError` for the bad-JSON case. `npx tsc --noEmit` → 0.
- Source: `src/transport/ws-client.ts` message handler — `JSON.parse(typeof data === 'string' ? data : data.toString())`; guard `if (parsed.jsonrpc === '2.0' && parsed.method)` then `onMessage`; `catch (err) { logger.warn({ err }, 'Invalid message from control plane') }`.
- NextAction: Integrated Verification

## 2026-07-08T04:23:18.630Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-016
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T04:54:26.296Z — Resumed

- WorkItem: WI-AC-016
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T04:54:26.319Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-016
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T05:23:12.394Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-016
- Outcome: integration could not complete
- Defects: error: Your local changes to the following files would be overwritten by merge:
	core/.env.example
	core/.env.localstack
	core/.gitignore
	core/INVARIANTS.md
	core/docker-compose.yml
	core/infra/localstack/init/01-create-resources.sh
	core/infra/scripts/check-invariants.ts
	core/packages/widget/vite.config.ts
	core/src/app.ts
	core/src/bootstrap.ts
	core/src/modules/auth/infra/auth.routes.ts
	core/src/shared/config/index.ts
	core/src/shared/infra/health/checks/anthropic-check.ts
	core/src/shared/infra/http/middleware/auth.middleware.ts
	core/src/shared/infra/http/middleware/tenant.middleware.ts
	core/tests/src/app.test.ts
	public-docs/.gitignore
	public-docs/.mintignore
	public-docs/README.md
	public-docs/docs.json
	public-docs/snippets/auth-header.mdx
	public-docs/snippets/rate-limit-note.mdx
	relay/.gitignore
	relay/package-lock.json
	relay/src/config/schema.ts
	relay/src/drivers/postgres/pg-query-parser.ts
	relay/src/index.ts
	web/apps/dashboard/package.json
	web/apps/dashboard/src/app/[locale]/accept-invitation/page.tsx
	web/apps/dashboard/src/app/[locale]/auth/sign-in/[[...sign-in]]/page.tsx
	web/apps/dashboard/src/app/[locale]/auth/sign-up/[[...sign-up]]/page.tsx
	web/apps/dashboard/src/app/[locale]/beta-waitlist/page.tsx
	web/apps/dashboard/src/app/[locale]/create-organization/[[...create-organization]]/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/[id]/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/new/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/intelligence/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/relay/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/settings/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/team/page.tsx
	web/apps/dashboard/src/app/[locale]/onboarding/business-profile/page.tsx
	web/apps/dashboard/src/app/[locale]/page.tsx
	web/apps/dashboard/src/app/[locale]/waitlist/[[...waitlist]]/page.tsx
	web/apps/dashboard/src/app/api/investigation/[id]/chat/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/detail/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/relay-token/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/tool-calls/[toolCallId]/route.ts
	web/apps/dashboard/src/contexts/identity/api/complete-profile-handler.test.ts
	web/apps/dashboard/src/contexts/identity/api/complete-profile-handler.ts
	web/apps/dashboard/src/contexts/identity/presentation/pages/beta-waitlist-page.tsx
	web/apps/dashboard/src/contexts/settings/presentation/pages/settings-page.tsx
	web/apps/dashboard/src/contexts/team/presentation/pages/team-page.tsx
	web/apps/website/src/contexts/marketing/infrastructure/i18n/en.json
	web/apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json
	web/apps/website/src/contexts/marketing/presentation/pages/home-page.tsx
	web/pnpm-lock.yaml
	web/vitest.config.ts
Please commit your changes or stash them before you merge.
error: The following untracked working tree files would be overwritten by merge:
	.harness/bootstrap.host
	.harness/bootstrap.log
	.harness/bootstrap.pid
	.harness/conclude-merge.log
	.harness/journal-conflict-resolve.log
	.harness/projects.json
	.pi/settings.json
	.turbo/cache/040f6817376e2598-meta.json
	.turbo/cache/040f6817376e2598.tar.zst
	.turbo/cache/0aaf10ddfb42531f-meta.json
	.turbo/cache/0aaf10ddfb42531f.tar.zst
	.turbo/cache/599716d50635a10a-meta.json
	.turbo/cache/599716d50635a10a.tar.zst
	.turbo/cache/a24a607d82d1451c-meta.json
	.turbo/cache/a24a607d82d1451c.tar.zst
	.turbo/cache/a613f0db8d08696b-meta.json
	.turbo/cache/a613f0db8d08696b.tar.zst
	.turbo/cache/afd2111fb699d535-meta.json
	.turbo/cache/afd2111fb699d535.tar.zst
	.turbo/cache/c34fb7eaabe6966e-meta.json
	.turbo/cache/c34fb7eaabe6966e.tar.zst
	.turbo/cache/dfb2fce1822ff665-meta.json
	.turbo/cache/dfb2fce1822ff665.tar.zst
	core/.harness-technology-inventory.json
	core/.harness/bootstrap.host
	core/.harness/planner-feature.pid
	core/harness-progress/foundation.md
	core/harness-progress/open-source-local-runtime.md
	core/init.sh
	core/project_specs.xml
	public-docs/.dockerignore
	public-docs/.harness-technology-inventory.json
	public-docs/Dockerfile
	public-docs/docker-compose.yml
	public-docs/feature_list.json
	public-docs/harness-progress/WI-AC-006-integration.md
	public-docs/harness-progress/content-structure.md
	public-docs/harness-progress/foundation.md
	public-docs/harness-progress/open-source-local-runtime.md
	public-docs/init.sh
	public-docs/project_specs.xml
	relay/.env.example
	relay/.harness-technology-inventory.json
	relay/.harness/bootstrap.host
	relay/.harness/bootstrap.log
	relay/.harness/bootstrap.pid
	relay/.harness/plan.done
	relay/.harness/plan.host
	relay/.harness/plan.log
	relay/.harness/plan.pid
	relay/docker-compose.yml
	relay/feature_list.json
	relay/harness-progress/foundation.md
	relay/harness-progress/open-source-local-runtime.md
	relay/harness-progress/transport.md
	relay/init.sh
	relay/project_specs.xml
	relay/relay-config.docker.yaml
	relay/scripts/control-plane-stub/Dockerfile
	relay/scripts/control-plane-stub/initdb/01-orders.sql
	relay/scripts/control-plane-stub/package.json
	relay/scripts/control-plane-stub/server.mjs
	web/.harness-technology-inventory.json
	web/.harness/bootstrap.host
	web/.harness/bootstrap.pid
	web/.harness/plan.done
	web/.harness/plan.host
	web/.harness/plan.pid
	web/apps/dashboard/src/contexts/identity/presentation/components/accept-invitation-client.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/accept-invitation-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/create-organization-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/sign-in-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/sign-up-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/waitlist-page.tsx
	web/apps/dashboard/src/contexts/integrations/presentation/pages/relay-page.tsx
	web/apps/dashboard/src/contexts/investigation/api/investigation-chat-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-detail-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-relay-token-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-tool-calls-handler.ts
	web/apps/dashboard/src/contexts/investigation/presentation/pages/analyses-page.tsx
	web/apps/dashboard/src/contexts/investigation/presentation/pages/analysis-detail-page.tsx
	web/apps/dashboard/src/contexts/investigation/presentation/pages/new-analysis-page.tsx
	web/apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-route-page.tsx
	web/apps/dashboard/src/contexts/shared/presentation/pages/intelligence-route-page.tsx
	web/apps/dashboard/src/contexts/shared/presentation/pages/root-page.tsx
	web/feature_list.json
	web/harness-progress/dashboard.md
	web/harness-progress/foundation.md
	web/harness-progress/testing.md
	web/harness-progress/testing_and_observability.md
	web/harness-progress/website.md
	web/init.sh
Aborting
Merge with strategy ort failed.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T12:03:40.298Z — Explicit Resume

- WorkItem: WI-AC-016
- Outcome: user authorized a new Attempt cycle
- Guidance: Retrying again after a supervisor restart (previous supervisor process was hung, unresponsive to stop signal, force-killed and restarted cleanly). Retry for a fresh attempt.
- NextAction: Coding Attempt 1

## 2026-07-08T12:10Z — Verify-first retry (supervisor restart)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

WorkItem: WI-AC-016 — fresh verify-first retry after supervisor restart. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran the real compiled `WsClient` against a real `ws.WebSocketServer` boundary (`scripts/qa/ac016-test.mts`, tsx). No mocks of the relay.

Evidence (stdout):
- `Connected to control plane` (level 30) on open.
- Invalid JSON string `not-json{` → pino warn (level 40) `Invalid message from control plane` with `err.type=SyntaxError` + parse-error message; dropped (not forwarded).
- Buffer payload `{"jsonrpc":"2.0","method":"health_check","id":"5"}` → forwarded (buffer path via `data.toString()`).
- `{jsonrpc:'1.0',...}` (wrong jsonrpc) → dropped silently.
- `{jsonrpc:'2.0',id:'2'}` (missing method) → dropped silently.
- Well-formed `execute` id=3 and `list_resources` id=4 → forwarded.
- `FORWARDED_COUNT=3`; ids `3,4,5`; all forwarded have `jsonrpc==='2.0'` and string `method`. `AC016_RESULT=PASS`, exit 0.

Source (`src/transport/ws-client.ts` message handler): `JSON.parse(typeof data === 'string' ? data : data.toString())`; guard `if (parsed.jsonrpc === '2.0' && parsed.method)` then `this.opts.onMessage(parsed as RpcRequest)`; `catch (err) { logger.warn({ err }, 'Invalid message from control plane') }`.

AC-016 contract satisfied at the real boundary. No root-cause fix required; existing code already passes. No code changes (zero-diff checkpoint).

## 2026-07-08T06:55Z — QA audit (isolated, WI-AC-016, independent re-run)

**Result: qa=true, implementation=true**

Independent isolated QA on worktree `gen/relay-transport`. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Drove the real `WsClient` (tsx, `src/transport/ws-client.ts`) against a real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`). No mocks of the relay.

Probe (`scripts/qa/ac016-qa-isolated.mts`) pushed 9 inbound server→relay messages and recorded forwards to `opts.onMessage` plus pino stdout logs:
1. `{ not valid json` (string) → dropped, pino warn level 40 `Invalid message from control plane` with `err.type=SyntaxError`.
2. `{"jsonrpc":` (Buffer) → dropped, pino warn level 40 with `err.type=SyntaxError` (`Unexpected end of JSON input`).
3. `{"jsonrpc":"1.0","method":"foo","id":"x"}` → dropped silently (jsonrpc !== '2.0').
4. `{"jsonrpc":"2.0","id":"4"}` → dropped silently (no method).
5. `{"jsonrpc":"2.0","id":"1","method":"list_resources","params":{}}` (string) → forwarded.
6. `{"jsonrpc":"2.0","id":"2","method":"health_check","params":{}}` (Buffer) → forwarded.
7. `{"jsonrpc":"2.0","id":"3","method":"execute","params":{"resourceId":"r"}}` (string) → forwarded.
8. `42` (valid JSON, non-object) → dropped silently (no jsonrpc/method).
9. `{}` (empty object) → dropped silently (no method).

Verdict (`/tmp/ac016-qa-stderr.log`): `connected=true`, `forwardedCount=3`, `forwardedIds=["1","2","3"]`, `forwardedMethods=["list_resources","health_check","execute"]`, `allJsonrpc2=true`, `allHaveMethod=true`, `exactlyThreeForwarded=true`, `forwardedIdsMatch=true`. `AC016_RESULT=PASS` (exit 0).
Warn audit (`/tmp/ac016-qa-stdout.log`): exactly 2 `level:40` lines, both `msg="Invalid message from control plane"`, both with `err.type="SyntaxError"` + parse-error message — only the two unparseable payloads (string + buffer) triggered a warn.

Source (`src/transport/ws-client.ts` message handler): `JSON.parse(typeof data === 'string' ? data : data.toString())`; guard `if (parsed.jsonrpc === '2.0' && parsed.method)` then `this.opts.onMessage(parsed as RpcRequest)`; `catch (err) { logger.warn({ err }, 'Invalid message from control plane') }`.

AC-016 contract satisfied at the real boundary. No defects found.

## 2026-07-08T12:09:08.837Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-016
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T12:15Z — Integrated Verification (qa-agent on latest main)

**Result: integration=true, implementation=true, qa=true**

Integrated verification on latest main (`4376b43`) at a real WebSocket boundary. Built `dist/` (`npx tsc --noEmit` → 0; `npm run build` → 0). Ran a real `ws.WebSocketServer` on `127.0.0.1:5173` (`/v1/relay/connect`) and the real compiled `WsClient` (`dist/transport/ws-client.js`) with `token=tok`, `tenantId=tenant-1`. No mocks of the relay.

Evidence (probe, removed after run): server pushed 9 inbound server→relay payloads and recorded `opts.onMessage` forwards:
1. `{not json` (invalid JSON, string) → dropped; pino warn (level 40) `Invalid message from control plane` with `err.type=SyntaxError`.
2. `{"jsonrpc":"1.0",...}` (wrong jsonrpc) → dropped silently.
3. `{"jsonrpc":"2.0","id":"3",...}` (missing method) → dropped silently.
4. `{"jsonrpc":"2.0","id":"4","method":"",...}` (empty method) → dropped silently.
5. `{"jsonrpc":"2.0","id":"1","method":"execute",...}` (string) → forwarded.
6. `{"jsonrpc":"2.0","id":"5","method":"health_check",...}` (string) → forwarded.
7. `[1,2,3]` (JSON array) → dropped silently.
8. `42` (JSON number) → dropped silently.
9. Buffer of `{"jsonrpc":"2.0","id":"6","method":"list_resources",...}` → forwarded.

Verdict: `onMessageCalls=[id 1, id 5, id 6]`, exactly 3 forwards, all with `jsonrpc==='2.0'` and a string `method`; the single unparseable payload emitted one warn line with the SyntaxError attached. `DEFECTS=[]`, probe exit 0.

Source (`src/transport/ws-client.ts` message handler): `JSON.parse(typeof data === 'string' ? data : data.toString())`; guard `if (parsed.jsonrpc === '2.0' && parsed.method)` then `this.opts.onMessage(parsed as RpcRequest)`; `catch (err) { logger.warn({ err }, 'Invalid message from control plane') }`. Handles string and buffer payloads; parse failures logged at warn with the error and dropped; wrong-jsonrpc / missing-method / empty-method / non-object dropped silently; only well-formed JSON-RPC 2.0 requests forwarded.

AC-016 contract satisfied at the real boundary on integrated main. No defects found.

## 2026-07-08T12:15Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- Outcome: passed on integrated main
- NextAction: next Ready Work Item

## 2026-07-08T12:25:47.721Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/transport/WI-AC-016-1-integration_qa.log
- NextAction: next Ready Work Item
