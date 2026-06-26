# Smoke Tests

## Overview

Smoke tests validate that CauseFlow works end-to-end with **real AWS services** (CloudWatch Logs, CloudWatch Metrics via LocalStack) while using stub LLM/AgentRunner. They exercise the full customer flow via HTTP.

## Prerequisites

1. **Docker Compose** running:
   ```bash
   docker compose up -d
   ```
   This starts:
   - LocalStack A (port 4566) — CauseFlow infra (DynamoDB, SQS)
   - LocalStack B (port 4567) — Customer environment (CloudWatch, STS)
   - PostgreSQL (port 5432) — Customer payment-service DB
   - payment-service (port 3100) — Customer app with fault injection

2. **Wait for services** to be healthy (automatic via test setup)

## Running

```bash
# Run all smoke tests
pnpm test:smoke

# With GitHub integration (optional — loads secrets from .env.smoke.local)
pnpm test:smoke
```

## Architecture

```
payment-service (Docker)
    |
    ├── PutLogEvents → LocalStack Customer (4567)
    └── PutMetricData → LocalStack Customer (4567)

CauseFlow (in-process, HTTP server on port 3099)
    |
    ├── HTTP API ← CauseFlowApiClient (JWT + HMAC auth)
    ├── AWSCloudProvider → reads real CW data from LocalStack Customer
    ├── STSCredentialVendor → tenant-aware role resolution
    └── LLM + AgentRunner → stubs (DeterministicLLMClient/AgentRunner)
```

## Test Scenarios

| Scenario | What it tests |
|----------|---------------|
| **memory-leak** | Memory pressure logs in CW → alert via HTTP → investigation with real log data |
| **pool-exhaust** | Connection pool errors in CW → alert via HTTP → investigation |
| **latency-spike** | Slow query logs in CW → alert via HTTP → investigation |
| **full-lifecycle** | Complete customer onboarding: create tenant → configure AWS → send alert → investigate → remediate |
| **github-integration** | GitHub App webhook simulation (optional, skips if not configured) |

## Fault Injection Endpoints

The customer payment-service exposes fault injection:

```bash
POST http://localhost:3100/fault/memory-leak
POST http://localhost:3100/fault/pool-exhaust
POST http://localhost:3100/fault/slow-query
POST http://localhost:3100/fault/high-error-rate
POST http://localhost:3100/fault/reset
```

## Configuration

All smoke test config is in `.env.smoke`. GitHub-specific secrets go in `.env.smoke.local` (gitignored).

## Timeouts

- Test timeout: 180s
- Hook timeout: 120s
- Tests run sequentially (no parallelism)
