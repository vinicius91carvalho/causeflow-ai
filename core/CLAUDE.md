# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
CauseFlow — AI SRE platform. Modular monolith (Modlito) + Clean Architecture. 15 modules, single Node.js process.

## Stack
- TypeScript + Node.js 22 + Hono + ElectroDB (DynamoDB Single Table)
- Redis (cache) + SQS (4 queues + 4 DLQs) + Mastra agent framework + Anthropic SDK
- pnpm (NEVER npm)

## Commands

```bash
pnpm dev              # start dev server (tsx watch, uses .env.dev)
pnpm build            # compile TypeScript
pnpm typecheck        # type check without emit
pnpm lint             # ESLint
pnpm lint:fix         # ESLint auto-fix
pnpm test:run         # unit tests (~10s, no I/O)
pnpm test:integration # integration tests (requires docker-compose up)
pnpm test:e2e         # E2E tests (requires docker-compose up + pnpm dev)
pnpm lint-invariants  # verify architectural invariants (I1–I7)
```

Single test: `pnpm test:run tests/unit/modules/<module>/<file>.test.ts`

Integration tests require: `docker-compose up -d` (LocalStack SQS/STS/KMS + DynamoDB Local + Redis)

## Architecture

### Module Structure (15 modules)
`src/modules/`: tenant, auth, user, billing, ingestion, triage, investigation, remediation, memory, code-intelligence, skills, widget, notification, integration, audit

Each module has `domain/` + `application/` + `infra/` layers.

### Dependency Rule (HARD)
```
Infra → Application → Domain
```
- **Domain**: pure TypeScript types only — zero external imports. Entities, value objects, errors, repository interfaces
- **Application**: use cases + DTOs. Can import Domain. NEVER import Infra/SDKs
- **Infra**: implements ports. Routes (Hono), repositories (ElectroDB), adapters

### Module Communication (only 2 ways allowed)
1. **EventBus** (in-process pub/sub) — publish domain events, other modules subscribe
2. **Type imports** from another module's `domain/` only — never use cases or infra

Cross-module direct function calls are forbidden.

### Composition Root
`src/bootstrap.ts` — the ONLY place concrete implementations couple to abstractions. All repositories, use cases, and routes are wired here.

### Ports (16 interfaces in `src/shared/application/ports/`)
Key ports: `llm-client.port.ts`, `cloud-provider.port.ts`, `agent-runner.port.ts`, `agent-memory.port.ts`, `message-queue.port.ts`, `credential-vendor.port.ts`, `token-encryption.port.ts`

### ElectroDB / DynamoDB
28 ElectroDB entities in `src/shared/infra/db/entities/` — all share a **single DynamoDB table** (one PK/SK, 3 GSIs). Repository interfaces defined in domain, implementations in infra.

### AI Agent Pipeline
Scout → Foundational (log, metric, change, code agents) → Analysts (infra, DB) → Synthesis. Model routing: Haiku for logs/metrics, Sonnet for code/infra/synthesis. ~$0.70/investigation. Langfuse traces per-agent cost/latency.

### SQS Queue Flow
```
alerts → triage → triaged incident
investigation → agents run
remediation → executes fix
progress → SSE stream to client
```

### HTTP Middleware Order
`errorHandler → CORS → requestId → auth(Clerk) → tenant → rateLimit → audit → requestLogger → routes`

## File Conventions
- Entity types: `{name}.entity.ts` (pure types, no class)
- Repository interfaces: `{name}.repository.ts` in `domain/`
- Use cases: `{action}-{entity}.usecase.ts`
- Routes: `{module}.routes.ts`
- ElectroDB entities: `{Name}Entity.ts` in `shared/infra/db/entities/`

## TypeScript Paths
- `@/` → `src/`
- `@shared/` → `src/shared/`
- `@modules/` → `src/modules/`

## Test Levels
| Level | Command | Time | I/O |
|-------|---------|------|-----|
| Unit | `test:run` | ~10s | all mocked |
| Integration | `test:integration` | ~30s | real LocalStack |
| E2E | `test:e2e` | ~2min | API real, Claude stubbed |
| Smoke | `test:smoke` | ~5min | everything real (post-deploy) |
| LLM Eval | `test:eval` | varies | real Claude (Promptfoo) |

## Language
- Code: English
- Communication with user: Portuguese (pt-BR)
