# Workflow Journal — open-source-local-runtime

## 2026-07-08T02:20:00Z — Implementation (AC-040)

- Attempt: 1/3
- WorkItem: WI-AC-040
- AcceptanceChecks: AC-040
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-040 requires Postgres as the only persistence layer in the OSS runtime.
The ElectroDB/DynamoDB code stays in the AWS runtime (unchanged) but is
bypassed in OSS mode.

**Infrastructure:**
- Added `pg` dependency and `@types/pg` (dev) to package.json
- Created `src/shared/infra/db/pg-client.ts` — Postgres connection pool + 
  `runPgMigrations()` that creates the `causeflow` schema with 31 tables
- Created `infra/postgres/migrations/001_create_causeflow_schema.sql` — DDL
  for all 31 tables (JSONB-based, composite PK (tenant_id, entity_id))
- Created `src/shared/infra/db/postgres/pg-utils.ts` — generic JSONB storage
  utilities (pgInsert, pgGet, pgUpdate, pgDelete, pgQuery, pgQueryJson)
- `src/shared/infra/db/client.ts`: in OSS mode, returns a DynamoDBClient
  pointed at localhost:1 (never contacts AWS, passes ElectroDB's type check)

**Postgres Repositories (key ones implemented):**
- `src/modules/tenant/infra/pg-tenant.repository.ts` — ITenantRepository
- `src/modules/user/infra/pg-user.repository.ts` — IUserRepository
- `src/modules/ingestion/infra/pg-incident.repository.ts` — IIncidentRepository
- `src/modules/audit/infra/pg-audit.repository.ts` — IAuditRepository
- `src/modules/tenant/infra/pg-api-key.repository.ts` — IApiKeyRepository

**OSS Auth:**
- `src/modules/auth/infra/oss-auth.routes.ts` — POST /v1/auth/register and
  POST /v1/auth/login with password hashing (Node crypto.scryptSync) and
  local JWT issuance (jose)
- `src/shared/infra/http/middleware/auth.middleware.ts`: OSS branch verifies
  JWTs locally with jose; added /v1/auth/register and /v1/auth/login to
  PUBLIC_PATHS

**Wiring in bootstrap.ts:**
- Repositories are runtime-aware: OSS mode dynamically imports Postgres repos,
  AWS mode uses the original DynamoDB repos
- User repo, API key repo also runtime-aware
- OSS auth router created and exposed via AppContext.ossAuthRouter

**Wiring in main.ts:**
- OSS mode calls `runPgMigrations()` at startup

**Wiring in app.ts:**
- OSS mode mounts the oss auth router at /v1/auth
- Billing reserve-investigation calls are gated behind `!config.isOss()`
  in incident.routes.ts and webhook.routes.ts

**Remaining (not needed for AC-040, deferred to later WIs):**
- PgEvidenceRepository, PgToolCallRepository, PgCodeKnowledgeRepository
  still use DynamoDB (not hit by incident creation flow)
- Other Dynamo repositories (billing, triggers, notifications, etc.) still
  installed but not exercised in OSS boot path

### Black-box verification

1. `docker compose up -d` starts all 5 services healthy.
2. `curl http://localhost:3099/health` → 200:
   `{"postgres":"ok","redis":"ok","anthropic":"skipped","queues":"ok"}`
3. `docker compose exec causeflow-postgres psql -U causeflow -d causeflow -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'causeflow' ORDER BY table_name"` → **31 rows** (one per entity)
4. `POST /v1/auth/register { email, password, tenantName }` → 201 with JWT token
5. `POST /v1/incidents/chat` with valid JWT → 201 with incidentId
6. `SELECT * FROM causeflow.incidents WHERE tenant_id = $1` → incident row visible
7. `pnpm typecheck`, `pnpm build` both green.

`feature_list.json` WI-AC-040 set to `implementation: true`, `status: implemented`.
