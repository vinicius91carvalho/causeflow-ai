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
