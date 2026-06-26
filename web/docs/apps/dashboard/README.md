# CauseFlow AI — Dashboard (Product App)

The dashboard is the core product application for CauseFlow AI — an AI-powered incident investigation platform for engineering teams. It provides incident management with AI-generated root cause analysis, remediation workflows, team collaboration, integrations with popular engineering tools, and usage-based credit management.

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 15 (App Router, SSR) |
| Auth | Clerk (OAuth: Google, GitHub + email/password) |
| Backend | Core API (`CORE_API_URL`) — dashboard is a frontend client |
| Billing | Stripe v20 (subscriptions, checkout, customer portal, webhooks) |
| Hosting | SST v3 on AWS (CloudFront + Lambda) |
| Styling | Tailwind CSS v4 + `@causeflow/ui` design system |
| Language | TypeScript (strict mode) |
| i18n | next-intl (EN default, PT-BR at `/pt-br/` prefix) |
| Package | `@causeflow/dashboard` |

---

## Routes

All routes live under `src/app/[locale]/` and support both `en` (default, no prefix) and `pt-br` locales.

### Auth Routes

| Route | Description |
|---|---|
| `/auth/sign-in` | Sign in with Clerk (Google, GitHub, or email/password) |
| `/auth/sign-up` | Register a new account via Clerk |

### Onboarding Routes

| Route | Description |
|---|---|
| `/onboarding/welcome` | Initial welcome screen |
| `/onboarding/complete-profile` | Company profile setup (name, website, team size, role, terms) |
| `/onboarding/choose-plan` | Plan selection (Free, Starter, Pro, Business) |
| `/onboarding/connect-aws` | Optional AWS integration setup |

### Dashboard Routes

| Route | Description |
|---|---|
| `/dashboard` | Overview: metrics cards, credits banner, recent incidents, quick actions, saving hours |
| `/dashboard/incidents` | Paginated list of all incidents with status/severity filter |
| `/dashboard/incidents/new` | Create new incident form |
| `/dashboard/incidents/[id]` | Incident detail: investigation results, known solutions, remediation, feedback |
| `/dashboard/integrations` | Integration catalog (17 types) + connection management |
| `/dashboard/team` | Team members list, invite by email, role management |
| `/dashboard/settings` | Profile, company, notifications, appearance, API keys |
| `/dashboard/billing` | Subscription status, plan info, invoices, usage history |
| `/dashboard/audit` | Immutable audit trail with hash-chain integrity |
| `/dashboard/intelligence` | Pattern insights & AI memory (served by `shared` context's memory API) |
| `/dashboard/relay` | Integration relay health status |

### Legacy Routes (Deprecated)

| Route | Description |
|---|---|
| `/dashboard/analyses` | Legacy analysis list (replaced by `/dashboard/incidents`) |
| `/dashboard/analyses/new` | Legacy analysis creation |
| `/dashboard/analyses/[id]` | Legacy analysis detail |

> These routes still exist in the codebase for backwards compatibility but are superseded by the incidents routes.

### Public Routes

| Route | Description |
|---|---|
| `/accept-invitation` | Accept team invitation (email link) |
| `/create-organization` | Clerk organization creation |
| `/waitlist` | Clerk waitlist signup |
| `/beta-waitlist` | Beta access gate (production only) |

### API Routes

58+ REST endpoints organized by domain. See [api-reference.md](./api-reference.md) for full documentation.

---

## Key Features

### Incident Management

- Users create incidents with a title, description, and severity level
- AI investigates using connected integrations and produces root cause analysis
- Incident lifecycle: `open` -> `triaging` -> `investigating` -> `awaiting_approval` -> `remediating` -> `resolved` -> `closed`
- Known solution suggestions with confidence scores
- Feedback collection on investigation quality

### Remediation Workflow

- Propose remediation plans with execution steps
- Approval workflow (admin approves/rejects with reason)
- Automated execution tracking (pull requests, database changes)
- Step-by-step progress monitoring
- Remediation feedback and effectiveness ratings

### Credits System

Each tenant has a monthly credit quota. One credit per analysis/investigation.

| Plan | Credits/mo | Price | Overage |
|---|---|---|---|
| Free | 3 | $0 | N/A |
| Starter | 20 | $79/mo | $4.99/credit |
| Pro | 75 | $249/mo | $3.99/credit |
| Business | 200 | $599/mo | $2.99/credit |
| Enterprise | Unlimited | Custom | N/A |

- Free plan: lazy renewal (reset on next API call after 30 days)
- Paid plans: renewed on Stripe `invoice.paid` webhook each billing cycle
- `402 Payment Required` with `{ code: "CREDITS_EXHAUSTED" }` when no credits remain
- Credits stay active during `canceling` status until `currentPeriodEnd`

### Integration Types (17)

All connections managed via OAuth (Composio) or credential-based auth. Credentials encrypted with KMS before storage.

| Type | Auth Method |
|---|---|
| Slack | Composio OAuth |
| GitHub | GitHub App + Composio OAuth |
| Jira | Composio OAuth |
| AWS CloudWatch | Credential-based (AssumeRole) |
| HubSpot | Composio OAuth |
| Trello | Composio OAuth |
| Notion | Composio OAuth |
| Shortcut | Composio OAuth |
| PostgreSQL | Credentials |
| Linear | Composio OAuth |
| Sentry | Composio OAuth |
| MongoDB | Credentials |
| Datadog | Composio OAuth |
| PagerDuty | Composio OAuth |
| Grafana | Credentials |
| Confluence | Composio OAuth |
| Webhooks | URL configuration |

Features: OAuth flows, credential management, connection testing, trigger management, relay status monitoring.

### Team Management

- Admin can **invite members by email** (7-day expiry)
- **RBAC**: `admin` (full access) vs `member` (submit/view analyses, view integrations)
- Role management: promote/demote members
- Admin cannot remove themselves or change their own role (prevents lockout)
- Accept invitation flow via email link

### Onboarding Tutorial

- **Phase 1**: Sign-up -> Clerk org creation -> profile completion -> plan selection
- **Phase 2**: Modal-based tutorial wizard (triggered via `?welcome=1` or "Restart Tutorial" menu)
- **Steps**: Welcome -> Integrations -> Relay -> First Incident -> Billing -> Complete
- Confetti animation on sign-up completion
- Previous/Next navigation with Skip All option
- Progress persisted in backend and resumable

### Advanced Features

- **Command Palette** (Cmd+K): Fuzzy search for actions and navigation
- **Notification Bell**: Real-time updates via Server-Sent Events (SSE)
- **Pattern Insights**: AI-generated insights about incident trends
- **Memory/Intelligence**: Ask free-form questions about system history, get AI summaries
- **System Status**: Health monitoring of integrations, relay, and dependencies
- **Audit Trail**: Immutable log with hash-based integrity chain
- **Approval Workflows**: Admin approval for critical remediation actions

### Settings

| Tab | Fields |
|---|---|
| Profile | Name, email, avatar (Clerk-managed) |
| Company | Company name, website URL, team size (admin only) |
| Notifications | Email/Slack on analysis complete/error |
| Appearance | Theme (light/dark/system) |
| API Keys | Generate/revoke keys for programmatic Core API access |

---

## Bounded Contexts

All feature code lives under `src/contexts/`, organized into 10 self-contained bounded contexts. Route files under `app/` are thin orchestrators that re-export from contexts. Cross-context imports use direct deep paths (e.g., `@/contexts/team/domain/types`) — context `index.ts` barrel files have been removed.

| Context | Domain | Key Components |
|---|---|---|
| `investigation` | Incidents, analyses, remediations | `IncidentDetail`, `IncidentsList`, `NewIncidentForm`, `RemediationDetail`, `RemediationsList`, `StatusBadge`, `KnownSolutionBanner`, `IncidentFeedback` |
| `identity` | Auth, onboarding, user profile, RBAC | `ConnectAwsForm`, `ProgressIndicator`, `SessionSkeleton`; RBAC permissions, role guards |
| `billing` | Stripe, credits, subscriptions | `PlanCard`, `BillingContent`, `InvoicesTable`, `SubscriptionStatus`, `PaymentModal`, `QuotaPackModal`, `SubscriptionGate`, `UsageHistory`, `ChoosePlanPage` |
| `team` | Team management, invites | `TeamMembersTable`, `InviteModal`, `PendingInvites`, `ChangeRoleDialog`, `RemoveMemberDialog`, `RoleBadge` |
| `integrations` | External service connections | `IntegrationCard`, `ConnectionModal`, `DisconnectDialog`, `CategoryFilter`, `StatusIndicator`, `RelayStatus`, `IntegrationCatalog` |
| `settings` | User/company preferences | `ProfileTab`, `CompanyTab`, `NotificationsTab`, `AppearanceTab`, `ApiKeysTab`, `SettingsContent` |
| `approvals` | Approval workflows | `ApprovalsList` |
| `audit` | Audit trail & compliance | `AuditList` |
| `onboarding` | Tutorial & setup wizard | `OnboardingOrchestrator`, `OnboardingModal`, `OnboardingChecklist`, `OnboardingStepCard`, `StepHighlights` |
| `shared` | Layout, navigation, cross-context UI | `DashboardLayout`, `Sidebar`, `Topbar`, `CommandPalette`, `CreditsBanner`, `NotificationBell`, `MetricsCard`, `RecentAnalyses`, `QuickActions`, `PatternInsights`, `SystemStatus`, `WelcomeTour`, `ErrorBoundary`, `ClerkThemeProvider`, `EmptyState`, `SavingHours` |

Each context uses DDD layers (only layers the context needs):

| Layer | Purpose |
|---|---|
| `domain/` | Pure business types — no framework imports |
| `application/` | Use cases, service orchestration |
| `infrastructure/` | API schemas, i18n JSON files, external SDKs |
| `presentation/components/` | React components and UI |
| `presentation/pages/` | Server/client page implementations |
| `presentation/hooks/` | React hooks |
| `api/` | API route handler implementations |

App-level `src/lib/` contains shared infrastructure: API auth HOC (`withAuth`), Core API client (`api/core-api-client.ts`, `api/http-api-client.ts`, `api/mock-api-client.ts`), rate limiting, i18n composer, DynamoDB client, KMS encryption, and base repository utilities.

---

## Architecture

### API Design Pattern

All API routes follow a thin re-export pattern:

```typescript
// app/api/billing/checkout/route.ts — THIN RE-EXPORT
export { POST } from '@/contexts/billing/api/checkout-handler';

// Handler implementation
export const POST = withAuth(async (request, ctx, params) => {
  // ctx = { userId, tenantId, email, name, role, profileComplete }
  const body = await parseBody(request, checkoutSchema);
  const result = await getApiClient().createCheckoutSession(ctx.tenantId, body);
  return NextResponse.json(result, { status: 200 });
}, { adminOnly: true });
```

**Key infrastructure:**
- `withAuth()` — Authentication, RBAC, rate limiting (60 req/min per user per endpoint)
- `getApiClient()` — Returns `HttpApiClient` (when `CORE_API_URL` is set) or `MockApiClient` (for local dev)
- `parseBody()` — Zod schema validation
- Clerk session — Extracts userId, tenantId (orgId), role from Clerk session

### Clerk Organization Model

- One Clerk organization per tenant
- `orgRole`: `org:admin` or `org:member` (default)
- `orgId` = `tenantId`
- Middleware maps Clerk org roles to app roles

---

## Local Development

```bash
# From monorepo root
pnpm turbo dev

# Dashboard only
pnpm --filter dashboard dev
# Starts on http://localhost:3001
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

Key variables:

| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CORE_API_URL` | Core API base URL (leave blank to use mock client) |
| `CORE_API_KEY` | Core API authentication key (leave blank for mock) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe Price ID for Starter plan |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe Price ID for Business plan |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 ID |
| `NEXT_PUBLIC_CLARITY_ID` | Microsoft Clarity ID |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | `staging` or `production` |

When `CORE_API_URL` is **not set**, the API client falls back to a mock implementation, allowing full local development without backend infrastructure.

### Build & Test

```bash
pnpm turbo build                           # Build all
pnpm --filter dashboard build              # Build dashboard only
pnpm vitest run --project dashboard        # Run dashboard tests
pnpm vitest --project dashboard            # Watch mode
```

### CLI Scripts

```bash
pnpm --filter dashboard run credits:add -- --tenant <id> --amount <n>   # Add credits manually
pnpm --filter dashboard run stripe:setup                                 # Initialize Stripe products
```

---

## Deployment

Deployed via SST v3 on AWS from `apps/dashboard/sst.config.ts`.

```bash
(cd apps/dashboard && sst deploy --stage staging)       # Staging
(cd apps/dashboard && sst deploy --stage production)    # Production
```

| Environment | URL |
|---|---|
| Production | `https://dashboard.causeflow.ai` |
| Staging | `https://dashboard-staging.causeflow.ai` |
| Local Dev | `http://localhost:3001` |

SST injects all environment variables at deploy time — no `.env.staging` or `.env.production` files exist.

---

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `@causeflow/analytics` | GA4 + Microsoft Clarity tracking |
| `@causeflow/auth` | Auth.js config, session types, RBAC utils |
| `@causeflow/forms` | Form validation logic |
| `@causeflow/shared` | Types, constants, i18n keys, staging-auth middleware |
| `@causeflow/ui` | Design system (Tailwind + Shadcn/ui components) |
| `@clerk/nextjs` | Clerk authentication & organization management |
| `@clerk/themes` | Clerk UI theme customization |
| `stripe` | Stripe SDK v20 for billing |
| `@stripe/react-stripe-js` | Stripe React components |
| `@stripe/stripe-js` | Stripe.js client library |
| `canvas-confetti` | Confetti animation on onboarding completion |
| `driver.js` | Product tour / step highlights |
| `react-markdown` | Markdown rendering for AI responses |
| `next-intl` | i18n routing and message loading |
| `jose` | JWT utilities |
| `zod` | Request body validation in all API routes |

### Dev

`tailwindcss`, `@tailwindcss/postcss`, `typescript`, `@types/*`, `tsx`

---

## Related Documentation

- [API Reference](./api-reference.md) — All 58+ REST endpoints
- [Auth Flow](./auth-flow.md) — Clerk authentication, middleware chain, RBAC
- [Data Models](./data-models.md) — Core API entities, domain types
