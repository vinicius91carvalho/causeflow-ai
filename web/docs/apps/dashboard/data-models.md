# Dashboard Data Models

The dashboard is a frontend client that communicates with a **Core API** backend via `CORE_API_URL`. All data persistence is handled by the backend — the dashboard does not directly access any database. When `CORE_API_URL` is not set, a mock API client provides simulated data for local development.

---

## Architecture

```
Dashboard (Next.js)
  │
  ├── withAuth() — Clerk session validation, RBAC, rate limiting
  │
  ├── getApiClient() — Returns HttpApiClient or MockApiClient
  │     │
  │     ├── HttpApiClient — HTTP calls to CORE_API_URL (production)
  │     └── MockApiClient — In-memory simulated data (development)
  │
  └── API Route Handlers — Thin wrappers that validate input,
        call the API client, and return JSON responses
```

### API Client Interface

The `ICoreApiClient` interface (`src/lib/api/core-api-client.ts`) defines 29+ methods covering all backend operations. Two implementations exist:

| Implementation | When Used | Location |
|---|---|---|
| `HttpApiClient` | `CORE_API_URL` is set | `src/lib/api/http-api-client.ts` |
| `MockApiClient` | `CORE_API_URL` is not set | `src/lib/api/mock-api-client.ts` |

---

## Domain Types

All domain types are defined in `domain/types.ts` within each bounded context.

### Tenant

Represents a company/organization. Maps to a Clerk organization.

```typescript
interface Tenant {
  id: string;                    // Clerk org ID (= tenantId)
  name: string;                  // Company name
  plan: TenantPlan;              // Subscription plan
  creditsTotal: number;          // Credit quota for current period
  creditsUsed: number;           // Credits consumed in current period
  renewDate?: string;            // ISO timestamp — next renewal date
  stripeCustomerId?: string;     // Stripe customer ID
  stripeSubscriptionId?: string; // Stripe subscription ID
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;     // ISO timestamp — billing period end
  cancelAtPeriodEnd?: boolean;   // Scheduled for cancellation
}

type TenantPlan = 'starter' | 'pro' | 'business' | 'enterprise';
type SubscriptionStatus = 'active' | 'trialing' | 'canceling' | 'past_due' | 'canceled';
```

### Incident

Primary investigation entity. Replaces the legacy "Analysis" model.

```typescript
interface Incident {
  tenantId: string;
  incidentId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  sourceProvider: string;
  rootCause?: string;
  resolution?: string;
  knownSolution?: {
    rootCause: string;
    recommendedFix: string;
    confidence: number;
  };
  createdAt: string;
  updatedAt: string;
}

type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type IncidentStatus = 'open' | 'triaging' | 'investigating' | 'awaiting_approval' | 'remediating' | 'resolved' | 'closed';
```

### Remediation

Represents a proposed fix for an incident.

```typescript
interface Remediation {
  tenantId: string;
  remediationId: string;
  incidentId: string;
  status: RemediationStatus;
  steps: RemediationStep[];
  pullRequests: RemediationPullRequest[];
  proposedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

type RemediationStatus = 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

interface RemediationStep {
  stepId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
}

interface RemediationPullRequest {
  prId: string;
  url: string;
  title: string;
  status: 'open' | 'merged' | 'closed';
}
```

### Integration

Represents a connected external tool or service.

```typescript
interface IntegrationConnection {
  tenantId: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  authType: IntegrationAuthType;
  connectedBy?: string;
  lastTestedAt?: string;
  createdAt: string;
}

type IntegrationType =
  | 'slack' | 'github' | 'jira' | 'cloudwatch' | 'hubspot'
  | 'trello' | 'notion' | 'shortcut' | 'postgresql' | 'linear'
  | 'sentry' | 'mongodb' | 'datadog' | 'pagerduty' | 'grafana'
  | 'confluence' | 'webhooks';

type IntegrationAuthType = 'credentials' | 'oauth';
type IntegrationStatus = 'connected' | 'disconnected' | 'error';
```

### Active Trigger

Event-based triggers from integrations that create incidents.

```typescript
interface ActiveTrigger {
  triggerId: string;
  triggerSlug: string;
  provider: IntegrationType;
  status: 'active' | 'paused' | 'error';
  createdAt: string;
}
```

### User

```typescript
interface User {
  id: string;               // Clerk user ID
  tenantId: string;         // Clerk org ID
  email: string;
  name: string;
  role: UserRole;           // 'admin' | 'member'
  profileComplete: boolean;
  createdAt: string;
}

type UserRole = 'admin' | 'member';

// Team size options during onboarding
type TeamSize = '1_5' | '6_20' | '21_50' | '50plus';
```

### Invite

```typescript
interface Invite {
  tenantId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  expiresAt: string;      // 7-day expiry
  status: InviteStatus;
  createdAt: string;
}

type InviteStatus = 'pending' | 'accepted' | 'expired';
```

### Approval

```typescript
interface Approval {
  approvalId: string;
  notificationId: string;
  incidentId: string;
  remediationId: string;
  status: ApprovalStatus;
  respondedBy?: string;
  respondedAt?: string;
  expiresAt: string;
  createdAt: string;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
```

### Audit Entry

Immutable audit log with hash-chain integrity.

```typescript
interface AuditEntry {
  entryId: string;
  tenantId: string;
  action: AuditAction;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  previousHash: string;    // Hash of the previous audit entry
  entryHash: string;       // Hash of this entry (integrity chain)
  createdAt: string;
}

type AuditAction =
  | 'incident.created'
  | 'incident.status_changed'
  | 'remediation.proposed'
  | 'remediation.approved'
  | 'remediation.rejected'
  | 'remediation.executed'
  | 'approval.responded';
```

### Settings

```typescript
interface Settings {
  tenantId: string;
  notifications: NotificationSettings;
  locale: string;           // 'en' | 'pt-br'
  theme: 'light' | 'dark' | 'system';
}

interface NotificationSettings {
  emailOnComplete: boolean;
  emailOnError: boolean;
  slackOnComplete: boolean;
  slackOnError: boolean;
}
```

### Onboarding Progress

```typescript
interface OnboardingProgress {
  steps: TutorialStep[];
  currentStep: string;
  completed: boolean;
  skipped: boolean;
  startedAt: string;
}

interface TutorialStep {
  key: 'welcome' | 'integrations' | 'relay' | 'firstIncident' | 'receiveEvents' | 'billing' | 'complete';
  icon: string;
  completed: boolean;
}
```

### Pagination

```typescript
interface PageResult<T> {
  items: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}
```

---

## Billing Types

Defined in `src/contexts/billing/domain/types.ts` and `stripe-types.ts`.

### Plan Configuration

Single source of truth: `packages/shared/src/domain/constants/plans.ts`

| Plan | Credits/mo | Monthly Price | Overage Rate |
|---|---|---|---|
| Free | 3 | $0 | N/A |
| Starter | 20 | $79 | $4.99/credit |
| Pro | 75 | $249 | $3.99/credit |
| Business | 200 | $599 | $2.99/credit |
| Enterprise | Unlimited | Custom | N/A |

### Stripe Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, reset credits |
| `customer.subscription.created` | Initialize subscription on tenant |
| `customer.subscription.updated` | Sync plan/status changes |
| `customer.subscription.deleted` | Revert to free plan |
| `invoice.paid` | Renew credits for billing cycle |

---

## Core API Types

Additional types used for Core API communication are in `src/lib/api/core-api-types.ts`:

- `HealthStatus` — System health check response
- `ApiKey` — API key management (id, name, keyPrefix, status)
- `Feedback` — Investigation feedback (rating, comment)
- `PatternAnalytics` — AI-generated pattern insights
- `MemoryInsight` — AI memory/knowledge base entries
- `TopologyNode` / `TopologyEdge` — Service dependency graph
- `Notification` — Real-time notification entries

---

## Legacy: DynamoDB Single-Table Design

The dashboard previously used a DynamoDB single-table design with composite
keys (`pk` + `sk`) and two GSIs. This has been replaced by the Core API
backend. The dashboard no longer owns `src/lib/db/`; domain types live in their
owning bounded context and persistence goes through the Core API client.
