# Core API — How It Works

> The full OpenAPI spec is in `./core-swagger-api.yaml`.

---

## TL;DR

- The Core API is a **multi-tenant, AI-driven incident investigation platform** that takes alerts from monitoring tools and automatically triages, investigates, and proposes remediation for incidents.
- Every request is scoped to a **tenant** identified by `tenantId`. Authentication uses **JWT Bearer tokens** (except webhooks, which use HMAC-SHA256).
- The **incident pipeline** is fully async and event-driven: Ingestion → Triage (AI) → Investigation (6 parallel AI agents) → Remediation (human-in-the-loop) → Learning.
- **Remediation always requires human approval** before execution. Approval can be granted via SSE notifications, Slack, or Teams.
- The **Knowledge module** learns from every resolved incident using Bayesian confidence updates, progressively automating remediation for recognized patterns.
- The **Graph module** maintains a live infrastructure topology map and computes blast radius and change correlation for every incident.
- **Every action is logged** in an immutable hash-chained audit trail (67 action types, NDJSON export, tamper-proof verification).

---

## Quick Reference

### Key Entities

| Entity | Purpose |
|---|---|
| `Tenant` | Company/customer using the platform. Has plan, API keys, settings. |
| `Incident` | A normalized alert event. Has severity, status, assigned agents, root cause. |
| `Evidence` | Finding produced by an AI agent during investigation. |
| `Remediation` | Proposed corrective action steps. Requires human approval to execute. |
| `Pattern` | Reusable knowledge extracted from resolved incidents. Confidence-scored. |
| `ServiceNode` | Node in the infrastructure topology graph. |
| `ServiceEdge` | Directed connection between service nodes (http, grpc, database, etc.). |
| `AuditEntry` | Immutable tamper-proof log entry with hash chain linkage. |

### Key Flows

| Flow | Trigger | Output |
|---|---|---|
| Alert ingestion | `POST /v1/webhooks/:tenantId/:provider` | `Incident { status: open }` |
| Triage | SQS consumer (auto) or `POST /v1/triage/:incidentId` | Severity reclassification, agent selection |
| Investigation | SQS consumer (auto) or `POST /v1/investigation/:incidentId` | Root cause, recommended actions, optional patch |
| Remediation proposal | SQS consumer (auto) or `POST /v1/remediation` | `PendingApproval`, optional GitHub draft PR |
| Remediation execution | `POST /v1/remediation/:id/approve` + `POST /v1/remediation/:id/execute` | Steps executed sequentially |
| Pattern extraction | After incident resolved (auto) | `Pattern` with Bayesian confidence |

### Authentication

All routes except webhooks and health checks require a JWT Bearer token with the following claims:

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "tenant_id": "t_abc123",
  "roles": ["admin", "operator"]
}
```

Webhooks use HMAC-SHA256 signature validation instead.

---

## Module Diagram and Flow

```
                    ┌──────────────┐
                    │   Tenant     │ ← Multi-tenancy, plans, API keys
                    └──────┬───────┘
                           │ (every request carries tenantId)
                           ▼
┌────────────┐    ┌──────────────┐    ┌──────────────┐
│ Integration│───►│  Ingestion   │───►│   Triage     │
│  (GitHub)  │    │  (Alerts)    │    │    (AI)      │
└────────────┘    └──────────────┘    └──────┬───────┘
                                             │
                                             ▼
┌────────────┐    ┌──────────────┐    ┌──────────────┐
│    Graph   │◄──►│Investigation │───►│ Remediation  │
│ (Topology) │    │  (Multi-AI)  │    │  (Actions)   │
└────────────┘    └──────┬───────┘    └──────┬───────┘
                         │                    │
                         ▼                    ▼
                  ┌──────────────┐    ┌──────────────┐
                  │  Knowledge   │    │ Notification  │
                  │  (Patterns)  │    │(SSE+Approval) │
                  └──────────────┘    └──────────────┘
                                             │
                  ┌──────────────┐            │
                  │    Audit     │◄───────────┘
                  │ (Everything  │  (EVERYTHING generates an audit entry)
                  │  is logged)  │
                  └──────────────┘
```

---

## Modules

### Tenant (Multi-tenancy)

**Purpose:** Manages companies/customers (tenants) that use the platform.

- Each tenant has: name, slug, plan (`free` / `starter` / `pro` / `enterprise`), settings (AWS role, region, limits)
- API Keys: generated with the prefix `cflo_`, stored only as a SHA-256 hash (the plaintext key is shown **exactly once**)
- Rate limiting by plan: `free` = 30 req/min, `enterprise` = 2000 req/min

### Ingestion (Alert Ingestion)

**Purpose:** Receives alerts from external tools and creates incidents.

- Parsers for: Datadog, Grafana, CloudWatch, Sentry
- Deduplication: if the same `sourceAlertId` was already ingested, rejects with `409 Conflict`
- Normalizes alerts from different formats into the internal `Incident` format

### Triage (AI Triage)

**Purpose:** An AI agent classifies the real severity of the incident and decides which specialist agents to invoke.

### Remediation

**Purpose:** Proposes and executes corrective actions. **Always requires human approval** (human-in-the-loop).

- Possible actions: `restart_service`, `scale_service`, `rollback_service`, `run_command`, `create_fix_pr`
- If the `code_fixer` agent generated a patch, creates a draft PR on GitHub
- Steps execute sequentially; if one fails, subsequent steps are skipped (except `create_fix_pr`)

### Knowledge (Knowledge Base)

**Purpose:** Learns from every incident to be faster on the next one.

- Extracts a `Pattern` from each resolved incident using an LLM
- Confidence is updated with **Bayesian Update**: human confirmations increase confidence, rejections decrease it
- Status evolves: `learning` → `stable` (confidence >= 70%) → `runbook_candidate` (confidence >= 90%)
- Automatic runbooks: if a pattern reaches `runbook_candidate` and the tenant has `autoRemediation` enabled, the remediation runs automatically

### Graph (Infrastructure Graph)

**Purpose:** Maintains a live map of how services connect to each other.

```
Example graph for a tenant:

  [API Gateway] ──http──► [Payment Service] ──database──► [PostgreSQL]
       │                         │
       │                         └──cache──► [Redis]
       │
       └──http──► [Order Service] ──event──► [SQS Queue]
                        │
                        └──database──► [MongoDB]
```

- **Blast Radius:** Given a failing service, computes which other services are affected (BFS weighted by criticality)
- **Change Correlator:** Cross-references recent changes (deploys, config changes) with the incident timestamp to identify root cause
- **Auto-discovery:** Queries AWS (ECS, Lambda, EC2) to discover services automatically

### Notification

**Purpose:** Sends notifications and manages human approvals.

- SSE (Server-Sent Events): persistent connection for real-time browser notifications
- Approvals: when a remediation is proposed, creates a `PendingApproval` with a timeout (30 min by default)
- Future support: Slack, Teams

### Integration (GitHub App)

**Purpose:** Connects CauseFlow to the customer's GitHub.

- GitHub App installable: customers install it like any GitHub app
- Allows the `code_analyzer` agent to read code from repositories
- Allows the `code_fixer` agent to create PRs automatically
- Receives push webhooks to detect code changes

### Audit

**Purpose:** Records EVERYTHING that happens on the platform with an immutable hash chain.

```
Entry 1: { action: "tenant.created", hash: sha256("" + data1) = "abc123" }
Entry 2: { action: "incident.created", previousHash: "abc123", hash: sha256("abc123" + data2) = "def456" }
Entry 3: { action: "investigation.started", previousHash: "def456", hash: sha256("def456" + data3) = "ghi789" }

If someone modifies Entry 2, its hash changes, and Entry 3 detects the inconsistency.
→ Tamper-proof (proves no one has tampered with the log)
```

- 67 audited action types (tenant, incident, investigation, remediation, auth, etc.)
- Streaming export via NDJSON
- Hash chain integrity verification

---

## Incident Pipeline Flow

This is the most important flow in the system. When a service has a problem:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     INCIDENT PIPELINE                                │
│                                                                      │
│  ① ALERT ARRIVES                                                    │
│  ────────────────                                                    │
│  Datadog/Grafana/CloudWatch/Sentry → POST /v1/webhooks/:tenant/:prov│
│  │ HMAC-SHA256 validates signature                                  │
│  │ Parser normalizes format → Incident { status: 'open' }          │
│  │ Dedup: rejects if sourceAlertId already exists                   │
│  ▼                                                                   │
│  EventBus: publish('incident.created')                              │
│  SQS: enqueue → alerts queue                                        │
│                                                                      │
│  ② TRIAGE (AI)                                                      │
│  ──────────────                                                      │
│  SQS Consumer reads → TriageIncidentUseCase                         │
│  │ status: open → triaging                                          │
│  │ Claude Sonnet analyzes the incident                              │
│  │ Output: { priority: 'critical', suggestedAgents: [...] }        │
│  │ Reclassifies severity if needed                                  │
│  ▼                                                                   │
│  SQS: enqueue → investigation queue (if severity >= high)            │
│                                                                      │
│  ③ INVESTIGATION (Multi-Agent AI)                                   │
│  ──────────────────────────────────                                  │
│  SQS Consumer reads → InvestigateIncidentUseCase                    │
│  │ status: triaging → investigating                                 │
│  │ Enrichment: fetches historical patterns + repo context           │
│  │ 6 agents run IN PARALLEL (Promise.allSettled):                   │
│  │   log_analyst, metric_analyst, infra_inspector,                  │
│  │   change_detector, code_analyzer, db_analyst                     │
│  │ Each agent: assumes STS credentials → runs tools → findings      │
│  │ Synthesis: Claude Opus consolidates all findings                 │
│  │ code_fixer: if issue is code-related, proposes a patch           │
│  ▼                                                                   │
│  Output: { rootCause, recommendedActions, proposedFix? }            │
│  EventBus: publish('investigation.completed')                        │
│  SQS: enqueue → remediation queue                                    │
│                                                                      │
│  ④ REMEDIATION (Human-in-the-Loop)                                  │
│  ──────────────────────────────────                                  │
│  SQS Consumer reads → ProposeRemediationUseCase                     │
│  │ status: investigating → awaiting_approval                        │
│  │ Creates Remediation { steps: [...], status: 'proposed' }         │
│  │ If proposedFix exists: creates draft PR on GitHub                │
│  │ ChatPlatform requests approval (SSE/Slack/Teams)                 │
│  │ Creates PendingApproval { timeout: 30min }                       │
│  ▼                                                                   │
│  HUMAN APPROVES (or rejects/timeout)                                 │
│  │ approve → status: approved → ExecuteRemediationUseCase           │
│  │   - Assumes STS credentials with role 'remediator'               │
│  │   - Executes steps sequentially (restart, scale, PR, etc.)       │
│  │   - status: completed → Incident status: resolved                │
│  ▼                                                                   │
│  EventBus: publish('remediation.executed')                           │
│                                                                      │
│  ⑤ LEARNING                                                         │
│  ─────────────                                                       │
│  ExtractPatternUseCase                                               │
│  │ LLM extracts structured pattern from the resolved incident        │
│  │ If similar pattern exists (>=85%): increments occurrence count   │
│  │ If new: creates Pattern { confidence: 0.50, status: 'learning' } │
│  │ Future similar incidents are investigated FASTER                  │
│  ▼                                                                   │
│  The system gets smarter with every incident!                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Incident State Machine

```
  ┌──────┐
  │ open │─────────────────────────────────┐
  └──┬───┘                                 │
     │                                     ▼
     ▼                                  ┌──────┐
  ┌────────┐                            │closed│
  │triaging│──────────────────────────► └──────┘
  └──┬─────┘                               ▲
     │                                     │
     ▼                                     │
  ┌─────────────┐                          │
  │investigating│───────────────────────►──┤
  └──┬──────────┘                          │
     │        │                            │
     │        ▼                            │
     │  ┌──────────────────┐               │
     │  │awaiting_approval │               │
     │  └──┬───────────────┘               │
     │     │        │                      │
     │     │        └─────────────►────────┤
     │     ▼                               │
     │  ┌────────────┐                     │
     │  │remediating │────────────►────────┤
     │  └────────────┘                     │
     │                                     │
     ▼                                     │
  ┌────────┐                               │
  │resolved│───────────────────────────►───┘
  └────────┘
```

---

## Domain Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Tenant                                        │
│  tenantId (TenantId), name, slug, ownerEmail                        │
│  plan: free | starter | pro | enterprise                            │
│  status: active | suspended | trial | cancelled                     │
│  settings: { maxIncidents, autoRemediation, awsRoleArn, ... }      │
│  └── ApiKey { keyId, keyHash, prefix: "cflo_", status }            │
└─────────────────────────────────────────────────────────────────────┘
          │ (1:N)
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Incident                                      │
│  incidentId, tenantId, title, description                            │
│  severity: critical | high | medium | low | info                    │
│  status: open | triaging | investigating | awaiting_approval | ...  │
│  sourceProvider, sourceAlertId (dedup key)                          │
│  assignedAgents[], rootCause?, resolution?                          │
└─────────────────────────────────────────────────────────────────────┘
     │ (1:N)                    │ (1:N)                 │ (1:N)
     ▼                          ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌────────────────────────┐
│   Evidence   │    │   Remediation    │    │     AuditEntry         │
│ agentRole    │    │ steps[], status  │    │ action, actorEmail     │
│ evidenceType │    │ proposedBy       │    │ previousHash, entryHash│
│ content      │    │ approvedBy?      │    │ (immutable hash chain) │
│ confidence?  │    │ pullRequests?[]  │    │                        │
└──────────────┘    └──────────────────┘    └────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      ServiceNode (Graph)                             │
│  serviceId, name, type: api | database | cache | ...                │
│  health: { status, lastCheck }, blastRadius, criticality            │
│  └── ServiceEdge { source → target, edgeType: http | grpc | ... }  │
│  └── ChangeEvent { changeType: deployment | config_change | ... }   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        Pattern (Knowledge)                           │
│  symptoms: [{ signal, service, threshold }]                         │
│  rootCause: { category, description, evidence }                     │
│  fix: { action, description, automated }                            │
│  confidence: 0.0 – 1.0 (Bayesian update)                           │
│  status: learning | stable | runbook_candidate | deprecated         │
│  occurrences, confirmations, rejections                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Shared Types (Value Objects)

All IDs use **Branded Types** for type-safety:

```typescript
// Looks like a string, but TypeScript prevents mixing them up
type TenantId    = string & { __brand: 'TenantId' }
type IncidentId  = string & { __brand: 'IncidentId' }

// This COMPILES: ✅
const t: TenantId = tenantId('t_abc123')
findTenant(t)

// This does NOT COMPILE: ❌
const i: IncidentId = incidentId('inc_001')
findTenant(i)  // TS error: IncidentId is not assignable to TenantId
```

### Domain Events

The EventBus publishes ~20 event types. Examples:

| Event | Published by | Consumed by |
|--------|--------------|---------------|
| `incident.created` | Ingestion | Audit, SSE, Triage (via SQS) |
| `incident.status_changed` | Ingestion, Triage, Remediation | Audit |
| `investigation.completed` | Investigation | Audit, SSE, Knowledge, Remediation (via SQS) |
| `remediation.proposed` | Remediation | Audit, SSE, Notification |
| `remediation.executed` | Remediation | Audit, Knowledge |
| `graph.node_upserted` | Graph | Audit |
| `github.push_received` | Integration | Knowledge |

---

## Full Endpoint Reference

### Public (no auth required)

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/health` | Summary health check (200 or 503) |
| `GET` | `/health/detailed` | Detailed health check (DynamoDB, Redis, SQS) |
| `POST` | `/v1/webhooks/:tenantId/:provider` | Receive alerts (HMAC-SHA256 validated) |
| `POST` | `/webhooks/github` | Receive GitHub webhooks (HMAC-SHA256 validated) |
| `GET` | `/v1/github/callback` | GitHub App OAuth callback |

### Tenants & API Keys

| Method | Route | Role | Description |
|--------|------|------|-----------|
| `POST` | `/v1/tenants` | admin, owner | Create tenant |
| `GET` | `/v1/tenants` | any | List tenants for the owner |
| `GET` | `/v1/tenants/:id` | any | Tenant detail |
| `PATCH` | `/v1/tenants/:id` | admin, owner | Update tenant |
| `POST` | `/v1/api-keys` | admin, owner | Create API key |
| `GET` | `/v1/api-keys` | any | List API keys |
| `DELETE` | `/v1/api-keys/:id` | admin, owner | Revoke API key |

### Incidents

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/incidents` | List (filters: severity, status, sort) |
| `GET` | `/v1/incidents/:id` | Incident detail |
| `PATCH` | `/v1/incidents/:id` | Update status (admin/owner/operator) |

### Triage & Investigation

| Method | Route | Description |
|--------|------|-----------|
| `POST` | `/v1/triage/:incidentId` | Manually trigger triage |
| `GET` | `/v1/triage/:incidentId/evidence` | Triage evidence |
| `POST` | `/v1/investigation/:incidentId` | Manually trigger investigation |
| `GET` | `/v1/investigation/:incidentId` | Investigation result + per-agent evidence |

### Remediation

| Method | Route | Description |
|--------|------|-----------|
| `POST` | `/v1/remediation` | Propose remediation |
| `GET` | `/v1/remediation/:incidentId` | List by incident |
| `GET` | `/v1/remediation/detail/:id` | Remediation detail |
| `POST` | `/v1/remediation/:id/approve` | Approve |
| `POST` | `/v1/remediation/:id/reject` | Reject |
| `POST` | `/v1/remediation/:id/execute` | Execute |

### Knowledge & Patterns

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/knowledge` | List patterns |
| `GET` | `/v1/knowledge/:id` | Pattern detail |
| `POST` | `/v1/knowledge/feedback` | Submit feedback |
| `POST` | `/v1/knowledge/similar` | Find similar patterns |

### Graph (Topology)

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/graph` | List service nodes |
| `POST` | `/v1/graph/nodes` | Upsert node |
| `GET` | `/v1/graph/nodes/:id` | Node detail |
| `POST` | `/v1/graph/edges` | Upsert edge |
| `GET` | `/v1/graph/edges` | List edges |
| `POST` | `/v1/graph/changes` | Record a change event |
| `GET` | `/v1/graph/changes` | List recent changes |
| `GET` | `/v1/graph/health` | System health |
| `GET` | `/v1/graph/blast-radius/:id` | Blast radius analysis |
| `POST` | `/v1/graph/correlate` | Correlate changes with incident |

### Notifications & SSE

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/notifications` | List notifications |
| `PATCH` | `/v1/notifications/:id/read` | Mark as read |
| `GET` | `/v1/notifications/approvals/pending` | List pending approvals |
| `POST` | `/v1/notifications/approvals/:id/respond` | Respond to approval |
| `GET` | `/v1/notifications/stream` | **SSE** (real-time, heartbeat every 30s) |

### Code Knowledge

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/code-knowledge/repos` | List indexed repositories |
| `GET` | `/v1/code-knowledge/repos/:owner/:repo` | Repository detail |
| `GET` | `/v1/code-knowledge/repos/:owner/:repo/deps` | Repository dependencies |
| `GET` | `/v1/code-knowledge/deps/:pkg/dependents` | Dependents of a package |
| `GET` | `/v1/code-knowledge/repo-suggestions` | Repo-to-service mapping suggestions |
| `POST` | `/v1/code-knowledge/repo-mappings` | Apply repo-to-service mappings |

### Analytics & Admin

| Method | Route | Description |
|--------|------|-----------|
| `GET` | `/v1/analytics/incidents` | Incident analytics |
| `GET` | `/v1/analytics/patterns` | Pattern analytics |
| `GET` | `/v1/audit` | List audit trail |
| `GET` | `/v1/audit/verify` | Verify hash chain integrity |
| `GET` | `/v1/audit/export` | Export as NDJSON (streaming) |
| `POST` | `/v1/admin/queues/redrive` | Redrive DLQ (admin only) |
| `GET` | `/v1/auth/me` | Whoami (JWT claims) |
