# 10 — Local Environment (Development Setup)

[< Back to index](./00-index.md) | [Previous: AWS Infrastructure](./09-aws-infrastructure.md) | [Next: Testing >](./11-testing.md)

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 22+ | Application runtime |
| pnpm | 8+ | Package manager (NEVER use npm) |
| Docker + Docker Compose | 20+ | OSS local runtime (Postgres, Redis, Hindsight, Core, worker) |
| Git | 2.30+ | Version control |

---

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone git@github.com:causeflow/core.git
cd core
git submodule update --init --recursive  # Updates submodules (relay, samples)
```

### 2. Install Dependencies

```bash
pnpm install
```

**NEVER use `npm install`!** The project uses pnpm. If you use npm, it will create a
`package-lock.json` that conflicts with `pnpm-lock.yaml`.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

The default `.env.example` is enough for the open-source Docker runtime. It
uses Postgres, Redis, bundled Hindsight, local JWT auth, AES-GCM token
encryption, and the local Ornith-compatible LLM connector. `ANTHROPIC_API_KEY`
is optional; when unset, triage and investigation use the OpenAI-compatible
local connector configured by compose.

Edit `.env` only when you need an override:

```bash
# Optional Anthropic override for AI:
ANTHROPIC_API_KEY=sk-ant-...

# The local API is published on 3099; PORT is the in-container port.
PORT=5171
```

> **Note:** For local Docker, keep `JWT_SECRET` aligned between Core and the
> dashboard. The defaults already match.

#### Environment Variables Reference

All SaaS integrations below **stub gracefully when their credentials are absent**,
so the OSS runtime boots without AWS, Stripe, Clerk, Sentry, Langfuse, Svix,
Slack, Composio, or Mastra credentials. Fill in only the services you are
working on.

**OSS runtime**

| Var | Required? | Purpose |
|-----|-----------|---------|
| `DATABASE_URL` | Required in containers | Postgres connection string |
| `REDIS_URL` | Required in containers | Redis/BullMQ connection string |
| `JWT_SECRET` | Required | Local JWT signing secret shared with the dashboard |
| `TOKEN_ENCRYPTION_KEY` | Required | 32-byte hex AES-GCM key for token encryption |
| `LLM_BASE_URL` / `LLM_MODEL` | Optional | OpenAI-compatible local LLM connector override |

**Auth — Clerk** (required for authenticated routes, webhooks)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `CLERK_SECRET_KEY` | Required for auth | Backend Clerk SDK key |
| `CLERK_PUBLISHABLE_KEY` | Frontend only | Consumed by dashboard, not backend |
| `CLERK_WEBHOOK_SECRET` | Required for webhooks | Verifies Clerk → backend user events |

**Billing — Stripe** (required for subscription + metered billing flows)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `STRIPE_SECRET_KEY` | Required for billing | Backend Stripe SDK key |
| `STRIPE_WEBHOOK_SECRET` | Required for webhooks | Verifies Stripe events |
| `STRIPE_PUBLISHABLE_KEY` | Frontend only | Consumed by dashboard |
| `STRIPE_INVESTIGATION_METER_ID` / `STRIPE_EVENT_METER_ID` | Optional | Metered usage reporting |
| `STRIPE_{STARTER,PRO,BUSINESS}_PRICE_ID` (+ `_FLAT`, `_INV`, `_EVT` variants) | Optional | Plan price IDs |

**Integrations — Composio** (required for triggers and tool registry)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `COMPOSIO_API_KEY` | Required for integrations | Toolkit API |
| `COMPOSIO_BASE_URL` | Optional | Override default endpoint |
| `COMPOSIO_WEBHOOK_SECRET` | Optional | Falls back to `COMPOSIO_API_KEY` if unset |

**Agent Memory — Hindsight** (optional, stubs when missing)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `HINDSIGHT_BASE_URL` | Optional | Hindsight service URL (e.g. `http://localhost:8888`) |
| `HINDSIGHT_API_KEY` | Optional | Hindsight auth token |

**Observability — Langfuse** (optional, stubs when missing)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `LANGFUSE_PUBLIC_KEY` | Optional | Langfuse ingest key |
| `LANGFUSE_SECRET_KEY` | Optional | Langfuse secret |
| `LANGFUSE_BASE_URL` | Optional | Self-hosted Langfuse URL (`LANGFUSE_HOST` equivalent) |

**AI — Anthropic or OpenAI-compatible connector**

| Var | Required? | Purpose |
|-----|-----------|---------|
| `ANTHROPIC_API_KEY` | Optional in OSS | When set, overrides the local connector for triage, investigation, memory/chat, and sub-agents |
| `ANTHROPIC_TRIAGE_MODEL` / `ANTHROPIC_INVESTIGATION_MODEL` / `ANTHROPIC_SYNTHESIS_MODEL` | Optional | Model overrides (default: `claude-sonnet-4-6`) |

**Runner feature flags — Enhanced Runner** (all optional, default `false`)

| Var | Required? | Purpose |
|-----|-----------|---------|
| `ENHANCED_RUNNER_ENABLED` | Optional | Enables the enhanced investigation runner path |
| `ENHANCED_RUNNER_SCOUT_AGENT` | Optional | Enables Wave 0 `scout` agent |
| `ENHANCED_RUNNER_TENANT_SKILLS` | Optional | Enables tenant-scoped skill selection |
| `ENHANCED_RUNNER_VERIFICATION_AGENT` | Optional | Enables Wave 3 `diagnosis_verifier` |
| `ORCHESTRATOR_MODE_ENABLED` | Optional | Single-agent orchestrator mode instead of wave pipeline |
| `MASTRA_ENABLED` | Optional | When `true`, the investigation worker uses `MastraAgentRunner` instead of `EnhancedPTCRunner` (drop-in Phase 1 replacement — same tools, same cost math, no PTC code execution). Default `false`. |

### 4. Start the OSS Runtime

```bash
docker-compose up -d
```

This starts:
- **Postgres** (host port 5439)
- **Redis** (host port 6380)
- **Hindsight** (ports 8888, 9999)
- **Core API** (host port 3099, container port 5171)
- **Core worker** (BullMQ consumer)
- **Test app** (host port 5190)

Verify everything is running:
```bash
docker-compose ps
```

### 5. Start the Development Server

```bash
pnpm dev
```

This uses `tsx watch` — compiles and restarts automatically when files are saved.

#### Alternative: one-command startup with `scripts/local-up.sh`

For an end-to-end local setup that boots Redis + MiniStack (AWS emulator) +
Hindsight and then starts the backend against a staging-like env, use:

```bash
./scripts/local-up.sh
```

What it does:

1. Requires `.env.staging` (fetch with `scripts/pull-env.sh`)
2. Starts `redis`, `ministack`, and `hindsight` via docker compose
3. Waits for MiniStack (`http://localhost:4566/_ministack/health`) and Hindsight
   (`http://localhost:8888/health`) to become ready
4. Creates the DynamoDB `causeflow-staging` table + SQS queues
5. Kills anything on port 3000 and launches the backend with `tsx src/main.ts`

Use `pnpm dev` for the host development loop; use `local-up.sh` only when you
need its staging-like MiniStack path.

### 6. Verify It Works

```bash
curl http://localhost:3099/health
# → { "status": "ok" }

curl http://localhost:3099/health/detailed
# → { "status": "healthy", "services": { "postgres": { "status": "healthy" }, ... } }
```

---

## docker-compose.yml Structure

```yaml
services:
  causeflow-postgres:
    image: postgres:16-alpine
    ports: ["5439:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6380:6379"]

  causeflow-api:
    build: .
    ports: ["3099:5171"]
```

For AWS-backed development, use `docker-compose.aws.yml`; the default compose
file is intentionally AWS-free.

---

## Useful Commands

### Development

```bash
pnpm dev              # Start server (hot reload)
pnpm build            # Compile TypeScript to JavaScript
pnpm typecheck        # Check types without compiling
pnpm lint             # ESLint
```

### Testing

```bash
pnpm test:run         # Unit tests (no Docker needed)
pnpm test:integration # Integration tests (requires Docker)
pnpm test:e2e         # End-to-end tests
pnpm test:smoke       # Smoke tests
```

### Infrastructure

```bash
docker-compose up -d      # Start Postgres + Redis + Hindsight + API + worker
docker-compose down       # Stop everything
docker-compose logs -f    # View logs
docker-compose ps         # Container status
```

### Utilities

```bash
pnpm eval:triage          # Triage quality evaluation
pnpm eval:pipeline        # Full pipeline evaluation
```

---

## Common Issues

### "Cannot connect to Postgres"
```
Cause: Docker is not running or the Postgres container failed to start
Fix: docker-compose up -d && docker-compose ps
```

### "ECONNREFUSED 127.0.0.1:6380" (Redis)
```
Cause: Redis is not running
Fix: docker-compose up -d redis
```

### "npm ERR!" or "package-lock.json"
```
Cause: Used npm instead of pnpm
Fix: rm -rf node_modules package-lock.json && pnpm install
```

### "ANTHROPIC_API_KEY not set"
```
Cause: Missing the Anthropic API key in .env
Fix: Add ANTHROPIC_API_KEY=sk-ant-... to .env
Note: This key is used by triage, investigation, AND memory/chat —
      expect failures across all three if it's missing.
```

### Clerk / Stripe / Composio routes return empty data
```
Cause: Integration credentials are absent (the client stubs gracefully
       instead of crashing, so the server still boots).
Fix: Populate CLERK_SECRET_KEY / STRIPE_SECRET_KEY / COMPOSIO_API_KEY
     in .env for the flow you're testing. See Environment Variables
     Reference above.
```

### "ENOMEM" or "heap out of memory"
```
Cause: Node.js ran out of memory
Fix: export NODE_OPTIONS="--max-old-space-size=4096"
```

[Next: Testing >](./11-testing.md)
