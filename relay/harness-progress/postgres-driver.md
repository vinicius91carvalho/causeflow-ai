# postgres-driver workflow journal

## WI-AC-022 — Verify-first (postgres-driver)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

Boundary exercised at a real external boundary: a real customer PostgreSQL (`relay-postgres` container, `postgres:16-alpine`, exposed on `127.0.0.1:5432`, seeded with the `orders` table) + the real `node dist/index.js` relay process built from `src/` + a real WebSocket control-plane stub on the assigned port `127.0.0.1:5190`. No mocks of the relay, the driver, or the database.

Setup:
- `npm install` → exit 0; `npm run build` (`tsc`) → exit 0; `dist/drivers/postgres/pg-driver.js` produced.
- `relay-config.yaml` with one `postgres` resource (`order-pg`) pointing at `host=127.0.0.1 port=5432 database=relay user=relay password=relay` and `controlPlane.url = ws://127.0.0.1:5190/v1/relay/connect` (`token=harness-smoke-token`, `tenantId=harness-tenant`).
- WS stub (`node:ws` `WebSocketServer` on port 5190): accepts the relay handshake, validates `?token=&tenantId=`, waits for the relay's `resource_update` on connect, then sends one JSON-RPC 2.0 `execute` request `{ method:'execute', params:{ resourceId:'order-pg', operation:'list_tables', params:{} } }` with `id:'ac022-1'`, and captures the JSON-RPC response.

Captured JSON-RPC response from the relay (real Postgres round-trip):

```json
{"jsonrpc":"2.0","id":"ac022-1","result":{"rows":[{"table_name":"orders","table_type":"BASE TABLE"}],"rowCount":1,"fields":[{"name":"table_name","type":"text"},{"name":"table_type","type":"text"}],"executionTimeMs":14,"masked":false,"maskedFieldCount":0}}
```

AC-022 contract checks (all pass):
- The `execute` request with `operation: 'list_tables'` reaches the configured Postgres database. The stub recorded the relay connection (`token=harness-smoke-token tenantId=harness-tenant`), the relay's `resource_update`, then sent the `execute` request and received the response. ✓
- The driver runs exactly `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` (`src/drivers/postgres/pg-driver.ts` `list_tables` branch). ✓
- The rows are returned as `rows` = `[{ table_name: 'orders', table_type: 'BASE TABLE' }]` — the verbatim `information_schema.tables` rows for the `public` schema, ordered by `table_name`. ✓ (verified independently via `psql` that the same query returns the same single row).
- `fields` = `[{ name: 'table_name', type: 'text' }, { name: 'table_type', type: 'text' }]` — the hardcoded field descriptor returned by the `list_tables` branch, exactly matching the AC. ✓

Root-cause fix: none. The existing `PgDriver.execute` `list_tables` branch already emits the spec SQL, the spec `rows`, and the spec `fields`. No code was changed; `git diff` is empty after removing the throwaway stub script. `npx tsc --noEmit` remains exit 0.

### Out of scope

Other Postgres operations (`describe_table` AC-023, `query` AC-024/025, `explain` AC-026, `healthCheck` AC-027) and the SQL parser checks (AC-028–030) are separate work items. AC-022's boundary is `list_tables` only, which passes.
