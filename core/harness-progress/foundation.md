# foundation workflow journal

## WI-AC-001 — Verify-first (foundation)

**Result: implementation=true**

Boundary exercised against the running docker-compose stack (real HTTP/CLI, no mocks).

- `docker compose up -d ministack redis postgres langfuse hindsight` → ministack, redis, langfuse, hindsight all `(healthy)` within ~23s (< 60s).
- `curl http://localhost:4566/_ministack/health` → 200.
- `awslocal dynamodb list-tables` → `causeflow` table present.
- `awslocal sqs list-queues` → 8 URLs (alerts, investigation, remediation, progress + 4 DLQs).
- `awslocal kms list-aliases` → `alias/causeflow-token-encryption`.

### Root-cause fixes (smallest diff, `core/docker-compose.yml` only)

The existing code failed AC-001 in three independent ways; each was fixed at its root cause with no refactor:

1. **Init script never ran** — ministack's `/etc/localstack/init/ready.d` was empty. Mounted `./infra/localstack/init` there so `01-create-resources.sh` + `02-ecs-ecr.sh` auto-run on ready (table/queues/KMS alias now created).
2. **ministack/redis/postgres/langfuse never reported healthy** — (a) ministack image has no `curl`; switched its healthcheck to `python3` urllib. (b) redis/postgres had no healthcheck; added `redis-cli ping` and `pg_isready`. (c) langfuse raced postgres (Prisma P1001); made it `depends_on: postgres: condition: service_healthy`. (d) langfuse Next.js bound only to the container IP and busybox `wget` resolves `localhost` to IPv6 `::1` first (refused); set `HOSTNAME=0.0.0.0` and pointed the healthcheck at `127.0.0.1`.
3. **hindsight crashed on boot** — `HINDSIGHT_API_LLM_API_KEY` defaulted to empty (MemoryEngine requires non-empty); defaulted to a dev placeholder so the container boots and `/health` passes. A real key still wins via `ANTHROPIC_API_KEY`.

### Out of scope

The full literal `docker compose up -d` (all services) still errors on missing `./samples/*` customer-app build contexts. Those samples belong to later relay/customer-VPC/e2e work items (not the foundation context); AC-001's explicit boundary is the four infra containers + init resources + health curl, all of which pass. Not addressed here per the no-restructure rule.
