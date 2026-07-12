# 01 — CauseFlow Overview

[< Back to index](./00-index.md) | [Next: Architecture >](./02-architecture.md)

---

## What is CauseFlow?

CauseFlow is an **AI-powered platform for Engineering and Customer Support teams**. In simple terms:

> When a production system has a problem — whether detected by monitoring tools
> or reported by customers — CauseFlow automates the entire investigation process
> that an engineer or L2/L3 support agent would handle manually.

### What it does, step by step:

```
1. RECEIVES the alert automatically (Datadog, Grafana, CloudWatch, Sentry via webhook)
   — OR —
   An operator or support agent CREATES an incident from a customer report (Dashboard/API,
   chat-driven entry via the Memory module, or the embeddable Widget customer portal)
2. CLASSIFIES severity using AI (automated triage)
3. INVESTIGATES the root cause with multiple AI agents in parallel
   - One analyzes logs
   - Another analyzes metrics (CPU, memory, network)
   - Another checks infrastructure (pods, containers, services)
   - Another checks recent changes (deploys, config changes)
   - Another analyzes source code (if GitHub is connected)
4. PROPOSES a fix (including creating Pull Requests automatically!)
5. REQUESTS HUMAN APPROVAL before executing any action
6. EXECUTES the remediation (restart service, scale containers, etc.)
7. LEARNS from each incident to be faster next time
```

Each investigation consumes **1 investigation** from the tenant's plan. Each incoming
alert processed through triage consumes **1 event**. Both are included in the plan
and can be purchased when limits are reached.

### Two Use Cases

| | Infrastructure Incidents (SRE) | Customer-Reported Issues (Support) |
|---|---|---|
| **Entry point** | Monitoring alert (webhook) | Dashboard/API, chat (Memory module), or embeddable Widget portal |
| **Who triggers** | Datadog, Grafana, CloudWatch, Sentry | L2/L3 support agent or end customer (via Widget) |
| **Investigation** | Logs, metrics, infrastructure, code, recent changes | Same + tenant documentation (Notion, Shortcut — planned) |
| **Output** | Technical root cause + remediation proposal | Technical root cause + customer-facing explanation (planned) |
| **Knowledge Base** | Patterns speed up future investigations | Known solutions enable L1 resolution without escalation |

Think of CauseFlow as a **"virtual incident investigator"** — for SRE teams it's an on-call engineer that never sleeps; for support teams it's an L2/L3 specialist that instantly investigates customer-reported issues. It gets smarter with every incident it resolves.

---

## An Analogy to Understand It

Imagine a hospital:

| Hospital | CauseFlow |
|----------|-----------|
| Patient arrives in pain | Alert arrives (monitoring) or customer reports a problem (support team) |
| Nurse performs triage (severity) | AI agent classifies severity |
| Specialist doctors examine | AI agents investigate in parallel |
| Medical board decides on treatment | AI synthesizes and proposes remediation |
| Patient (or guardian) authorizes surgery | Human approves the action |
| Surgeon operates | System executes the remediation |
| Medical record is updated | Audit trail records everything |
| Hospital learns from the case | Knowledge module extracts pattern |

---

## Market Positioning

CauseFlow positions itself as "the Brazilian Resolve.ai":
- **Resolve.ai** — American startup valued at $1B that does something similar
- **CauseFlow differentiators:**
  - Focus on the Brazilian market and LGPD compliance
  - More granular credential isolation (session policies per sub-agent)
  - Audit trail with immutable hash chain (tamper-proof)
  - Native multi-tenancy with plans and rate limiting
  - Bridges infrastructure monitoring and customer support — a gap most competitors don't address

---

## Business Model

CauseFlow is a multi-tenant SaaS where each tenant (company/team) pays a monthly
subscription that includes a fixed number of **investigations** and **events**. Tenants
are completely isolated — one never sees another tenant's data. Authentication is handled
via **Clerk** (sessions, organizations, RBAC) and subscriptions plus metered usage are
billed through **Stripe**.

### Billing Units

- **Investigation** = 1 full investigation cycle (triage → multi-agent investigation → Opus synthesis → remediation proposal)
- **Event** = 1 incoming alert or customer report processed through AI triage (classification + deduplication)

Both are included in the plan. Both are consumed as the system works. Both can be purchased when limits are reached.

### Plans and Pricing ([causeflow.ai/pricing](https://causeflow.ai/pricing))

| Plan | Monthly | Annual (15% off) | Investigations/mo | Events/mo | Rate Limit |
|------|---------|------------------|-------------------|-----------|------------|
| **Starter** | $99 | $84/mo | 15 | 500 | 100 req/min |
| **Pro** | $349 | $297/mo | 60 | 3,000 | 500 req/min |
| **Business** | $899 | $719/mo | 200 | 10,000 | 2,000 req/min |
| **Enterprise** | Custom (min $2,000) | Negotiated | Custom | Custom | Custom |

- **Overage options:** When limits are reached, tenants choose: **auto-charge** (billed at overage rate, no interruption) or **buy quota packs** (purchase additional investigations/events from the Dashboard)
- **Overage rates:** $8.99/extra investigation, $0.20/extra event
- **Quota packs:** 10 investigations for $79, 1,000 events for $99
- **Notifications:** Alerts at 80% and 100% usage

### How Billing Works

```
Alert or customer report arrives
    │
    ▼
Triage (AI classification + dedup) → CONSUMES 1 EVENT
    │
    ├─ Severity < high → Stays in monitoring (no investigation consumed)
    │
    └─ Severity >= high → Investigation starts → CONSUMES 1 INVESTIGATION
                          │
                          ├─ Quota available → Proceeds normally
                          ├─ Quota exhausted + auto-charge → Billed at overage rate, proceeds
                          └─ Quota exhausted + manual → Queued + tenant notified
```

### Unit Economics

| Metric | Value |
|--------|-------|
| Variable cost per investigation | **$0.70 average** (AI tokens via Anthropic API) |
| Variable cost per event (triage) | **$0.02 average** (AI classification) |
| Worst case per investigation (P90) | **$1.50–2.00** (complex incidents, all agents) |
| Shared infrastructure | ~$150/month total (not per-tenant) |
| Break-even | 2 Starter tenants cover entire infrastructure |

> **Why $0.70 and not $0.21?** The original $0.21 estimate was based on theoretical minimum
> token usage. Promptfoo test scenarios showed agents use 3–5 tool calls each (not 1–2),
> and Opus synthesis receives much larger context than estimated. See
> [Implementation Backlog — AI Cost Reality](../../implementation_backlog.md#ai-cost-reality--updated-analysis-march-2026)
> for the full analysis.

### Projected Margins (at realistic blended cost)

| Scenario | Tenants | MRR | AI Costs (blended) | Infra | Margin |
|----------|---------|-----|---------------------|-------|--------|
| Early stage | 10 (5S/3P/2B) | $3,543 | ~$830 | ~$150 | **72%** |
| Growth | 50 (25S/15P/10B) | $17,715 | ~$4,150 | ~$300 | **75%** |
| Scale | 200 (100S/60P/30B) | $66,600 | ~$16,000 | ~$500 | **75%** |

### Market Reference & ROI

| Reference | Value |
|-----------|-------|
| Resolve.ai (enterprise competitor) | ~$2,000–5,000/month |
| SRE hourly cost | ~$150–250/hour |
| L2/L3 support engineer hourly cost | ~$80–120/hour |
| CauseFlow Starter cost per investigation | ~$6.60/investigation |
| **ROI (Starter)** | 15 investigations × 2h saved × $150/h = **$4,500 saved vs $99 cost → 45× ROI** |
| **ROI (Pro)** | 60 investigations × 3h saved × $150/h = **$27,000 saved vs $349 cost → 77× ROI** |

### Event Cost Strategy

Every incoming alert goes through AI triage (classification + deduplication). Each triage
consumes 1 event from the plan allowance. This costs ~$0.02/event in AI tokens.

Each plan includes a monthly event allowance. Limits protect margins from "noisy" tenants
sending thousands of low-value alerts, while the overage options ensure no alerts are
permanently lost — they're either auto-charged or queued for purchase.

| Customer Profile | Events/month | Investigations | Event Cost | Revenue |
|-----------------|-------------|----------------|------------|---------|
| Quiet Starter | 100 | 5 | $2 | $99 |
| Active Pro | 2,500 | 45 | $50 | $349 |
| Enterprise | 8,000 | 150 | $160 | $2,000+ |

---

## Technology Stack (Summary)

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | TypeScript (strict) | Type-safety, same frontend/backend ecosystem |
| Runtime | Node.js 22 | Mature ecosystem, official Anthropic SDK |
| Web Framework | Hono | Ultra-lightweight (~14KB), native typing, native SSE |
| Database | Postgres in OSS/local; DynamoDB in AWS-backed deployments | Local durability without AWS; serverless option for hosted deployments |
| Cache | Redis (ioredis) | Rate limiting, session cache |
| Queues | BullMQ/Redis in OSS/local; SQS in AWS-backed deployments | Decouple sync/async investigation work |
| AI | Local OpenAI-compatible connector by default; Anthropic override supported | Runs without paid credentials locally |
| Agent Framework | Enhanced runner / local worker path; Mastra optional | Multi-step agentic investigation loop |
| LLM Observability | Langfuse | Tracing for every AI call |
| IaC | AWS CDK | Infrastructure as code, same TS ecosystem |
| Local Dev | Docker OSS runtime | Postgres, Redis, Hindsight, Core API, worker |
| Testing | Vitest + Promptfoo | Unit/integration/e2e + LLM quality evaluation |
| Package Manager | **pnpm** (NEVER npm) | 3x faster, saves disk space |

---

## Concepts You Need to Know

If any of these concepts are new to you, don't worry — each one is explained
in detail in the following documents:

- **Clean Architecture** — how code is organized in layers (doc 02)
- **Modular Monolith (Modlito)** — a monolith divided into **15 modules** (doc 02): tenant, auth (Clerk), user, billing (Stripe), ingestion, triage, investigation, remediation, memory (chat + agent long-term recall), code-intelligence, skills (custom tenant runbooks), widget (embeddable customer portal), notification, integration, audit
- **Persistence models** — how Postgres and DynamoDB repositories map domain entities (doc 05)
- **EventBus** — how modules communicate without depending on each other (doc 02)
- **Ports & Adapters** — how interfaces abstract implementations (doc 02)
- **Branded Types** — TypeScript types that prevent ID confusion bugs (doc 05)
- **HMAC** — how webhooks are validated (doc 08)
- **STS/KMS/AES-GCM** — how cloud credentials and local tokens are managed (doc 08)

[Next: Architecture >](./02-architecture.md)
