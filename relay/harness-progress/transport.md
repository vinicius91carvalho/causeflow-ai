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

## 2026-07-08T02:46:15.190Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- Outcome: isolated QA passed
- NextAction: Integrated Verification
