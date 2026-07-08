# foundation workflow journal

## WI-AC-001 — Verify-first (foundation)

**Result: implementation=true**

Boundary exercised at a real WebSocket boundary (a `ws` stub server on 127.0.0.1:5176) plus the real `node dist/index.js` process — no mocks of the relay itself.

- `npm install` → exit 0 (420 packages).
- `npm run build` (`tsc`) → exit 0; `dist/index.js` produced plus every module under `src/` (audit, config, drivers/postgres, drivers/mongodb, health, masking, policy, transport).
- Missing config (no `RELAY_CONFIG_PATH`, no `/app/relay-config.yaml`, no env vars) → pino logs `Starting CauseFlow Relay...` (info) then a `level:60` fatal `Failed to start relay` carrying the Zod `too_small` error on `resources`, and the process exits 1.
- Valid `relay-config.yaml` with an unreachable `controlPlane.url` (`ws://127.0.0.1:9/...`) → starts pino, logs `Starting CauseFlow Relay...`, logs `Config loaded`, initializes the `main-pg` driver, then emits `WS error` (ECONNREFUSED) and `Scheduling reconnect` with exponential backoff 1s→2s→4s→8s, staying alive (killed by timeout). Bad config fails fast; bad URL retries.
- Valid config with `controlPlane.url` pointed at the live `ws` stub → relay logs `Connected to control plane` with `relayId`+`url`; stub records the connection URL `/v1/relay/connect?token=test-token&tenantId=test-tenant` and receives a `resource_update` message on open. SIGTERM triggers `Shutting down...` and exit 0.
- Documented env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*`) also boots, connects, and emits `resource_update` (tenantId=envtenant).

### Root-cause fix (smallest diff, `src/drivers/postgres/pg-query-parser.ts` only)

The existing code failed AC-001 at startup: `node dist/index.js` crashed with `SyntaxError: The requested module 'node-sql-parser' does not provide an export named 'Parser'` before pino ever initialized, so neither the "missing config → fatal log" nor the "valid config → start + connect" path could run. `node-sql-parser` is a CJS package whose ESM interop only exposes a `default` export (the `{ Parser, util }` object), not a named `Parser`. `tsc` accepted the named import (the package's own `.d.ts` declares it), so this was a runtime-only defect.

Fix: changed the single import line to consume the default export and destructure `Parser`:

```ts
import sqlParser from 'node-sql-parser';
const { Parser } = sqlParser;
```

No other code touched. `tsc --noEmit` still exits 0; the parser behavior (validateQuery) is unchanged.

### Out of scope

Driver internals, SQL/AST parser semantics, policy/masking/audit, and the docker-compose plumbing are later work items (AC-002+, AC-022+, AC-039). AC-001's boundary is build + boot + config-load + WS connect/reconnect, all of which now pass.

## WI-AC-001 — QA independent verification (2026-07-07)

Re-ran the full AC-001 boundary independently as qa-agent in the isolated worktree.

- `npm install` → exit 0.
- `npm run build` (`tsc`) → exit 0; produced `dist/index.js` plus every module under `src/` (audit, config/loader, config/schema, drivers/driver.port, drivers/postgres/pg-driver, drivers/postgres/pg-query-parser, drivers/mongodb/mongo-driver, health/health-reporter, masking/masking-engine, policy/policy-engine, transport/protocol, transport/ws-client).
- Missing config (no `RELAY_CONFIG_PATH`, absent `/app/relay-config.yaml`, no env vars) → pino `Starting CauseFlow Relay...` (info) then `level:60` fatal `Failed to start relay` (Zod `too_small` on `resources`), exit 1.
- Valid `relay-config.yaml` with unreachable `controlPlane.url` (`ws://127.0.0.1:9`) → starts pino, logs `Starting CauseFlow Relay...`, `Config loaded`, `Driver initialized`, then `WS error` (ECONNREFUSED) and `Scheduling reconnect` with backoff 1s→2s→4s, staying alive.
- Valid config pointed at a real `ws` stub server → relay logs `Connected to control plane` with `relayId`+`url`; stub records `/v1/relay/connect?token=test-token&tenantId=test-tenant` and receives messages on open.
- Documented env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*` + `RELAY_TOKEN`/`TENANT_ID`) also boots, connects, and authenticates (tenantId=envtenant, token=envtoken).

**QA verdict: qa=true, implementation=true, no defects.**

## 2026-07-08T00:04:21.168Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-001
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## WI-AC-001 — Integrated Verification (2026-07-07)

Ran AC-001 at the real `node dist/index.js` + `ws` stub boundary on integrated main.

- `npm install` → exit 0.
- `npm run build` (`tsc`) → exit 0; `dist/index.js` + every module under `src/` produced.
- Missing config (no `RELAY_CONFIG_PATH`, no `/app/relay-config.yaml`, no env vars) → pino `Starting CauseFlow Relay...` then `level:60` fatal `Failed to start relay` (Zod `too_small` on `resources`), exit 1.
- Valid `relay-config.yaml` (string `port: "5432"`) with unreachable `controlPlane.url` (`ws://127.0.0.1:9`) → starts logger, `Config loaded`, `Driver initialized`, `WS error` (ECONNREFUSED), `Scheduling reconnect` backoff 1s→2s→4s, stays alive.
- Valid yaml + real `ws` stub on :5176 → `Connected to control plane`; stub records `/v1/relay/connect?token=test-token&tenantId=test-tenant` and receives `resource_update` on open.
- Env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*` + `RELAY_TOKEN`/`TENANT_ID`) → connects with `token=envtoken&tenantId=envtenant`, sends `resource_update`.

### DEFECT (integration=false)

The committed `relay-config.example.yaml` (the documented valid config) declares `port: 5432` as a YAML number, but `src/config/schema.ts` types `connection` as `z.record(z.string())`. Loading the documented example → fatal ZodError `resources[0].connection.port: Expected string, received number` → `level:60 Failed to start relay` → exit 1. AC-001 requires that with a valid `relay-config.yaml` the process starts; the canonical documented example fails to boot without manually quoting the port.

Evidence:
- `RELAY_CONFIG_PATH=./relay-config.example.yaml node dist/index.js` → `NODE_EXIT=1`, log contains `"level":60` and `"msg":"Failed to start relay"` with ZodError path `resources/0/connection/port` `Expected string, received number`.
- `grep -n 'port:' relay-config.example.yaml` → `port: 5432` (unquoted number).
- `src/config/schema.ts` → `connection: z.record(z.string())`.

Verdict: implementation=false, qa=false, integration=false.
