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

## 2026-07-08T00:10:22.847Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-001
- Defects: expected: a valid `relay-config.yaml` boots the relay (AC-001); observed: the committed `relay-config.example.yaml` declares `port: 5432` as a YAML number but `src/config/schema.ts` types `connection` as `z.record(z.string())`, so loading the documented example throws a fatal ZodError `resources[0].connection.port: Expected string, received number` and the process exits 1 without starting; evidence: `RELAY_CONFIG_PATH=./relay-config.example.yaml node dist/index.js` → NODE_EXIT=1 with log `"level":60` / `"msg":"Failed to start relay"` (ZodError path resources/0/connection/port); `grep 'port:' relay-config.example.yaml` → `port: 5432`; `src/config/schema.ts` → `connection: z.record(z.string())`. Other AC-001 boundaries pass: `npm install` exit 0; `npm run build` exit 0 producing `dist/index.js` + every src module; missing config → fatal log + exit 1; valid yaml (string port) + bad URL → starts pino, logs `Starting CauseFlow Relay...`, `Config loaded`, `Driver initialized`, reconnect backoff 1s→2s→4s; valid yaml + real `ws` stub on :5176 → `Connected to control plane`, stub records `?token=test-token&tenantId=test-tenant` and receives `resource_update`; env-var fallback → connects as `token=envtoken&tenantId=envtenant`.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-001-1-integration_qa.log
- NextAction: Repair Plan

## 2026-07-08T00:11:02.113Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-001
- DefectReport: expected: a valid `relay-config.yaml` boots the relay (AC-001); observed: the committed `relay-config.example.yaml` declares `port: 5432` as a YAML number but `src/config/schema.ts` types `connection` as `z.record(z.string())`, so loading the documented example throws a fatal ZodError `resources[0].connection.port: Expected string, received number` and the process exits 1 without starting; evidence: `RELAY_CONFIG_PATH=./relay-config.example.yaml node dist/index.js` → NODE_EXIT=1 with log `"level":60` / `"msg":"Failed to start relay"` (ZodError path resources/0/connection/port); `grep 'port:' relay-config.example.yaml` → `port: 5432`; `src/config/schema.ts` → `connection: z.record(z.string())`. Other AC-001 boundaries pass: `npm install` exit 0; `npm run build` exit 0 producing `dist/index.js` + every src module; missing config → fatal log + exit 1; valid yaml (string port) + bad URL → starts pino, logs `Starting CauseFlow Relay...`, `Config loaded`, `Driver initialized`, reconnect backoff 1s→2s→4s; valid yaml + real `ws` stub on :5176 → `Connected to control plane`, stub records `?token=test-token&tenantId=test-tenant` and receives `resource_update`; env-var fallback → connects as `token=envtoken&tenantId=envtenant`.
- RepairPlan: AC-001 fails on exactly one boundary: the committed documented example `relay-config.example.yaml` does not boot because its `port: 5432` is a YAML number while `src/config/schema.ts` constrains `connection` to `z.record(z.string())`, so `loadConfig()` throws a ZodError at `resources[0].connection.port` and the process exits 1. All other AC-001 boundaries (build, missing-config fatal, valid-yaml-with-string-port + bad URL reconnect, ws stub connect, env-var fallback) pass.; In `src/config/schema.ts`, widen `connection` to accept both string and number values, e.g. `connection: z.record(z.union([z.string(), z.number()]))`, so the documented example loads as-is (preferred — keeps the example ergonomic and matches `pg-driver.ts` which already types `port: number`).; In `src/drivers/postgres/pg-driver.ts`, coerce connection values to the expected runtime types when constructing `PgDriverConfig` (e.g. `port: Number(connection.port)`, host/user/password/database as String(...)) so a string OR number `port` both work and `tsc --noEmit` stays green under the widened schema.; Verify `relay-config.docker.yaml` (if present) and any other committed YAML examples also load under the widened schema; quote or interpolate `port` consistently if needed.; Optional belt-and-suspenders: add a unit/integration assertion that `RELAY_CONFIG_PATH=./relay-config.example.yaml node dist/index.js` boots far enough to log 'Starting CauseFlow Relay...' and 'Config loaded' before any connect attempt, guarding the documented example against regression.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-001-1-integration_qa.log
- NextAction: Coding Attempt 2

## WI-AC-001 — Verify-first repair (2026-07-07)

Applied the orchestrator's Repair Plan (smallest diff). Root cause confirmed at the boundary: `RELAY_CONFIG_PATH=./relay-config.example.yaml node dist/index.js` → `NODE_EXIT=1` with `level:60` ZodError at `resources/0/connection/port` (`Expected string, received number`) because the documented example declares `port: 5432` as a YAML number while `src/config/schema.ts` typed `connection` as `z.record(z.string())`.

Fix (two files, minimal):
- `src/config/schema.ts`: widened `connection` to `z.record(z.union([z.string(), z.number()]))` so the documented example loads as-is.
- `src/index.ts`: coerced connection values at the driver-construction site — `String(...)` for host/database/user/password/uri, `Number(...)` for port — so a string OR number `port` both work and `tsc --noEmit` stays green under the widened schema. (PgDriverConfig already types `port: number`; no change needed in `pg-driver.ts`.)

Re-verified every AC-001 boundary at the real `node dist/index.js` + `ws` stub on :5176 boundary:
- `npm install` → exit 0.
- `npm run build` (`tsc`) → exit 0; `dist/index.js` + all 13 modules under `src/` produced.
- `npx tsc --noEmit` → exit 0.
- Missing config (no `RELAY_CONFIG_PATH`, no env vars) → pino `Starting CauseFlow Relay...` then `level:60` fatal `Failed to start relay` (Zod `too_small` on `resources`), **NODE_EXIT=1**.
- Documented example `relay-config.example.yaml` (unquoted numeric `port: 5432`) → starts pino, logs `Starting CauseFlow Relay...`, `Config loaded` (resources=2, tenantId=test-tenant), initializes both drivers, then attempts to connect to `controlPlane.url`. No ZodError on `connection.port`.
- Bad URL (`ws://127.0.0.1:59999/...`) + valid yaml → `WS error` (ECONNREFUSED) + `Scheduling reconnect` backoff 1s→2s→4s→8s, stays alive.
- Real `ws` stub on :5176 → `Connected to control plane`; stub records `?token=test-token&tenantId=test-tenant`, `Authorization: Bearer test-token`, `X-Tenant-Id: test-tenant`, receives `resource_update` on open, and the relay answers the stub's `health_check` JSON-RPC round-trip.
- Env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*` with JSON `{"port":5432}` + `RELAY_TOKEN=envtoken`/`TENANT_ID=envtenant`) → boots, `Config loaded` (tenantId=envtenant), attempts to connect.

No other committed YAML examples exist (only `relay-config.example.yaml`; no `relay-config.docker.yaml` present). Verdict: implementation=true, all AC-001 boundaries pass.

## WI-AC-001 — QA independent re-verification (2026-07-07)

Independently re-ran the full AC-001 boundary as qa-agent in the isolated worktree (clean `dist`, real `node dist/index.js`, real `ws` stub on :5176). The previously-reported numeric-port defect is fixed (`src/config/schema.ts` widened `connection` to `z.record(z.union([z.string(), z.number()]))`; `src/index.ts` coerces `port: Number(...)`, others `String(...)`).

- `npm install` → exit 0.
- `npm run build` (`tsc`) → exit 0; produced `dist/index.js` + all 13 modules under `src/` (audit, config/loader, config/schema, drivers/driver.port, drivers/postgres/pg-driver, drivers/postgres/pg-query-parser, drivers/mongodb/mongo-driver, health/health-reporter, masking/masking-engine, policy/policy-engine, transport/protocol, transport/ws-client).
- Missing config (no `RELAY_CONFIG_PATH`, absent `/app/relay-config.yaml`, no env vars) → pino `Starting CauseFlow Relay...` (info) then `level:60` fatal `Failed to start relay` (Zod `too_small` on `resources`), **NODE_EXIT=1**.
- Documented example `relay-config.example.yaml` (unquoted numeric `port: 5432`) with env vars set → `Starting CauseFlow Relay...`, `Config loaded` (resources=2, tenantId=test-tenant), both drivers initialized, then attempts to connect to `controlPlane.url` (ws://localhost:3000). No ZodError on `connection.port` — defect fixed.
- Valid yaml + bad URL (`ws://127.0.0.1:9`) → starts pino, `Config loaded`, `Driver initialized`, `WS error` (ECONNREFUSED), `Scheduling reconnect` backoff 1s→2s→4s, stays alive (timeout kill 124).
- Valid yaml + real `ws` stub on :5176 → `Connected to control plane` (relayId+url logged); stub records `url=/v1/relay/connect?token=test-token&tenantId=test-tenant`, `Authorization: Bearer test-token`, `X-Tenant-Id: test-tenant`, and receives `resource_update` with 2 resources on open.
- Env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*` JSON `{"port":5432}` + `RELAY_TOKEN=envtoken`/`TENANT_ID=envtenant`, no YAML) → boots, `Config loaded` (tenantId=envtenant, resources=1), `Driver initialized`, connects as `token=envtoken&tenantId=envtenant`, stub receives `resource_update` with 1 resource.

Verdict: qa=true, implementation=true, no defects. All AC-001 boundaries pass.

## 2026-07-08T00:20:04.422Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-001
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## WI-AC-001 — Integrated Verification on main (2026-07-07)

Re-ran the full AC-001 boundary at the real `node dist/index.js` + `ws` stub on :5176 boundary on integrated main (commit a20d3e4). Clean `dist`, real external boundaries, no mocks of the relay.

- `npm install` → exit 0.
- `npm run build` (`tsc`) → exit 0; produced `dist/index.js` + all 13 modules under `src/` (audit, config/loader, config/schema, drivers/driver.port, drivers/postgres/pg-driver, drivers/postgres/pg-query-parser, drivers/mongodb/mongo-driver, health/health-reporter, masking/masking-engine, policy/policy-engine, transport/protocol, transport/ws-client).
- Missing config (no `RELAY_CONFIG_PATH`, absent `/app/relay-config.yaml`, no env vars) → pino `Starting CauseFlow Relay...` then `level:60` fatal `Failed to start relay` (Zod `too_small` on `resources`), **NODE_EXIT=1**.
- Documented example `relay-config.example.yaml` (unquoted numeric `port: 5432`) with env vars set → `Starting CauseFlow Relay...`, `Config loaded` (resources=2, tenantId=test-tenant), both drivers initialized, then attempts to connect to `controlPlane.url`. No ZodError on `connection.port` — the previously-reported numeric-port defect remains fixed (`src/config/schema.ts` `connection: z.record(z.union([z.string(), z.number()]))`; `src/index.ts` coerces `Number(...)`/`String(...)`).
- Valid yaml + bad URL (`ws://127.0.0.1:9`) → starts pino, `Config loaded`, both `Driver initialized`, `WS error` (ECONNREFUSED), `Scheduling reconnect` backoff 1s→2s→4s→8s, stays alive (timeout kill 124). Bad URL retries; bad config fails fast.
- Valid yaml + real `ws` stub on :5176 → `Connected to control plane` (relayId+url logged); stub records `url=/v1/relay/connect?token=test-token&tenantId=test-tenant`, `Authorization: Bearer test-token`, `X-Tenant-Id: test-tenant`, and receives `resource_update` with 2 resources on open. SIGTERM (from timeout) → `Shutting down...`.
- Env-var fallback (`CONTROL_PLANE_URL` + `RESOURCE_0_*` JSON `{"port":5432}` + `RELAY_TOKEN=envtoken`/`TENANT_ID=envtenant`, no YAML) → boots, `Config loaded` (tenantId=envtenant, resources=1), `Driver initialized`, connects as `token=envtoken&tenantId=envtenant`, stub receives `resource_update` with 1 resource.

**Verdict: integration=true, implementation=true, qa=true, no defects.** All AC-001 boundaries pass on integrated main.

## 2026-07-08T00:25:16.533Z — Resumed

- WorkItem: WI-AC-001
- PreviousPhase: qa
- Attempt: 2
- NextAction: qa

## 2026-07-08T00:25:16.558Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-001
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:54:08.024Z — Integrated Verification passed

- Attempt: 2/3
- WorkItem: WI-AC-001
- AcceptanceChecks: AC-001
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-001-2-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-002 — Verify-first (foundation)

**Result: implementation=true (zero-diff checkpoint)**

Exercised every AC-002 boundary at real external boundaries (Docker Engine 29.6 + `docker buildx` 0.35; live `ws` control-plane stub on 0.0.0.0:5177). No code changes — the existing `Dockerfile` already satisfies every invariant.

- `docker build . --platform linux/amd64` → exit 0; image `causeflow-relay:ac002` produced (multi-stage `node:22-alpine` builder → runtime).
- Multi-arch buildx: registered `tonistiigi/binfmt --install arm64` (qemu-aarch64), then `docker buildx build --platform linux/amd64,linux/arm64 . --output type=oci,dest=...` → exit 0; manifest list built for both platforms.
- `docker inspect <image>` → `ExposedPorts: {"8080/tcp":{}}` only (informational); `Config.User: relay`; `Cmd: ["node","dist/index.js"]`.
- `docker run --rm <image> node -e "require('fs').readFileSync('/etc/passwd','utf8')"` → `/etc/passwd` contains `relay:x:10001:10001::/home/relay:/bin/sh`; running process `uid=10001 gid=10001`. Image runs as `relay` (UID 10001).
- Read-only rootfs: `docker run --rm --read-only <image> node -e "writeFileSync('/app/test.txt','x')"` → `WRITE BLOCKED: EROFS` (read-only enforced when run with the documented `--read-only` production flag). The image boots and connects fine under `--read-only --tmpfs /tmp:size=64m --security-opt no-new-privileges --cap-drop ALL`.
- Run with a valid config (`/tmp/ac002-relay-config.yaml` mounted ro, `RELAY_TOKEN`/`TENANT_ID` env, controlPlane.url → `ws://cp:5177/v1/relay/connect` via `--add-host=cp:host-gateway`) → pino logs `"Starting CauseFlow Relay..."` (pid 1, as `relay`), `Config loaded` (resources=2, tenantId=ac002-tenant), both drivers `Driver initialized`, then `"Connected to control plane"` (relayId+url). Stub log: `[stub] relay connected` + `[stub] resource_update from relayId=<uuid> resources=2`. Connection to the configured control plane confirmed at the real WS boundary.

Verdict: implementation=true, zero code diff. All AC-002 invariants (build single + multi-arch, UID 10001 `relay` user, read-only-capable rootfs, only port 8080 exposed, boots + connects with valid config) pass.

## 2026-07-08T01:10:53.071Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-002
- DefectReport: QA failed
- RepairPlan: AC-002 defect is an evidence/verdict-emission failure, not a repository defect. The referenced evidence file (WI-AC-002-1-qa.log) contains ONLY the route-selection header line `{"adapter":"direct","kind":"QA","outcome":"selected"}` with no QA result JSON appended — the independent QA run was selected but never produced/wrote a verdict, so the harness recorded the generic `"QA failed"` sentinel. The sibling integration_qa log already passed (`defects:[], implementation:true`) and the coding log records a zero-diff checkpoint verifying all AC-002 boundaries. Independent reproduction on the current repo confirms every AC-002 invariant holds: `docker build . --platform linux/amd64` exits 0; `docker inspect` shows `User=relay`, `Cmd=[node dist/index.js]`, `ExposedPorts={8080/tcp}` only; `docker run` shows the process runs `uid=10001 gid=10001 user=relay` and `/etc/passwd` has `relay:x:10001:10001`; `--read-only` rootfs blocks writes with `EROFS`; under `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges` with env-var config the image logs `Starting CauseFlow Relay...`, `Config loaded`, `Driver initialized`, then attempts to connect to `controlPlane.url` (ECONNREFUSED → exponential-backoff reconnect, as designed). The Dockerfile matches AC-011 (two-stage node:22-alpine, adduser -u 10001 relay, USER relay, EXPOSE 8080, CMD node dist/index.js) and the source tree contains every module required by project_specs.xml.; Re-run the independent QA step for WI-AC-002 (attempt 2) against the current integrated main — no code changes are warranted; the repository already meets AC-002.; Ensure the QA agent, after route selection, appends a full result JSON to the evidence log (e.g., `{"id":"WI-AC-002","qa":true,"defects":[]}`) so a missing verdict cannot masquerade as a content failure.; If QA times out on multi-arch buildx, scope the re-run to the AC-002-required `--platform linux/amd64` single-arch build plus the inspect/run/read-only checks; multi-arch `linux/amd64,linux/arm64` is the buildx-host variant and already cached-passing per the coding checkpoint.; No source/Dockerfile edits required — do NOT modify files per the repair-planner role.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-002-1-qa.log
- NextAction: Coding Attempt 2

## 2026-07-08T02:13:00.000Z — Independent QA passed (attempt 2)

- Attempt: 2/3
- WorkItem: WI-AC-002
- AcceptanceChecks: AC-002
- Outcome: passed on integrated main (zero-diff; no source/Dockerfile changes)
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-002-2-qa.log
- Reproduced at real external boundaries (Docker Engine 29.6.1 + buildx 0.35):
  1. `docker build . --platform linux/amd64` → exit 0 (image `causeflow-relay:ac002-verify`, layers CACHED).
  2. `docker buildx build --platform linux/amd64,linux/arm64 --output type=oci` → exit 0 (manifest list for both platforms; host supports arm64 natively).
  3. `docker inspect` → `User=relay`, `Cmd=[node dist/index.js]`, `ExposedPorts={"8080/tcp":{}}` only.
  4. `docker run --rm <image> node -e "readFileSync('/etc/passwd')"` → `relay:x:10001:10001::/home/relay:/bin/sh`; process `uid=10001 gid=10001`.
  5. `docker run --rm --read-only <image>` write probe → `WRITE BLOCKED: EROFS` (read-only rootfs by default with `--read-only`).
  6. Under `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges` with env-var config (controlPlane.url → live ws stub on 0.0.0.0:5177 via `--add-host=cp:host-gateway`, `RELAY_TOKEN`/`TENANT_ID`/`RESOURCE_0_*`) → pino logs `"Starting CauseFlow Relay..."` (pid 1, UID 10001 as relay), `"Config loaded"` (resources=1, tenantId=ac002-tenant), `"Driver initialized"` (demo-pg postgres), then `"Connected to control plane"` (relayId+url). Live ws stub logged `[stub] relay connected` + `[stub] resource_update from relayId=<uuid> resources=1`. Connection to configured control plane confirmed at the real WS boundary.
- RootCause confirmed: the prior `WI-AC-002-1-qa.log` defect was an evidence-emission gap (QA route selected, no verdict JSON appended), not a repository defect. Full verdict JSON now written to `WI-AC-002-2-qa.log`.
- NextAction: next Ready Work Item

## WI-AC-002 — QA independent verification (attempt 3, 2026-07-07)

Independently re-ran every AC-002 invariant at real external boundaries (Docker Engine 29.6.1 + buildx 0.35; live `ws` control-plane stub on 0.0.0.0:5177). Zero code diff — the existing `Dockerfile` already satisfies every invariant.

1. `docker build . --platform linux/amd64` → exit 0 (image `causeflow-relay:ac002-qa`, layers CACHED).
2. Multi-arch buildx: `docker buildx build --platform linux/amd64,linux/arm64 --output type=oci` → exit 0 (manifest list built for both platforms; host supports arm64 natively).
3. `docker inspect causeflow-relay:ac002-qa` → `User=relay`, `Cmd=["node","dist/index.js"]`, `ExposedPorts={"8080/tcp":{}}` only (no other ports exposed; 8080 informational).
4. `docker run --rm <image> node -e "readFileSync('/etc/passwd')"` → `/etc/passwd` contains `relay:x:10001:10001::/home/relay:/bin/sh`; process runs `uid=10001 gid=10001`. Image runs as `relay` (UID 10001).
5. Read-only rootfs: `docker run --rm --read-only <image>` write probe (`writeFileSync('/app/test.txt','x')`) → `WRITE_BLOCKED: EROFS`. Root filesystem is read-only by default when run with the documented `--read-only` production flag.
6. Run with a valid config under the full production hardening (`--read-only --tmpfs /tmp:size=64m --security-opt no-new-privileges --cap-drop ALL`), config mounted ro, `RELAY_TOKEN`/`TENANT_ID`/`PG_*` env, `controlPlane.url → ws://cp:5177/v1/relay/connect` via `--add-host=cp:host-gateway` → pino logs `"Starting CauseFlow Relay..."` (pid 1, as `relay`/UID 10001), `"Config loaded"` (resources=1, tenantId=ac002-tenant), `"Driver initialized"` (demo-pg postgres), then `"Connected to control plane"` (relayId+url). Live ws stub logged `[stub] relay connected` + `[stub] resource_update from relayId=<uuid> resources=1`. Connection to the configured control plane confirmed at the real WS boundary.

Evidence: /tmp/ac002-evidence/WI-AC-002-3-qa.log

**QA verdict: qa=true, implementation=true, no defects.** All AC-002 invariants pass on integrated main.

## 2026-07-08T01:19:14.215Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-002
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:50:19.018Z — Resumed

- WorkItem: WI-AC-002
- PreviousPhase: qa
- Attempt: 2
- NextAction: qa

## 2026-07-08T01:50:19.046Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-002
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## WI-AC-002 — Integrated Verification (2026-07-07)

Independently re-ran every AC-002 invariant at real external boundaries on integrated `main` (commit ab95b1e). Zero code diff.

1. `docker build . --platform linux/amd64` → exit 0 (image `causeflow-relay:qa-002`).
2. Multi-arch buildx: `docker buildx build . --platform linux/amd64,linux/arm64 --load` → exit 0 (manifest list built for both platforms; CACHED).
3. `docker inspect causeflow-relay:qa-002` → `User=relay`, `Cmd=["node","dist/index.js"]`, `ExposedPorts={"8080/tcp":{}}` only — no ports other than the informational 8080.
4. `docker run --rm <image> id` → `uid=10001(relay) gid=10001(relay)`; `whoami` → `relay`. `docker run --rm <image> node -e "require('fs').readFileSync('/etc/passwd','utf8'); console.log('read ok')"` → `read ok` (process runs as relay/UID 10001, /etc/passwd readable).
5. Read-only rootfs: `docker run --rm --read-only <image>` write probe → `write blocked: EROFS`; with `--tmpfs /tmp:size=64m` → `tmpfs write ok`. Root filesystem is read-only by default under the documented `--read-only` production flag; the app writes only to /tmp.
6. End-to-end via `docker compose up -d` (4 services: relay-control-plane-stub, relay-postgres, relay-mongo, relay) → relay container (pid 1, UID 10001) logs `"Starting CauseFlow Relay..."`, `"Config loaded"` (resources=2), `"Driver initialized"` (order-pg, order-mongo), then `"Connected to control plane"` (url=ws://relay-control-plane-stub:3000/v1/relay/connect). Stub logged `[stub] relay connected`, `[stub] resource_update from relayId=<uuid> resources=2`, and ran a smoke health_check + execute round-trip (query SELECT 1, list_tables) successfully. Connection to the configured control plane confirmed at the real WS boundary.

Evidence: /tmp/ac002-evidence/WI-AC-002-iv.log

**Integrated verdict: integration=true, implementation=true, qa=true, no defects.** All AC-002 invariants pass on integrated main.

## 2026-07-08T02:13:28.653Z — Integrated Verification passed

- Attempt: 2/3
- WorkItem: WI-AC-002
- AcceptanceChecks: AC-002
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/foundation/WI-AC-002-2-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-003 — Verify-first (foundation)

**Result: implementation=true (zero-diff checkpoint)**

Exercised every AC-003 condition against the existing repository. No code changes — all invariants already hold.

- `npx tsc --noEmit` → **exit 0** (after `npm install` to materialize `typescript`; deps were gitignored, no tracked change).
- `tsconfig.json` compiles under `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, `esModuleInterop: true`, `skipLibCheck: true` (all set).
- `package.json` declares `"type": "module"` (line 5).
- Every internal relative import uses the explicit `.js` extension on the relative path (e.g. `from './transport/protocol.js'`). Grep for relative imports WITHOUT `.js` → none; all 20 relative imports across `src/` end in `.js`.

Verdict: implementation=true, zero code diff. All AC-003 boundaries pass.

## 2026-07-08T03:15:00.000Z — QA pass (independent) WI-AC-003

- WorkItem: WI-AC-003 (foundation)
- AcceptanceChecks: AC-003
- Outcome: passed (independent QA)

Exercised AC-003 independently on the integrated worktree:

- `npx tsc --noEmit` → **exit 0**.
- `tsconfig.json` → `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext` (plus `target: ES2022`, `esModuleInterop: true`, `skipLibCheck: true`, declarations/source maps on).
- `package.json` → `"type": "module"` declared.
- Internal relative imports (20 across `src/`) → every one uses the explicit `.js` extension; grep for relative imports without `.js` → none.
- Repo scaffold (src/config, src/drivers/{postgres,mongodb}, src/policy, src/masking, src/audit, src/health, src/transport, src/index.ts) matches project_specs.xml affected_surfaces.

Verdict: qa=true, implementation=true, no defects.

## 2026-07-08T02:16:28.846Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-003
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T03:20:00.000Z — Integrated Verification passed (WI-AC-003)

- WorkItem: WI-AC-003 (foundation)
- AcceptanceChecks: AC-003
- Outcome: passed on integrated main

Exercised AC-003 at real boundaries on integrated main (HEAD a01b44d):

- `npx tsc --noEmit` → **exit 0** (strict NodeNext compile clean).
- `tsconfig.json` → `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext` (plus `target: ES2022`, `esModuleInterop: true`, `skipLibCheck: true`, declarations/source maps on).
- `package.json` declares `"type": "module"` (line 5).
- All 20 internal relative imports across `src/` use the explicit `.js` extension (e.g. `from './transport/protocol.js'`); grep for relative imports without `.js` → none; no dynamic `import()` calls present.
- `npm run build` → exit 0, produces `dist/index.js` plus every src module.
- Repo scaffold matches project_specs.xml affected_surfaces (config, drivers/{postgres,mongodb}, policy, masking, audit, health, transport, index.ts).

Verdict: integration=true, implementation=true, qa=true, no defects.
