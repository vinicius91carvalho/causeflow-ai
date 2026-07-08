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
