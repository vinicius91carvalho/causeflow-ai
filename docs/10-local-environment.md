# 10 — Local Environment (Development Setup)

[< Back to index](./00-index.md) | [Previous: AWS Infrastructure](./09-aws-infrastructure.md) | [Next: Testing >](./11-testing.md)

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 22+ | Application runtime |
| pnpm | 8+ | Package manager (NEVER use npm) |
| Docker + Docker Compose | 20+ | LocalStack (emulates AWS) |
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

Edit `.env` and fill in at least:

```bash
# Required for AI to work (triage, investigation, memory/chat):
ANTHROPIC_API_KEY=sk-ant-...

# The rest works with default values for dev
NODE_ENV=development
PORT=3000
```

> **Note:** `ANTHROPIC_API_KEY` is shared across triage, investigation, and the
> memory/chat endpoints — not just the investigation pipeline.

#### Environment Variables Reference

All external integrations below **stub gracefully when their credentials are absent**
(empty strings resolve to no-op clients), so you can run the backend locally with
only `ANTHROPIC_API_KEY` set and still boot every module. Fill in the ones you
need for the flow you're working on.

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

**AI — Anthropic**

| Var | Required? | Purpose |
|-----|-----------|---------|
| `ANTHROPIC_API_KEY` | **Required** | Used by triage, investigation, memory/chat, and all sub-agents |
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

### 4. Start Local Infrastructure (LocalStack)

```bash
docker-compose up -d
```

This starts:
- **DynamoDB Local** (port 8000)
- **Redis** (port 6379)
- **LocalStack** (ports 4566, 4592) — emulates SQS, STS, KMS, CloudWatch

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

Use `pnpm dev` for the pure-local (LocalStack docker-compose) loop; use
`local-up.sh` when you need Hindsight + real staging secrets.

### 6. Verify It Works

```bash
curl http://localhost:3000/health
# → { "status": "ok" }

curl http://localhost:3000/health/detailed
# → { "status": "healthy", "services": { "dynamodb": { "status": "healthy" }, ... } }
```

---

## docker-compose.yml Structure

```yaml
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    ports: ["8000:8000"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  localstack:
    image: localstack/localstack:latest
    ports: ["4566:4566"]
    environment:
      - SERVICES=sqs,sts,kms,cloudwatch,logs
    volumes:
      - ./infra/localstack/init-aws.sh:/etc/localstack/init/ready.d/init-aws.sh
```

### What the init script does (`infra/localstack/init/01-create-resources.sh`):

```bash
# Creates the SQS queues (4 queues + 4 DLQs)
awslocal sqs create-queue --queue-name causeflow-alerts
awslocal sqs create-queue --queue-name causeflow-alerts-dlq
awslocal sqs create-queue --queue-name causeflow-investigation
awslocal sqs create-queue --queue-name causeflow-investigation-dlq
awslocal sqs create-queue --queue-name causeflow-remediation
awslocal sqs create-queue --queue-name causeflow-remediation-dlq
awslocal sqs create-queue --queue-name causeflow-progress
awslocal sqs create-queue --queue-name causeflow-progress-dlq

# Creates the KMS key
awslocal kms create-alias --alias-name alias/causeflow-token-encryption \
  --target-key-id $(awslocal kms create-key --query 'KeyMetadata.KeyId' --output text)

# Creates the DynamoDB table (if it doesn't exist — ElectroDB handles it in the app)
```

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
docker-compose up -d      # Start LocalStack + Redis + DynamoDB
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

### "Cannot connect to DynamoDB"
```
Cause: Docker is not running or DynamoDB Local failed to start
Fix: docker-compose up -d && docker-compose ps
```

### "ECONNREFUSED 127.0.0.1:6379" (Redis)
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
