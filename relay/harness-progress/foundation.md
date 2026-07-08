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
