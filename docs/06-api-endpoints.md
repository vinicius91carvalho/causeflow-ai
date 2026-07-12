# 06 — API Endpoints

[< Back to index](./00-index.md) | [Previous: Data Model](./05-data-model.md) | [Next: AI System >](./07-ai-system.md)

---

> **Source of truth:** Route registration in `core/src/app.ts` and the module
> route files under `core/src/modules/**/infra/*.routes.ts` are authoritative.
> This document is the human-readable companion: it groups endpoints by module,
> explains auth schemes, and highlights quirks.

## Servers

| Environment | Base URL |
|---|---|
| Production  | `https://api.causeflow.io` |
| Staging     | `https://staging-api.causeflow.io` |
| Local       | `http://localhost:3000` |

Most endpoints sit under the `/v1` prefix. Two notable exceptions:

- **Skill** routes use absolute `/api/v1/tenants/:tenantId/skills` paths (no
  shared `/v1` prefix — they were carved out as a self-contained module).
- The Composio webhook receiver lives at `/webhooks/composio` (not
  `/v1/webhooks/...`) so the public path is stable for the provider.

The open-source local runtime publishes Core on `http://localhost:3099`; the
container listens on port `5171`.

---

## Authentication & Security Schemes

The API uses the security schemes below. Route files declare which one(s) each
operation accepts.

| Scheme | Type | Header | Used by |
|---|---|---|---|
| `bearerAuth` | HTTP Bearer (JWT) | `Authorization: Bearer <jwt>` | Default for dashboard endpoints. Production uses Clerk-issued JWTs; the OSS runtime uses local JWT auth with the same tenant-scoped contract. |
| `apiKeyAuth` | API key | `X-API-Key` | Tenant-scoped programmatic access and the embeddable Widget. |
| `webhookSecret` | API key | `X-Webhook-Secret` | Shared webhook secret accepted on ingestion endpoints (`POST /v1/webhooks/{tenantId}/{provider}`) as an alternative to `apiKeyAuth`. |
| `webhookSignature` | API key | `webhook-signature` | HMAC signature emitted by Composio when calling our trigger webhook. |
| `stripeSignature` | API key | `stripe-signature` | Stripe billing webhooks. |
| `svixSignature` | API key | `svix-signature` (+ `svix-id`, `svix-timestamp`) | Svix-signed Clerk webhooks. |

Bearer auth is the default for dashboard/API routes; operations that need a
different scheme override it locally.

### Roles (RBAC)

Roles are carried in the authenticated session token. Hosted deployments use
Clerk organization claims; the OSS runtime uses local JWT claims. The system
has two roles: `admin` and `member`.

| Role | What they can do |
|---|---|
| `admin`  | Everything — manage users, billing, integrations, approve remediations |
| `member` | Read access; can trigger investigations and update incident status |

### Public routes (no auth)

These operations are reachable without a dashboard bearer token or API key.
They are still rate-limited and several rely on signed payloads.

| Method | Path | How it is protected |
|---|---|---|
| `GET`  | `/health` | None — liveness probe |
| `GET`  | `/dashboard` | None — internal HTML dashboard |
| `GET`  | `/portal` | Host-based tenant lookup (custom domain) |
| `POST` | `/v1/auth/clerk-webhook` | `svixSignature` headers |
| `POST` | `/v1/billing/webhook` | `stripeSignature` header |
| `POST` | `/webhooks/composio` | `webhookSignature` header |
| `POST` | `/v1/signup` | Public self-service signup |
| `POST` | `/v1/beta-allowlist/check` | Public allowlist lookup |

The Portal endpoint deserves a special note: it has no `tenantId` in its
path. The tenant is resolved from the **`Host` header** by matching the
custom domain configured for the widget portal.

---

## Endpoint Catalogue

The catalogue below mirrors the route modules. For exact request and response
shapes, read the Zod schemas in the corresponding route/handler files.

### Health

Liveness, readiness, and the internal HTML dashboard.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health`           | public      | Liveness / basic health |
| `GET` | `/health/detailed`  | bearerAuth  | Detailed health with per-dependency checks |
| `GET` | `/dashboard`        | public      | Serves the internal HTML dashboard |

### Auth

Clerk integration: webhook receiver and current-user lookup.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/auth/clerk-webhook` | svixSignature | Clerk webhook receiver (Svix signed) |
| `GET`  | `/v1/auth/me`            | bearerAuth    | Current authenticated user (whoami) |
| `POST` | `/v1/auth/login`         | public        | OSS/local sign-in; returns a local session token |
| `POST` | `/v1/auth/register`      | public        | OSS/local self-service registration |
| `POST` | `/v1/auth/logout`        | bearerAuth    | OSS/local session logout |

### Tenant

Multi-tenancy management.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST`  | `/v1/tenants`              | bearerAuth (admin) | Create a tenant |
| `GET`   | `/v1/tenants`              | bearerAuth | List tenants owned by the authenticated user |
| `GET`   | `/v1/tenants/{tenantId}`   | bearerAuth | Get a tenant by id |
| `PATCH` | `/v1/tenants/{tenantId}`   | bearerAuth (admin) | Update a tenant |

### User

Team members, profiles, settings, and cross-tenant lookup for OAuth linking.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`    | `/v1/users`                       | bearerAuth | List team members |
| `POST`   | `/v1/users`                       | bearerAuth (admin) | Create a user |
| `PATCH`  | `/v1/users/{userId}`              | bearerAuth (admin) | Update user |
| `DELETE` | `/v1/users/{userId}`              | bearerAuth (admin, not self) | Remove team member |
| `GET`    | `/v1/users/{userId}/settings`     | bearerAuth | Get user settings, profile, company |
| `PATCH`  | `/v1/users/{userId}/settings`     | bearerAuth | Update user settings |
| `GET`    | `/v1/users/by-email/{email}`      | bearerAuth | Find a user by email for account/session linking |
| `GET`    | `/v1/users/{userId}/profile`      | bearerAuth | Get user profile |

### Invite

Pending invitations to join a tenant.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`    | `/v1/invites`                | bearerAuth | List pending invites |
| `POST`   | `/v1/invites`                | bearerAuth (admin) | Create an invite |
| `DELETE` | `/v1/invites/{email}`        | bearerAuth (admin) | Revoke an invite |
| `POST`   | `/v1/invites/{email}/accept` | bearerAuth | Accept an invite |

### ApiKey

Tenant-scoped API keys for programmatic / widget access. The plaintext key is
returned **only once** on creation.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST`   | `/v1/api-keys`           | bearerAuth (admin) | Create an API key (returns plaintext once) |
| `GET`    | `/v1/api-keys`           | bearerAuth | List API keys (no secret material) |
| `DELETE` | `/v1/api-keys/{keyId}`   | bearerAuth (admin) | Revoke an API key |

### Audit

Tamper-evident audit log with hash-chain verification and NDJSON export.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/v1/audit`                  | bearerAuth | List audit entries |
| `GET`  | `/v1/audit/verify`           | bearerAuth | Verify tamper-evident hash chain |
| `GET`  | `/v1/audit/export`           | bearerAuth | Export audit entries as NDJSON stream |
| `POST` | `/v1/audit/terms-acceptance` | bearerAuth | Record terms acceptance as an audit entry |

### Billing

Stripe-backed subscriptions, plans, usage, invoices, and the webhook receiver.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/v1/billing/plans`         | bearerAuth | List available Stripe plans |
| `POST` | `/v1/billing/subscribe`     | bearerAuth (admin) | Create a subscription via Payment Element |
| `POST` | `/v1/billing/checkout`      | bearerAuth (admin) | Create a Stripe Checkout session |
| `POST` | `/v1/billing/portal`        | bearerAuth (admin) | Create a Stripe Billing Portal session |
| `GET`  | `/v1/billing/subscription`  | bearerAuth | Get current subscription info |
| `GET`  | `/v1/billing/credits`       | bearerAuth | Get investigation + event credit balances |
| `GET`  | `/v1/billing/usage`         | bearerAuth | List usage records for the billing account |
| `GET`  | `/v1/billing/invoices`      | bearerAuth | List Stripe invoices for this tenant |
| `POST` | `/v1/billing/purchase`      | bearerAuth (admin) | Purchase a quota pack |
| `POST` | `/v1/billing/upgrade`       | bearerAuth (admin) | Upgrade or downgrade subscription plan |
| `POST` | `/v1/billing/cancel`        | bearerAuth (admin) | Schedule subscription cancellation |
| `POST` | `/v1/billing/reactivate`    | bearerAuth (admin) | Reactivate a canceling subscription |
| `PUT`  | `/v1/billing/settings`      | bearerAuth (admin) | Update billing settings |
| `POST` | `/v1/billing/webhook`       | stripeSignature | Stripe webhook receiver |

### Signup

Public self-service onboarding.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/signup` | public | Public self-service signup |

### Ingestion (Webhooks)

The single ingress for monitoring providers. Either a shared
`X-Webhook-Secret` or a tenant `X-API-Key` is accepted.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/webhooks/{tenantId}/{provider}` | webhookSecret OR apiKeyAuth | Ingest alert from a monitoring provider (datadog, grafana, cloudwatch, sentry, pagerduty, newrelic, custom) |

### Incident

Incident lifecycle: list, get, manual creation via chat, and status updates.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`   | `/v1/incidents`               | bearerAuth | List incidents |
| `POST`  | `/v1/incidents/chat`          | bearerAuth (admin) | Create incident manually via chat |
| `GET`   | `/v1/incidents/{id}`          | bearerAuth | Get an incident by id |
| `PATCH` | `/v1/incidents/{id}`          | bearerAuth (admin) | Update incident status |

### Triage

Fast first-pass triage and the evidence collected during it.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/triage/{incidentId}`           | bearerAuth (admin) | Trigger triage for an incident |
| `GET`  | `/v1/triage/{incidentId}/evidence`  | bearerAuth | List evidence collected during triage |

### Investigation

Deep multi-agent investigation, context injection, abort, known-solution
acceptance, and feedback.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/investigation/{incidentId}`                          | bearerAuth (admin) | Trigger an investigation manually |
| `GET`  | `/v1/investigation/{incidentId}`                          | bearerAuth | Get investigation result and per-agent evidence |
| `POST` | `/v1/investigation/{incidentId}/context`                  | bearerAuth | Add context to an in-flight investigation |
| `POST` | `/v1/investigation/{incidentId}/known-solution-response`  | bearerAuth | Accept or decline a suggested known solution |
| `POST` | `/v1/investigation/{incidentId}/feedback`                 | bearerAuth | Record feedback on an investigation's quality |
| `POST` | `/v1/investigation/{incidentId}/abort`                    | bearerAuth (admin) | Abort a running investigation |

### Remediation

Proposing, approving, executing, and giving feedback on remediations.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/remediation`                                | bearerAuth (admin) | Propose a remediation manually |
| `GET`  | `/v1/remediation/{incidentId}`                   | bearerAuth | List remediations for an incident |
| `GET`  | `/v1/remediation/detail/{remediationId}`         | bearerAuth | Get remediation detail |
| `POST` | `/v1/remediation/{remediationId}/approve`        | bearerAuth (admin) | Approve remediation |
| `POST` | `/v1/remediation/{remediationId}/reject`         | bearerAuth (admin) | Reject remediation |
| `POST` | `/v1/remediation/{remediationId}/execute`        | bearerAuth (admin) | Execute an approved remediation |
| `POST` | `/v1/remediation/{remediationId}/feedback`       | bearerAuth | Record feedback on a remediation's effectiveness |

### Notification

In-app notifications, SSE stream, and human-in-the-loop approvals.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`   | `/v1/notifications`                          | bearerAuth | List notifications |
| `GET`   | `/v1/notifications/stream`                   | bearerAuth | SSE stream of notifications for this tenant |
| `GET`   | `/v1/notifications/{id}`                     | bearerAuth | Get notification detail |
| `PATCH` | `/v1/notifications/{id}/read`                | bearerAuth | Mark notification as read |
| `GET`   | `/v1/notifications/approvals/pending`        | bearerAuth | List pending approvals |
| `POST`  | `/v1/notifications/approvals/{id}/respond`   | bearerAuth | Respond to an approval |

### Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/analytics/incidents` | bearerAuth | Incident analytics summary for this tenant |

### Admin

Operator/SRE escape hatches. Admin role required.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/admin/queues/redrive` | bearerAuth (admin) | Redrive messages from a DLQ |
| `GET`  | `/v1/admin/costs`          | bearerAuth (admin) | Platform cost breakdown for investigated incidents |

### Integration

Unified surface over both credential-based and Composio-OAuth integrations.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`    | `/v1/integrations`                       | bearerAuth | Unified list of integrations (credential + Composio OAuth) |
| `GET`    | `/v1/integrations/catalog`               | bearerAuth | Catalog of supported providers with metadata |
| `POST`   | `/v1/integrations/stub/enable`           | bearerAuth (admin) | Enable the OSS stub integration |
| `POST`   | `/v1/integrations/stub/connect`          | bearerAuth (admin) | Connect and probe the OSS stub integration |
| `POST`   | `/v1/integrations/credentials`           | bearerAuth (admin) | Connect a credential-based integration |
| `DELETE` | `/v1/integrations/credentials/{type}`    | bearerAuth (admin) | Disconnect a credential-based integration |
| `POST`   | `/v1/integrations/test-connection`       | bearerAuth (admin) | Test an AWS AssumeRole |
| `POST`   | `/v1/integrations/connect`               | bearerAuth (admin) | Initiate OAuth connection via Composio |
| `DELETE` | `/v1/integrations/connect/{provider}`    | bearerAuth (admin) | Revoke a Composio OAuth connection |

### Trigger

Composio-managed event triggers and the public webhook that delivers them.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`    | `/v1/triggers`            | bearerAuth | List Composio triggers for this tenant |
| `POST`   | `/v1/triggers`            | bearerAuth (admin) | Create a Composio trigger |
| `DELETE` | `/v1/triggers/{id}`       | bearerAuth (admin) | Delete a Composio trigger |
| `GET`    | `/v1/triggers/available`  | bearerAuth | List available trigger types per provider (from Composio) |
| `POST`   | `/webhooks/composio`      | webhookSignature | Composio trigger webhook receiver (note: no `/v1` prefix) |

### Relay

Status of the on-prem relay agent and the resources it exposes.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/relay/status` | bearerAuth | Relay connection status and available resources |

### OSS

Open-source runtime settings that replace SaaS-only configuration locally.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/oss/llm-connector` | bearerAuth | Read the active OSS LLM connector profile |
| `PUT` | `/v1/oss/llm-connector` | bearerAuth (admin) | Update the OpenAI-compatible LLM connector used by triage/investigation |

### CodeKnowledge

Repository graph: repos, dependencies, dependents, and repo→service mappings
used by investigation agents.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/v1/code-knowledge/repos`                                | bearerAuth | List repositories |
| `GET`  | `/v1/code-knowledge/repos/{owner}/{repo}`                 | bearerAuth | Get repository details |
| `GET`  | `/v1/code-knowledge/repos/{owner}/{repo}/deps`            | bearerAuth | Get repo dependencies |
| `GET`  | `/v1/code-knowledge/deps/{packageName}/dependents`        | bearerAuth | Get dependents for a package |
| `GET`  | `/v1/code-knowledge/repo-suggestions`                     | bearerAuth | Auto-suggested repo→service mappings |
| `POST` | `/v1/code-knowledge/repo-mappings`                        | bearerAuth | Apply repo→service mappings in batch |
| `GET`  | `/v1/code-knowledge/services/{serviceId}/repos`           | bearerAuth | Get repos linked to a service |

### Memory

The Hindsight memory subsystem: chat router, recall surfaces, topology, and
the runbook registry.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/memory/chat`                       | bearerAuth | Unified chat (Hindsight router decides intent) |
| `GET`  | `/v1/memory/insights`                   | bearerAuth | Recall memories grouped for the Intelligence page |
| `GET`  | `/v1/memory/summary`                    | bearerAuth | Tenant infrastructure summary (cached 5m) |
| `GET`  | `/v1/memory/topology`                   | bearerAuth | Recall topology-tagged memories |
| `GET`  | `/v1/memory/chat/history`               | bearerAuth | List recent chats |
| `GET`  | `/v1/memory/chat/history/{chatId}`      | bearerAuth | Get messages of a chat |
| `GET`  | `/v1/memory/runbooks`                   | bearerAuth | List RunbookRegistry entries (confirmed root causes) |

### Skill

Tenant-defined investigation skills. **Note the unusual base path:** these
routes use `/api/v1/tenants/{tenantId}/skills` (not `/v1/...`) and the
tenant id is part of the URL rather than coming from the JWT context.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST`   | `/api/v1/tenants/{tenantId}/skills`        | bearerAuth | Create a tenant investigation skill |
| `GET`    | `/api/v1/tenants/{tenantId}/skills`        | bearerAuth | List tenant skills |
| `GET`    | `/api/v1/tenants/{tenantId}/skills/{id}`   | bearerAuth | Get a skill by id |
| `PUT`    | `/api/v1/tenants/{tenantId}/skills/{id}`   | bearerAuth | Update a skill |
| `DELETE` | `/api/v1/tenants/{tenantId}/skills/{id}`   | bearerAuth | Delete a skill |

### Widget

The embeddable customer-facing chat widget. Authenticated with the tenant
`X-API-Key` (no JWT — these run from end-user browsers).

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/widget/sessions`                              | apiKeyAuth | Create a widget chat session |
| `POST` | `/v1/widget/sessions/{sessionId}/messages`         | apiKeyAuth | Send a message in a widget session |
| `GET`  | `/v1/widget/sessions/{sessionId}/stream`           | apiKeyAuth | SSE stream for async widget responses |
| `POST` | `/v1/widget/sessions/{sessionId}/push-subscribe`   | apiKeyAuth | Register a Web Push subscription for this session |
| `POST` | `/v1/widget/sessions/{sessionId}/close`            | apiKeyAuth | Close a widget session |
| `GET`  | `/v1/widget/config`                                | apiKeyAuth | Widget branding config for this tenant |

### Portal

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/portal` | public (Host-based) | Serves the customer widget portal HTML; the tenant is resolved from the request `Host` header (custom domain), not from the URL path or any token. |

### BetaAllowlist

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/beta-allowlist/check` | public | Check if an email is on the beta allowlist |

---

## Error envelope

All non-2xx responses follow the conventional shape declared in
`#/components/schemas/Error` of the OpenAPI document:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": { "field": "email", "reason": "format" }
}
```

Common status codes used across the API:

| Status | Meaning |
|---|---|
| `400` | Validation / malformed request |
| `401` | Missing or invalid credentials |
| `403` | Authenticated but lacks the required role |
| `404` | Resource not found within the tenant scope |
| `409` | Conflict (idempotency, duplicate, state mismatch) |
| `429` | Rate limited |
| `5xx` | Server error |

---

## Pagination

List endpoints accept `limit` and `cursor` query parameters and return:

```json
{ "items": [ ... ], "cursor": "opaque-token-or-null" }
```

Exact cursor semantics are defined by each list route's request schema.

---

[< Back to index](./00-index.md) | [Previous: Data Model](./05-data-model.md) | [Next: AI System >](./07-ai-system.md)
