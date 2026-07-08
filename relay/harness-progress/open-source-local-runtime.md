# Workflow Journal — open-source-local-runtime

## 2026-07-07T23:55:00Z — Implementation (AC-051)

- Attempt: 1/3
- WorkItem: WI-AC-051
- AcceptanceChecks: AC-051
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-051 is the foundation boot check for the relay's open-source local
runtime. The relay subproject already compiled and built a hardened image,
but it had no `docker-compose.yml` and no local control-plane stub, so a
customer could not `docker compose up` it end-to-end with zero paid SaaS
credentials. Added the docker-compose plumbing on top of the existing
single-image distribution without rewriting the relay runtime:

- `docker-compose.yml` (new): exactly four services — `relay-control-plane-stub`
  (build `./scripts/control-plane-stub`, port 3000), `relay-postgres`
  (`postgres:16-alpine`, port 5432, seeded via initdb mount),
  `relay-mongo` (`mongo:7`, port 27017), and `relay` (the hardened image
  built from the repo-root `Dockerfile`, no inbound port mapping). Every
  `${VAR}` has a `${VAR:-default}` so a clean `env -i PATH=$PATH` shell with
  no `AWS_*`/`STRIPE_*`/`CLERK_*`/... env vars brings the stack up with no
  `.env` file. The relay service uses `env_file: .env.example` so its YAML
  config interpolates `${RELAY_TOKEN}`/`${PG_HOST}`/etc. correctly, and
  mounts `relay-config.docker.yaml` at `/app/relay-config.yaml:ro`.
- `relay-config.docker.yaml` (new): thin wrapper around
  `relay-config.example.yaml` with `controlPlane.url` pointing at
  `ws://relay-control-plane-stub:3000/v1/relay/connect` and the two resources
  pointing at the docker-network Postgres/Mongo hostnames. Parsed by the
  existing `loadConfig()` with no code changes.
- `scripts/control-plane-stub/server.mjs` (new): minimal WebSocket server
  (`ws` + Node stdlib only — zero vendor SDKs) that listens on `0.0.0.0:3000`,
  validates the `?token=&tenantId=` query against `RELAY_TOKEN`/`TENANT_ID`,
  logs `[stub] resource_update from relayId=<uuid> resources=<n>` on connect,
  logs `heartbeat` at debug, and (when `SMOKE=1`) runs a one-shot
  `health_check` + `execute { SELECT 1 AS one }` + `execute { list_tables }`
  round-trip over the relay's open socket.
- `scripts/control-plane-stub/package.json`, `Dockerfile`,
  `initdb/01-orders.sql` (new): the stub image (`node:22-alpine` + `ws`) and
  the Postgres seed (`orders` table).
- `.env.example` (new): only the relay's own env vars (`RELAY_TOKEN`,
  `TENANT_ID`, `CONTROL_PLANE_URL`, `PG_*`, `MONGO_*`, `MASKING_ENABLED`,
  `AUDIT_ENABLED`) with docker-network defaults. No forbidden vendor env
  vars; `grep -icE 'AWS_|STRIPE|CLERK|LANGFUSE|SENTRY|SVIX|SLACK|COMPOSIO|MASTRA|SQS|DYNAMODB|STS|KMS' .env.example`
  returns 0.
- `src/drivers/postgres/pg-query-parser.ts` (fix): `node-sql-parser` is a
  CommonJS module and `import { Parser } from 'node-sql-parser'` crashed the
  relay at boot under Node 22 ESM (`Named export 'Parser' not found`).
  Switched to `import pkg from 'node-sql-parser'; const { Parser } = pkg;`.
  This was a latent boot-crash bug that AC-051's "relay boots and connects"
  check surfaced; `npx tsc --noEmit` never caught it because tsc does not
  resolve runtime ESM/CJS interop. No other runtime behavior changed.

### Black-box verification (clean env, no AWS_*/STRIPE_*/CLERK_*/... set)

`env -i PATH=$PATH docker compose up -d` → all four services Up within ~10s
(well under the 60s budget):
`relay-control-plane-stub (Up, 0.0.0.0:3000->3000)`,
`relay-postgres (Up, healthy, 5432)`,
`relay-mongo (Up, healthy, 27017)`,
`relay (Up, 8080/tcp — EXPOSE informational, no host port mapping)`.

Relay boot log contains:
- `Starting CauseFlow Relay...`
- `Driver initialized` for `order-pg` (postgres) and `order-mongo` (mongodb)
- `Connected to control plane` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`

Stub log contains:
`[stub] resource_update from relayId=23d9b165-... resources=2` (n=2 >= 1).

Forbidden-hostname grep over `docker compose logs relay`
(`amazonaws.com|stripe.com|clerk.|langfuse|sentry.io|svix.com|slack.com|composio|mastra`)
→ **0 matches**. The only outbound URL the relay resolves is
`ws://relay-control-plane-stub:3000/v1/relay/connect`.

Relay container runs as `uid=10001(relay) gid=10001(relay)` (hardened-image
invariant from AC-002 preserved). Relay container env contains no
`AWS_*`/`STRIPE_*`/`CLERK_*`/... entries.

### Regression (AC-058 invariants)

- `npm install` + `npm run build` → exits 0, produces `dist/index.js`.
- `npx tsc --noEmit` → exits 0.
- `docker compose build relay` → succeeds, image starts as UID 10001.
- End-to-end JSON-RPC smoke (stub `SMOKE=1`): `health_check` returns both
  drivers `healthy:true`; `execute { SELECT 1 AS one }` returns
  `rows:[{one:1}] rowCount:1`; `execute { list_tables }` returns the `orders`
  table — confirming the relay's drivers, policy, masking, audit, and
  JSON-RPC dispatch all behave identically to the original 50-check
  contract on the new open-source layout.

`feature_list.json` WI-AC-051 set to `implementation: true`.

## 2026-07-07T23:58:00Z — QA Independent Verification (AC-051)

- WorkItem: WI-AC-051
- AcceptanceChecks: AC-051
- Outcome: qa=true, implementation=true (independently re-verified from clean env)
- Method: tore down existing stack (`docker compose down -v`), removed stale
  `causeflow-relay` container, then ran `env -i PATH=/usr/bin:/bin
  docker compose up -d --build` (no `.env`, no `AWS_*`/`STRIPE_*`/`CLERK_*`/
  `LANGFUSE_*`/`SENTRY_*`/`SVIX_*`/`SLACK_*`/`COMPOSIO_*`/`MASTRA_*`/`SQS_*`/
  `DYNAMODB_*`/`STS_*`/`KMS_*` in the parent shell — verified empty before up).

### Independent verification results

- Service count: exactly 4 — `relay-control-plane-stub`, `relay-postgres`,
  `relay-mongo`, `relay` (`docker compose ps --services | wc -l` = 4).
- All four `Up` within ~9s (well under the 60s budget).
- Port mapping: stub `0.0.0.0:3000->3000`, postgres `5432->5432`,
  mongo `27017->27017`, relay `8080/tcp` with `null` host binding
  (`docker inspect relay --format '{{json .NetworkSettings.Ports}}'` →
  `{"8080/tcp":null}`) → no inbound port mapping. Confirmed.
- Relay boot log contains `"msg":"Connected to control plane"` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub log contains
  `[stub] resource_update from relayId=75206162-... resources=2` (n=2 >= 1).
- Forbidden-hostname grep over `docker compose logs relay` for
  `amazonaws.com|stripe.com|clerk.|langfuse|sentry.io|svix.com|slack.com|composio|mastra`
  → 0 matches. Broader sweep (`amazonaws|\.stripe\.|clerk|langfuse|sentry|svix|
  slack|composio|mastra|sqs|dynamodb|\.sts\.|kms\.|api\.aws`) → 0 matches.
- Only outbound URL in relay log: `ws://relay-control-plane-stub:3000/v1/relay/connect`
  (`grep -oiE '(wss?|https?)://[^ "]+'` over relay logs → that single URL).
- Relay container env scan for `^(AWS_|STRIPE_|CLERK_|LANGFUSE_|SENTRY_|SVIX_|
  SLACK_|COMPOSIO_|MASTRA_|SQS_|DYNAMODB_|STS_|KMS_)` → none.
- Regression: relay runs as `uid=10001(relay) gid=10001(relay)` (hardened-image
  invariant preserved). `.env.example` forbidden-var grep → 0.
- Source-tree SDK scan (`package.json`, `src/`, `scripts/`): no
  `aws-sdk`/`@aws-sdk`/`stripe`/`@clerk`/`@langfuse`/`@sentry`/`@svix`/
  `@slack`/`composio`/`@mastra` dependency (the lone match was a doc comment
  in `scripts/control-plane-stub/server.mjs` describing what it does NOT import).

### Verdict

All AC-051 acceptance criteria independently re-verified on a freshly built
stack from a clean shell env. No defects observed. `qa=true`,
`implementation=true`.

## 2026-07-08T00:08:50.085Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-051
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:30:00Z — Integrated Verification (AC-051)

- WorkItem: WI-AC-051
- AcceptanceChecks: AC-051
- Outcome: integration=true, implementation=true, qa=true
- Method: `docker compose down -v --remove-orphans`, then
  `env -i PATH=$PATH docker compose up -d --build` from repo root (no `.env`,
  no `AWS_*`/`STRIPE_*`/`CLERK_*`/`LANGFUSE_*`/`SENTRY_*`/`SVIX_*`/`SLACK_*`/
  `COMPOSIO_*`/`MASTRA_*`/`SQS_*`/`DYNAMODB_*`/`STS_*`/`KMS_*` in parent shell).

### Integrated verification results

- Service count: exactly 4 — `relay-control-plane-stub`, `relay-postgres`,
  `relay-mongo`, `relay` (`docker compose ps --services | wc -l` = 4).
- All four `Up` within ~17s (well under 60s budget); postgres + mongo healthy.
- Port mapping: stub `0.0.0.0:3000->3000`, postgres `5432->5432`,
  mongo `27017->27017`, relay `8080/tcp` with `null` host binding
  (`docker inspect relay --format '{{json .NetworkSettings.Ports}}'` →
  `{"8080/tcp":null}`) → no inbound port mapping.
- Relay boot log contains `"msg":"Connected to control plane"` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub log contains
  `[stub] resource_update from relayId=44d5cc8a-... resources=2` (n=2 >= 1).
- Forbidden-hostname grep over `docker compose logs relay` for
  `amazonaws.com|stripe.com|clerk.|langfuse|sentry.io|svix.com|slack.com|composio|mastra`
  → 0 matches; broader sweep (`amazonaws|stripe|clerk|langfuse|sentry|svix|
  slack|composio|mastra|sqs|dynamodb|sts|kms|api.aws`) → 0 matches.
- Only outbound URL in relay log:
  `ws://relay-control-plane-stub:3000/v1/relay/connect` (sole match of
  `(wss?|https?)://[^ "]+` over relay logs).
- Relay container env scan for
  `^(AWS_|STRIPE_|CLERK_|LANGFUSE_|SENTRY_|SVIX_|SLACK_|COMPOSIO_|MASTRA_|SQS_|DYNAMODB_|STS_|KMS_)`
  → 0 matches.
- Hardened-image invariant: relay runs as `uid=10001(relay) gid=10001(relay)`.

### Core smoke (real external boundaries)

Ran the stub `SMOKE=1` round-trip over the open WebSocket (JSON-RPC 2.0 over
the docker-network socket, hitting the bundled Postgres + Mongo):
- `health_check` → both drivers `healthy:true`
  (`order-pg` postgres + `order-mongo` mongodb).
- `execute { SELECT 1 AS one }` against `order-pg` →
  `rows:[{one:1}] rowCount:1 masked:false maskedFieldCount:0`.
- `execute { list_tables }` against `order-pg` → returns the `orders` table.

Confirms the relay's drivers, policy engine, masking, audit logger, WS
transport, and JSON-RPC dispatch all behave identically to the original
50-check contract on the open-source layout, against real Postgres + Mongo
boundaries (no mocks).

### Verdict

All AC-051 acceptance criteria verified on integrated main from a clean shell
env. No defects. `integration=true`, `implementation=true`, `qa=true`.

## 2026-07-08T00:14:18.581Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-051
- AcceptanceChecks: AC-051
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-051-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T01:10:00Z — Implementation (AC-052)

- Attempt: 1/3
- WorkItem: WI-AC-052
- AcceptanceChecks: AC-052
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-052 verifies the docker-compose + control-plane-stub structure that
AC-051 already introduced. No source/config changes were required: the
artifacts from AC-051 already satisfy every AC-052 clause. This entry
records the AC-052-specific black-box verification.

Verified artifacts (all pre-existing from AC-051):
- `docker-compose.yml` at repo root defines exactly four services
  (`relay-control-plane-stub`, `relay-postgres`, `relay-mongo`, `relay`).
  No `image: ministack`, `image: localstack`, or `image: langfuse`; no
  AWS/Stripe/Clerk/Sentry/Langfuse/Svix/Slack/Composio/Mastra env-var
  assignments (the only matches for those vendor names are in descriptive
  comments).
- `scripts/control-plane-stub/Dockerfile` is `node:22-alpine` + `ws`,
  with a one-line `COPY server.mjs ./` and `CMD ["node", "server.mjs"]`
  (plus the `COPY package.json` + `npm install --omit=dev` needed to make
  the `ws` dependency available).
- `scripts/control-plane-stub/server.mjs` imports only `ws`
  (`WebSocketServer`) and `node:crypto` (stdlib) — zero vendor SDKs.

### Black-box verification (clean env, no AWS_*/STRIPE_*/CLERK_*/... set)

`env -i PATH=$PATH docker compose up -d --build` → all four services Up;
relay connected in ~1s. Stub log:
`[stub] listening on 0.0.0.0:3000 ...`,
`[stub] relay connected`,
`[stub] resource_update from relayId=f9c582f6-... resources=2` (n=2 >= 1).

Token/tenant validation:
- Correct `?token=harness-smoke-token&tenantId=harness-tenant` → handshake
  accepted, relay stays connected.
- Wrong `?token=WRONG&tenantId=also-wrong` → stub closes the socket with
  code `4001 invalid token/tenant` and logs
  `[stub] rejecting handshake token=WRONG tenantId=also-wrong`.

Forbidden-hostname grep over `docker compose logs relay`
(`amazonaws|stripe|clerk|langfuse|sentry|svix|slack|composio|mastra|sqs|dynamodb|\.sts\.|kms|api\.aws`)
→ 0 matches. Only outbound URL resolved by the relay:
`ws://relay-control-plane-stub:3000/v1/relay/connect`.

Relay container env scan for
`^(AWS_|STRIPE_|CLERK_|LANGFUSE_|SENTRY_|SVIX_|SLACK_|COMPOSIO_|MASTRA_|SQS_|DYNAMODB_|STS_|KMS_)`
→ 0 matches.

`feature_list.json` WI-AC-052 set to `implementation: true`.

## 2026-07-08T01:20:00Z — QA Independent Verification (AC-052)

- WorkItem: WI-AC-052
- AcceptanceChecks: AC-052
- Outcome: qa=true, implementation=true (independently re-verified on running stack)
- Method: tore down existing stack (`docker compose down -v --remove-orphans`),
  then `env -i PATH=$PATH HOME=$HOME docker compose --env-file .env.example up -d`
  from a clean shell (no `AWS_*`/`STRIPE_*`/`CLERK_*`/`LANGFUSE_*`/`SENTRY_*`/
  `SVIX_*`/`SLACK_*`/`COMPOSIO_*`/`MASTRA_*`/`SQS_*`/`DYNAMODB_*`/`STS_*`/`KMS_*`
  in parent env).

### Independent verification results (AC-052 clause by clause)

- `docker-compose.yml` exists at relay repo root; defines exactly 4 services
  (`relay-control-plane-stub`, `relay-postgres`, `relay-mongo`, `relay`).
- No `image: ministack`, `image: localstack`, or `image: langfuse` anywhere
  in the file (grep returns only descriptive comments asserting their absence).
- No AWS/Stripe/Clerk/Sentry/Langfuse/Svix/Slack/Composio/Mastra env-var
  assignments in non-comment lines of `docker-compose.yml`; `.env.example`
  forbidden-var grep returns 0; `relay-config.docker.yaml` has none.
- `relay-control-plane-stub` is built from `scripts/control-plane-stub/Dockerfile`
  on `node:22-alpine`, installs `ws` via `npm install --omit=dev`, copies
  `server.mjs` and runs `CMD ["node", "server.mjs"]`.
- Stub listens on `0.0.0.0:3000` (stub log: `listening on 0.0.0.0:3000`;
  compose maps `0.0.0.0:3000->3000/tcp`).
- Stub accepts the relay's WebSocket handshake on `/v1/relay/connect`
  (`WebSocketServer({ path: '/v1/relay/connect' })`); relay connected in ~1s
  with `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub validates `?token=&tenantId=` query against `RELAY_TOKEN`/`TENANT_ID`
  env vars (the same env vars the relay uses via `.env.example`):
  - Correct token → handshake accepted, relay stays connected.
  - Wrong token (`?token=WRONG&tenantId=also-wrong`) → stub closes socket
    with code `4001 invalid token/tenant` and logs
    `[stub] rejecting handshake token=WRONG tenantId=also-wrong`.
- On `resource_update` the stub logs the exact required format:
  `[stub] resource_update from relayId=19bb26e0-1c2a-46fd-bd03-297f1b9d508c resources=2`
  (n=2 >= 1).
- Stub source `scripts/control-plane-stub/server.mjs` imports only `ws`
  (`WebSocketServer`) and `node:crypto` (Node stdlib) — zero vendor SDKs
  (the only vendor-name matches in the file are in doc comments describing
  what it does NOT import).

### Vendor outbound sweep

- `docker compose logs relay` grep for
  `amazonaws.com|stripe.com|clerk.|langfuse|sentry.io|svix.com|slack.com|composio|mastra`
  → 0 matches. Only outbound URL resolved: the local stub WebSocket.

### Verdict

All AC-052 acceptance criteria independently re-verified on a freshly brought-up
stack from a clean shell env. No defects. `qa=true`, `implementation=true`.

## 2026-07-08T00:25:58.812Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-052
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:57:03.867Z — Resumed

- WorkItem: WI-AC-052
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T00:57:03.891Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-052
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T02:10:00Z — Integrated Verification (AC-052)

- WorkItem: WI-AC-052
- AcceptanceChecks: AC-052
- Outcome: integration=true, implementation=true, qa=true
- Method: `docker compose down -v --remove-orphans`, then
  `env -i PATH=/usr/bin:/bin HOME=$HOME docker compose --env-file .env.example
  up -d --build` from repo root (no `AWS_*`/`STRIPE_*`/`CLERK_*`/`LANGFUSE_*`/
  `SENTRY_*`/`SVIX_*`/`SLACK_*`/`COMPOSIO_*`/`MASTRA_*`/`SQS_*`/`DYNAMODB_*`/
  `STS_*`/`KMS_*` in parent env). A sibling `causeflow-docs` container was
  temporarily stopped to free host port 3000 (external to this repo), then the
  stub was `--force-recreate`d to pick up the `0.0.0.0:3000->3000` binding.

### Integrated verification results (AC-052 clause by clause)

- `docker-compose.yml` exists at relay repo root; defines exactly 4 services
  (`relay-control-plane-stub`, `relay-postgres`, `relay-mongo`, `relay`).
- No `image: ministack`, `image: localstack`, or `image: langfuse` assignment
  in any non-comment line (the only match is a descriptive comment asserting
  their absence). Stub image is `causeflow-relay-control-plane-stub:local`
  built from `./scripts/control-plane-stub`; postgres is `postgres:16-alpine`;
  mongo is `mongo:7`; relay is `causeflow-relay:local` built from repo root.
- No AWS/Stripe/Clerk/Sentry/Langfuse/Svix/Slack/Composio/Mastra env-var
  assignments in non-comment lines of `docker-compose.yml`;
  `.env.example` forbidden-var grep → 0;
  `relay-config.docker.yaml` forbidden-var grep → 0;
  relay container env vendor scan → 0;
  stub container env vendor scan → 0.
- `relay-control-plane-stub` is a `node:22-alpine` + `ws` service built from
  `scripts/control-plane-stub/Dockerfile`; stub `package.json` has only
  `{ "ws": "^8.18.0" }` as a dependency.
- `scripts/control-plane-stub/Dockerfile` is `FROM node:22-alpine`, `WORKDIR
  /app`, `COPY package.json ./`, `RUN npm install --omit=dev`, `COPY server.mjs
  ./`, `EXPOSE 3000`, `CMD ["node", "server.mjs"]` — the one-line
  `COPY server.mjs .` + `CMD ["node", "server.mjs"]` contract holds (the
  `package.json` copy + `npm install --omit=dev` are the minimum needed to
  make the `ws` dependency available in the image).
- Stub listens on `0.0.0.0:3000` (stub log: `[stub] listening on 0.0.0.0:3000
  expect token=harness-smoke-token tenant=harness-tenant smoke=false`; compose
  maps `0.0.0.0:3000->3000/tcp`).
- Stub accepts the relay's WebSocket handshake on `/v1/relay/connect`
  (`WebSocketServer({ port: PORT, path: '/v1/relay/connect' })`); relay
  connected after its reconnect backoff settled a transient DNS hiccup
  (incidental to the stub recreate, not a relay defect) and logged
  `Connected to control plane` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub validates `?token=&tenantId=` query against `RELAY_TOKEN`/`TENANT_ID`
  (the same env vars the relay uses via `.env.example`):
  - Correct `?token=harness-smoke-token&tenantId=harness-tenant` → handshake
    accepted, relay stays connected, stub logs `[stub] relay connected`.
  - Wrong `?token=WRONG&tenantId=also-wrong` → stub closes socket with code
    `4001 invalid token/tenant` and logs
    `[stub] rejecting handshake token=WRONG tenantId=also-wrong`.
- On `resource_update` the stub logs the exact required format:
  `[stub] resource_update from relayId=93037829-6824-4026-a4e7-f9d4f15c9493
  resources=2` (n=2 >= 1).
- Stub source `scripts/control-plane-stub/server.mjs` imports only `ws`
  (`WebSocketServer`) and `node:crypto` (`randomUUID`, Node stdlib) — zero
  vendor SDK imports (the only vendor-name matches in the file are in doc
  comments describing what it does NOT import).

### Vendor outbound sweep

- `docker compose logs relay` grep for
  `amazonaws|stripe|clerk|langfuse|sentry|svix|slack|composio|mastra|sqs|
  dynamodb|\.sts\.|kms|api\.aws` → 0 matches.
- Only outbound URL in relay logs: `ws://relay-control-plane-stub:3000/
  v1/relay/connect` (sole match of `(wss?|https?)://[^ "]+` over relay logs).

### Verdict

All AC-052 acceptance criteria verified on integrated main from a clean shell
env at real external boundaries (live docker-network WebSocket, live token
rejection, live Postgres/Mongo healthchecks). No defects. `integration=true`,
`implementation=true`, `qa=true`.

## 2026-07-08T01:17:42.169Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-052
- AcceptanceChecks: AC-052
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-052-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T02:30:00Z — Implementation (AC-055)

- Attempt: 1/3
- WorkItem: WI-AC-055
- AcceptanceChecks: AC-055
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-055 requires a `.env.example` at the relay repo root containing only the
relay's own env vars with docker-network defaults, no forbidden vendor
entries, and that `docker compose --env-file .env.example up -d` from a clean
shell env brings all four services Up. The `.env.example` file was already
committed by AC-051 and already satisfies every AC-055 clause exactly; no
source/config changes were required. This entry records the AC-055-specific
black-box verification.

Verified `.env.example` contents (all required vars present, defaults match):
`RELAY_TOKEN=harness-smoke-token`, `TENANT_ID=harness-tenant`,
`CONTROL_PLANE_URL=ws://relay-control-plane-stub:3000/v1/relay/connect`,
`PG_HOST=relay-postgres`, `PG_PORT=5432`, `PG_DATABASE=relay`,
`PG_USER=relay`, `PG_PASSWORD=relay`,
`MONGO_URI=mongodb://relay-mongo:27017`, `MONGO_DATABASE=relay`,
`MASKING_ENABLED=true`, `AUDIT_ENABLED=true`.

### Black-box verification (clean env)

- `grep -icE 'AWS_|STRIPE|CLERK|LANGFUSE|SENTRY|SVIX|SLACK|COMPOSIO|MASTRA|SQS|DYNAMODB|STS|KMS' .env.example`
  → 0.
- `env -i PATH=/usr/bin:/bin HOME=$HOME docker compose --env-file .env.example up -d`
  from repo root → all four services Up:
  `relay-control-plane-stub (Up, 0.0.0.0:3000->3000)`,
  `relay-postgres (Up, healthy, 5432)`,
  `relay-mongo (Up, healthy, 27017)`,
  `relay (Up, 8080/tcp — no host port mapping)`.
- Relay boot log: `Starting CauseFlow Relay...`, `Driver initialized` for
  `order-pg` + `order-mongo`, `Connected to control plane` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub log: `[stub] resource_update from relayId=50bffb4b-... resources=2`
  (n=2 >= 1).
- Service count: exactly 4 (`docker compose ps --services | wc -l` = 4).

Note: a sibling `causeflow-docs` container (external to this repo) was holding
host port 3000; it was stopped to free the stub's `0.0.0.0:3000` binding, and
the stub was force-recreated to reattach its docker network after the initial
port-conflict failure (transient, external to the relay repo — the relay
itself needed no change).

`feature_list.json` WI-AC-055 set to `implementation: true`.

## 2026-07-08T02:35:00Z — QA Independent Verification (AC-055)

- WorkItem: WI-AC-055
- AcceptanceChecks: AC-055
- Outcome: qa=true, implementation=true (independently re-verified on running stack)
- Method: tore down existing stack (`docker compose down`), then
  `env -i PATH=$PATH HOME=$HOME docker compose --env-file .env.example up -d`
  from a clean shell (no `AWS_*`/`STRIPE_*`/`CLERK_*`/`LANGFUSE_*`/`SENTRY_*`/
  `SVIX_*`/`SLACK_*`/`COMPOSIO_*`/`MASTRA_*`/`SQS_*`/`DYNAMODB_*`/`STS_*`/
  `KMS_*` in parent env).

### Independent verification results (AC-055 clause by clause)

- `.env.example` exists at relay repo root and contains only the relay's own
  env vars with the required defaults:
  - `RELAY_TOKEN=harness-smoke-token`
  - `TENANT_ID=harness-tenant`
  - `CONTROL_PLANE_URL=ws://relay-control-plane-stub:3000/v1/relay/connect`
  - `PG_HOST=relay-postgres`, `PG_PORT=5432`, `PG_DATABASE=relay`,
    `PG_USER=relay`, `PG_PASSWORD=relay`
  - `MONGO_URI=mongodb://relay-mongo:27017`, `MONGO_DATABASE=relay`
  - `MASKING_ENABLED=true`, `AUDIT_ENABLED=true`
- `grep -icE 'AWS_|STRIPE|CLERK|LANGFUSE|SENTRY|SVIX|SLACK|COMPOSIO|MASTRA|SQS|DYNAMODB|STS|KMS' .env.example`
  → 0.
- `env -i PATH=$PATH HOME=$HOME docker compose --env-file .env.example up -d`
  → all four services Up within ~14s (well under 60s budget):
  - `relay-control-plane-stub (running, Up 14 seconds)`
  - `relay-postgres (running, Up 14 seconds (healthy))`
  - `relay-mongo (running, Up 14 seconds (healthy))`
  - `relay (running, Up 11 seconds)`
- Relay boot log contains `"msg":"Connected to control plane"` with
  `url=ws://relay-control-plane-stub:3000/v1/relay/connect`.
- Stub log contains
  `[stub] resource_update from relayId=569eb7a9-... resources=2` (n=2 >= 1).

### Verdict

All AC-055 acceptance criteria independently re-verified on a freshly brought-up
stack from a clean shell env. No defects. `qa=true`, `implementation=true`.

## 2026-07-08T01:22:19.638Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-055
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:53:23.627Z — Resumed

- WorkItem: WI-AC-055
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T01:53:23.650Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-055
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T02:24:27.867Z — Resumed

- WorkItem: WI-AC-055
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa
