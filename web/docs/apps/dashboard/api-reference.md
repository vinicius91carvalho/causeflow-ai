# Dashboard API Reference

All API routes live under `/api/` and are served by the Next.js App Router. Routes that require authentication use the `withAuth()` higher-order function which validates the Clerk session, enforces tenant isolation via Clerk organizations, and applies per-user rate limiting (default: 60 req/min per user per endpoint).

## Common Conventions

- All responses return `Content-Type: application/json`
- Error bodies: `{ "error": "<message>" }` with optional `"issues"` array for validation errors
- Pagination uses cursor-based scheme: `{ "cursor": "<opaque>", "hasMore": boolean }`
- `402` errors include `{ "code": "CREDITS_EXHAUSTED" }` when applicable
- All protected endpoints derive `tenantId` from the Clerk organization (`orgId`)

## Common HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Invalid input / validation failure |
| `401` | No valid Clerk session |
| `402` | Payment required (credits exhausted) |
| `403` | Insufficient role or profile not complete |
| `404` | Resource not found (also prevents cross-tenant leakage) |
| `409` | Conflict (duplicate resource) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Incidents & Analyses

### `POST /api/analyses`

Create a new incident and trigger AI investigation. Deducts 1 credit.

- **Auth:** Yes
- **Role:** any
- **Credit check:** Returns `402` if credits exhausted

**Request body:**

```json
{
  "prompt": "Investigate the database connection timeout errors since 09:00 UTC",
  "severity": "critical",
  "integrations": ["cloudwatch", "datadog"]
}
```

| Field | Type | Validation |
|---|---|---|
| `prompt` | string | Min 10, max 4,000 chars (required) |
| `severity` | string | `low` \| `medium` \| `high` \| `critical` (optional) |
| `integrations` | string[] | Valid integration types, max 15 (optional) |

**Response `201`:** Returns created incident with credits remaining.

---

### `GET /api/analyses`

List incidents for the tenant (paginated, newest first).

- **Auth:** Yes
- **Role:** any

**Query params:** `cursor`, `status`, `limit` (default: 20, max: 100)

---

### `GET /api/analyses/[id]`

Fetch a single incident by ID (tenant-isolated).

- **Auth:** Yes
- **Role:** any

---

### `POST /api/analyses/[id]/investigate`

Trigger AI investigation on an existing incident.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/analyses/[id]/triage`

Triage incident severity and status.

- **Auth:** Yes
- **Role:** any

**Request body:**

```json
{
  "severity": "high",
  "status": "investigating"
}
```

---

### `POST /api/analyses/[id]/context`

Add additional context to an ongoing investigation.

- **Auth:** Yes
- **Role:** any

---

## Incident Feedback

### `GET /api/incidents/[id]/feedback`

Fetch feedback records for an incident.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/incidents/[id]/feedback`

Submit feedback on an investigation (rating 1-5, optional comment).

- **Auth:** Yes
- **Role:** any

**Request body:**

```json
{
  "rating": 5,
  "comment": "Great root cause analysis"
}
```

---

### `POST /api/investigation/[id]/known-solution-response`

Respond to a known solution suggestion (accept or reject).

- **Auth:** Yes
- **Role:** any

---

## Remediations

### `GET /api/remediations`

List all remediations for the tenant.

- **Auth:** Yes
- **Role:** any

---

### `GET /api/remediations/[id]`

Get remediation detail including steps and pull requests.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/remediations/[id]`

Update remediation status (approve, reject, execute).

- **Auth:** Yes
- **Role:** admin (for approve/reject)

**Request body:**

```json
{
  "action": "approve"
}
```

| Action | Description |
|---|---|
| `approve` | Approve remediation for execution |
| `reject` | Reject with reason |
| `execute` | Start automated execution |

---

### `POST /api/remediation/[id]/feedback`

Submit feedback on remediation effectiveness.

- **Auth:** Yes
- **Role:** any

---

## Approvals

### `GET /api/approvals`

List pending approval requests.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/approvals/[id]/respond`

Approve or reject an approval request.

- **Auth:** Yes
- **Role:** admin

**Request body:**

```json
{
  "decision": "approved",
  "reason": "Looks good to proceed"
}
```

---

## Team

### `GET /api/team`

List all team members in the tenant (paginated).

- **Auth:** Yes
- **Role:** any

---

### `POST /api/team/invite`

Send an email invitation (admin only). Creates invite with 7-day expiry.

- **Auth:** Yes
- **Role:** admin

**Request body:**

```json
{
  "email": "newuser@company.com",
  "role": "member"
}
```

**Error `409`:** Pending invite already exists for this email.

---

### `GET /api/team/invites`

List pending and expired invites (admin only).

- **Auth:** Yes
- **Role:** admin

---

### `DELETE /api/team/invites/[email]`

Revoke a pending invite (admin only). Email must be URL-encoded.

- **Auth:** Yes
- **Role:** admin

---

### `DELETE /api/team/[userId]`

Remove a team member (admin only). Admin cannot remove themselves.

- **Auth:** Yes
- **Role:** admin

---

### `PATCH /api/team/[userId]/role`

Change a member's role (admin only). Admin cannot change their own role.

- **Auth:** Yes
- **Role:** admin

**Request body:**

```json
{ "role": "admin" }
```

---

## Integrations

### `GET /api/integrations`

List all integrations for the tenant. Encrypted credentials are never returned.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/integrations`

Connect a new integration (admin only). Supports both OAuth and credential-based auth.

- **Auth:** Yes
- **Role:** admin

---

### `DELETE /api/integrations/[type]`

Disconnect an integration (soft delete: status=disconnected, credentials cleared).

- **Auth:** Yes
- **Role:** admin

---

### `POST /api/integrations/test`

Test an integration connection.

- **Auth:** Yes
- **Role:** admin

---

### `GET /api/integrations/catalog`

Get available integrations catalog with connection requirements.

- **Auth:** Yes
- **Role:** any

---

### `GET /api/integrations/aws-setup`

Get AWS CloudWatch setup instructions (IAM role, trust policy).

- **Auth:** Yes
- **Role:** admin

---

### OAuth Flow

| Endpoint | Method | Description |
|---|---|---|
| `/api/integrations/oauth/[provider]/authorize` | GET | Start OAuth flow (redirect to provider) |
| `/api/integrations/oauth/[provider]/callback` | GET | Handle OAuth callback |
| `/api/integrations/oauth/[provider]/token` | POST | Exchange code for token |
| `/api/integrations/oauth/status` | GET | Check OAuth connection status |

---

### GitHub App

| Endpoint | Method | Description |
|---|---|---|
| `/api/github/install-url` | GET | Get GitHub App installation URL |
| `/api/github/callback` | GET | Handle GitHub App install callback |
| `/api/github/installation` | GET | Get GitHub installation status |
| `/api/github/installation` | DELETE | Revoke GitHub App |

---

### Triggers

| Endpoint | Method | Description |
|---|---|---|
| `/api/integrations/triggers` | GET | List active triggers |
| `/api/integrations/triggers` | POST | Create a new trigger |
| `/api/integrations/triggers/available` | GET | List available triggers for an integration |
| `/api/integrations/triggers/[id]` | DELETE | Delete a trigger |

---

## Settings

### `GET /api/settings`

Fetch all settings including user profile and company info.

- **Auth:** Yes
- **Role:** any

**Response `200`:**

```json
{
  "settings": {
    "tenantId": "org_xyz",
    "notifications": {
      "emailOnComplete": true,
      "emailOnError": true,
      "slackOnComplete": false,
      "slackOnError": true
    },
    "locale": "en",
    "theme": "system"
  },
  "profile": { "name": "Jane Doe", "email": "jane@company.com", "role": "admin" },
  "company": { "name": "Acme Corp", "websiteUrl": "https://acme.com", "teamSize": "6_20", "plan": "starter" }
}
```

---

### `PATCH /api/settings`

Partial update. Company fields require admin role.

- **Auth:** Yes
- **Role:** any (company fields: admin only)

---

### API Keys

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/settings/api-keys` | GET | List API keys (admin only) |
| `POST /api/settings/api-keys` | POST | Create API key — full key returned once only (admin only) |
| `DELETE /api/settings/api-keys/[keyId]` | DELETE | Revoke API key (admin only) |

---

## Billing

> All billing endpoints (except webhook) require `admin` role.

### `GET /api/billing/plans`

List available subscription plans with pricing.

- **Auth:** Yes
- **Role:** any

---

### `GET /api/billing/subscription`

Current subscription state including plan, credits, renewal date.

- **Auth:** Yes
- **Role:** admin

**Response `200`:**

```json
{
  "subscription": {
    "plan": "starter",
    "status": "active",
    "creditsTotal": 20,
    "creditsUsed": 5,
    "creditsRemaining": 15,
    "currentPeriodEnd": "2026-05-03T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "stripeCustomerId": "cus_ABC123",
    "stripeSubscriptionId": "sub_XYZ789"
  }
}
```

---

### `POST /api/billing/checkout`

Create Stripe Checkout session for upgrading to a paid plan.

- **Auth:** Yes
- **Role:** admin

**Request body:**

```json
{ "planId": "starter" }
```

**Response `200`:** `{ "url": "https://checkout.stripe.com/..." }`

---

### `POST /api/billing/subscribe`

Subscribe to a plan (alternative to checkout flow).

- **Auth:** Yes
- **Role:** admin

---

### `POST /api/billing/portal`

Create Stripe Customer Portal session for self-service billing management.

- **Auth:** Yes
- **Role:** admin

---

### `POST /api/billing/purchase`

One-time purchase (quota packs for credit overage).

- **Auth:** Yes
- **Role:** admin

---

### `GET /api/billing/invoices`

List Stripe invoices for the tenant.

- **Auth:** Yes
- **Role:** admin

---

### `GET /api/billing/usage-history`

Get credit usage history over time.

- **Auth:** Yes
- **Role:** admin

---

### `POST /api/billing/webhook`

Stripe webhook handler. **Does NOT use `withAuth()`** — verified via `stripe-signature` header.

- **Auth:** No (signature-verified)

**Handled events:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, reset credits |
| `customer.subscription.created` | Initialize subscription |
| `customer.subscription.updated` | Sync plan/status changes |
| `customer.subscription.deleted` | Revert to free plan |
| `invoice.paid` | Renew credits for billing cycle |

---

## Metrics

### `GET /api/metrics`

Dashboard overview metrics. Triggers lazy credit renewal for free plan.

- **Auth:** Yes
- **Role:** any

**Response `200`:**

```json
{
  "metrics": {
    "totalAnalyses": 42,
    "monthlyAnalyses": 8,
    "activeIntegrations": 3,
    "teamMembers": 5,
    "creditsTotal": 20,
    "creditsUsed": 5,
    "creditsRemaining": 15,
    "hoursSaved": 84,
    "plan": "starter"
  }
}
```

---

## Notifications

### `GET /api/notifications`

List notifications for the user.

- **Auth:** Yes
- **Role:** any

---

### `PATCH /api/notifications`

Mark notification as read.

- **Auth:** Yes
- **Role:** any

---

### `GET /api/notifications/stream`

Server-Sent Events (SSE) stream for real-time notifications.

- **Auth:** Yes
- **Role:** any
- **Content-Type:** `text/event-stream`

---

## Memory & Intelligence

### `GET /api/memory/insights`

Get AI-generated pattern insights about incident history.

- **Auth:** Yes
- **Role:** any

---

### `GET /api/memory/summary`

Get AI summary of recent incidents and system state.

- **Auth:** Yes
- **Role:** any

---

### `POST /api/memory/ask`

Ask a free-form question about system history. Returns AI-generated answer.

- **Auth:** Yes
- **Role:** any

**Request body:**

```json
{ "question": "What were the most common root causes last month?" }
```

---

## Audit

### `GET /api/audit`

Get audit trail (paginated, filterable by action type).

- **Auth:** Yes
- **Role:** any

**Query params:** `cursor`, `action` (filter), `limit`

---

## Onboarding

### `GET /api/onboarding/progress`

Get onboarding tutorial progress.

- **Auth:** Yes
- **Role:** any

---

### `PATCH /api/onboarding/progress`

Update onboarding step status (mark step completed, skip all).

- **Auth:** Yes
- **Role:** any

---

### `POST /api/onboarding/complete-profile`

Complete the profile during onboarding. Creates tenant association.

- **Auth:** Yes (Clerk session, tenantId not required)

**Request body:**

```json
{
  "fullName": "Jane Doe",
  "companyName": "Acme Corp",
  "companyWebsite": "https://acme.com",
  "teamSize": "6_20",
  "role": "Engineering Manager"
}
```

---

## Health

### `GET /api/health`

Lightweight health check. No auth required.

**Response `200`:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-04-06T14:00:00.000Z"
}
```

---

### `GET /api/health/detailed`

Detailed health check with dependency status.

- **Auth:** Yes
- **Role:** any

---

## Relay

### `GET /api/relay/status`

Get integration relay health status.

- **Auth:** Yes
- **Role:** any

---

## Endpoint Summary

| Domain | Count | Key Endpoints |
|---|---|---|
| Incidents/Analyses | 7 | CRUD, investigate, triage, context |
| Feedback | 3 | Incident feedback, remediation feedback, known solution response |
| Remediations | 3 | List, detail, update (approve/reject/execute) |
| Approvals | 2 | List, respond |
| Team | 6 | Members, invite, invites list, revoke, remove, role change |
| Integrations | 13 | CRUD, test, catalog, AWS setup, OAuth flow (4), GitHub App (4), triggers (4) |
| Settings | 5 | Get/patch settings, API keys CRUD |
| Billing | 9 | Plans, subscription, checkout, subscribe, portal, purchase, invoices, usage, webhook |
| Metrics | 1 | Dashboard overview |
| Notifications | 3 | List, mark read, SSE stream |
| Memory/Intelligence | 3 | Insights, summary, ask |
| Audit | 1 | Audit trail |
| Onboarding | 3 | Progress get/update, complete profile |
| Health | 2 | Basic, detailed |
| Relay | 1 | Status |
| **Total** | **~62** | |
