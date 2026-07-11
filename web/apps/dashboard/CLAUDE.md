# CauseFlow AI — Dashboard

Product application for incident investigation. Next.js 15 App Router with SSR (Server-Side Rendering).

> For global rules, task workflow, and tech stack, see the root [CLAUDE.md](../../CLAUDE.md).

## App Overview

- **Purpose**: Incident investigation, root cause analysis, team collaboration, integration management
- **Rendering**: Server-Side Rendering (SSR) with Clerk session management
- **Auth**: Clerk (`@clerk/nextjs` v7) — Clerk-hosted sign-in/sign-up, Clerk organizations → multi-tenancy, Google/GitHub/email social providers configured in the Clerk dashboard
- **Database**: None owned by the dashboard — all data lives behind the Core API (`CORE_API_URL`). The dashboard is a Clerk-authenticated proxy/UI. No DynamoDB, no KMS, no SQS in this app.
- **Hosting**: AWS CloudFront + Lambda@Edge via SST (Clerk is hosted by Clerk)

## Routes

### Authentication
| Route | Purpose |
|---|---|
| `/auth/sign-in` | Clerk `<SignIn>` component (email, Google, GitHub) |
| `/auth/sign-up` | Clerk `<SignUp>` component |
| `/auth/forgot-password` | Clerk-managed password reset |
| `/auth/verify-email` | Clerk-managed email verification |

### Onboarding
| Route | Purpose |
|---|---|
| `/onboarding/complete-profile` | Company + team size + role form (redirects to `/dashboard` on success) |

> **Note:** `/onboarding/welcome` and `/onboarding/connect-integration` pages were deleted. The API endpoint `/api/onboarding/connect-integration` still exists but has no corresponding UI page.

### Beta Gate
| Route | Purpose |
|---|---|
| `/beta-waitlist` | "We're in beta" page for non-allowlisted users (production only) |

### Dashboard
| Route | Purpose |
|---|---|
| `/dashboard` | Overview (metrics, recent analyses, quick actions) |
| `/dashboard/analyses` | List analyses with filters |
| `/dashboard/analyses/new` | Create new analysis |
| `/dashboard/analyses/[id]` | Analysis detail (results, timeline, recommendations) |
| `/dashboard/integrations` | Integration catalog + management |
| `/dashboard/team` | Team members + invite |
| `/dashboard/settings` | Profile, company, notifications, appearance |
| `/dashboard/billing` | Plan and billing info |
| `/dashboard/topology` | Infrastructure topology (service graph, health, blast radius) |

### Billing
| Route | Purpose |
|---|---|
| `/dashboard/billing` | Plan info, subscription status, upgrade/cancel actions |

### API (44 endpoints)
See [API Reference](../../docs/apps/dashboard/api-reference.md) for complete documentation.

**Billing API (5 endpoints):**
| Endpoint | Purpose |
|---|---|
| `POST /api/billing/checkout` | Create Stripe Checkout session (admin only) |
| `POST /api/billing/portal` | Create Stripe Customer Portal session (admin only) |
| `POST /api/billing/webhook` | Handle Stripe lifecycle events (no auth — signature-verified) |
| `GET /api/billing/subscription` | Current subscription state (admin only) |
| `GET /api/billing/usage` | Usage history for the tenant (Core API proxy) |

**Settings API (3 endpoints, +2 new):**
| Endpoint | Purpose |
|---|---|
| `GET /api/settings` | Fetch user/company settings |
| `PATCH /api/settings` | Update settings |
| `GET/PUT /api/settings/llm-connector` | OSS investigation LLM connector proxy (Core `/v1/oss/llm-connector`, AC-059) |
| `GET/POST/DELETE /api/settings/api-keys` | API key management (CORE_API_URL feature) |

**Incidents API (2 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /api/incidents` | List incidents with optional `?status=active&limit=N&cursor=` passthrough |
| `GET/POST /api/incidents/[id]/feedback` | Incident feedback (CORE_API_URL feature) |

**Approvals API (3 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /api/approvals` | List all approvals (paginated) |
| `GET /api/approvals/pending` | List pending approvals only (Core API proxy) |
| `POST /api/approvals/[id]/respond` | Respond to an approval |

**Relay API (1 endpoint):**
| Endpoint | Purpose |
|---|---|
| `GET /api/relay/status` | Relay connection status (Core API proxy) |

**Memory API (3 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /api/memory/insights` | Memory-based insights for the tenant (Core API proxy) |
| `GET /api/memory/summary` | Memory summary |
| `POST /api/memory/ask` | Ask a question against memory |

**Topology API (3 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /api/topology` | List service nodes, edges, health (combined) |
| `GET /api/topology/[serviceId]` | Service detail + blast radius |
| `GET /api/topology/health` | System-wide health summary (Core API proxy) |

**Health API (1 endpoint):**
| Endpoint | Purpose |
|---|---|
| `GET /api/health/detailed` | Detailed health check with dependencies |

**Notifications API (2 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /api/notifications` | List notifications (supports `?limit=N&cursor=`) |
| `PATCH /api/notifications` | Mark notification read |

**Pattern Analytics API (1 endpoint):**
| Endpoint | Purpose |
|---|---|
| `GET /api/pattern-analytics` | Pattern analytics data |

## Bounded Contexts

All feature code lives under `src/contexts/`. Route files under `app/` are thin orchestrators. Cross-context imports use direct deep paths (e.g., `@/contexts/team/domain/types`) — context `index.ts` barrel files have been removed.

Each context uses DDD layers (create only the layers the context needs):

| Layer | Purpose |
|---|---|
| `domain/` | Pure business types — no framework imports |
| `application/` | Use cases, service orchestration |
| `infrastructure/` | DB repositories, API schemas, i18n JSON files, external SDKs |
| `presentation/components/` | React components and UI |
| `presentation/pages/` | Server/client page implementations (moved out of `app/`) |
| `api/` | API route handler implementations (moved out of `app/api/`) |

Per-context i18n files live at `infrastructure/i18n/en.json` and `pt-br.json`. A composer at `src/lib/i18n/compose.ts` deep-merges all context files into a unified message tree for next-intl.

### Re-export Pattern (`src/app/` as ultra-thin layer)

`src/app/` files are now thin re-exports that delegate all implementation to the owning context:

```typescript
// app/[locale]/dashboard/billing/page.tsx — THIN RE-EXPORT ONLY
export { BillingPage as default } from '@/contexts/billing/presentation/pages/billing-page';
```

```typescript
// app/api/billing/checkout/route.ts — THIN RE-EXPORT ONLY
export { POST } from '@/contexts/billing/api/checkout-handler';
```

> **Critical rule:** Next.js `dynamic` and `runtime` config exports (`export const dynamic = 'force-dynamic'`, `export const runtime = 'edge'`) MUST be inlined directly in the `app/` route file — they cannot be re-exported from context files. The Next.js static analyzer only reads config from the route file itself.

### Import Convention: Direct Deep Paths (No Barrels)

Context `index.ts` barrel files have been **deleted** from all 9 dashboard contexts. All imports must use direct deep paths to the specific file within the owning context:

```typescript
// CORRECT — direct deep path
import type { Incident } from '@/contexts/investigation/domain/types';
import { analysisRepository } from '@/contexts/investigation/infrastructure/analysis-repository';

// WRONG — barrel imports (index.ts files no longer exist)
import { Incident } from '@/contexts/investigation';
import type { Incident } from '@/lib/db/types';
import { analysisRepository } from '@/lib/db';
```

The `lib/db/` directory has been **removed entirely**. The dashboard owns no storage — types live in their owning context (`@/contexts/<name>/domain/types`) and all persistence goes through the Core API client at `@/lib/api/http-api-client`. If you see any reference to `lib/db/*` in older docs or code, it is stale.

| Context | Domain | Key Paths |
|---|---|---|
| `investigation` | Incidents, analyses, remediations, live SSE stream | `domain/` (types.ts, incident-stream-types.ts), `application/` (incident-simulator, incident-templates, services), `infrastructure/` (analysis/incident/remediation-repository, mock-data, api-schema, i18n), `presentation/components/` (8 + `incident-detail/` sub-folder: disconnected-banner, live-activity-timeline, agent-step-card, incident-status-panel, incident-narrative, incident-action-bar, remediations-empty-state, feedback-empty-state, plus `lib/agent-role-meta.ts`, `lib/agent-step-mappers.ts`), `presentation/hooks/` (use-incident-stream, use-incident-actions), `presentation/pages/` (incidents, new-incident, incident-detail), `api/` (analyses-handler, analyses-id-handler, feedback-handler, remediations-handler, remediations-id-handler) |
| `approvals` | Approval workflows | `domain/types.ts`, `infrastructure/i18n/`, `presentation/components/` (1), `api/` (approvals-handler, approval-respond-handler) |
| `audit` | Audit trail & compliance | `domain/types.ts`, `infrastructure/i18n/`, `presentation/components/` (1), `presentation/pages/` (audit-page), `api/` (audit-handler) |
| `identity` | Auth, user profile, RBAC | `domain/types.ts`, `domain/rbac/permissions.ts` (roles, `usePermission`, `RoleGuard`), `infrastructure/user-repository.ts`, `infrastructure/i18n/`, `presentation/components/` (5), `presentation/pages/` (sign-in, sign-up, forgot-password, verify-email, complete-profile), `api/` (complete-profile-handler). Clerk sessions accessed via `auth()` from `@clerk/nextjs/server` directly — no custom `lib/auth*.ts` wrapper. |
| `onboarding` | Post-signup flow: profile completion, integration connection API | `domain/types.ts`, `infrastructure/i18n/`, `api/` (connect-integration-handler). No UI pages — `/onboarding/welcome` and `/onboarding/connect-integration` pages were deleted; only the API handler remains. |
| `team` | Team management, invites | `domain/types.ts`, `infrastructure/i18n/`, `presentation/components/` (7, 4 test files), `presentation/pages/` (team-page), `api/` (team-handler, team-invite-handler, team-invites-handler, team-invite-email-handler, team-user-handler, team-user-role-handler) |
| `integrations` | External service connections | `domain/types.ts`, `infrastructure/` (integration-repository, api-schema, i18n), `presentation/components/` (9, 6 test files), `presentation/pages/` (integrations-page), `api/` (integrations-handler, integration-type-handler) |
| `billing` | Stripe, credits, subscriptions | `domain/` (types, stripe-types), `application/services.ts` (checkout, portal), `infrastructure/` (stripe-client, webhook-handlers, api-schema, i18n), `presentation/components/` (1), `presentation/pages/` (billing-page), `api/` (checkout-handler, portal-handler, subscription-handler, webhook-handler, metrics-handler) |
| `settings` | User/company preferences | `domain/types.ts`, `infrastructure/` (settings-repository, api-schema, i18n), `presentation/components/` (6, 3 test files), `presentation/pages/` (settings-page), `api/` (settings-handler, api-keys-handler) |
| `shared` | Layout, navigation, command palette, cross-context UI, topology view | `domain/types.ts`, `infrastructure/` (tenant-repository, i18n), `presentation/components/` (19+, includes topology-view), `presentation/pages/` (dashboard-page, topology-page), `api/` (health-handler, health-detailed-handler, notifications-handler, pattern-analytics-handler, topology-handler, topology-service-handler), `lib/monitoring/`, `lib/confetti.ts` |

## Key Files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Clerk `clerkMiddleware()` → staging auth → profile guard → i18n |
| `src/contexts/identity/domain/rbac/permissions.ts` | Role definitions, `PERMISSIONS` map, `usePermission` hook, `RoleGuard` (roles read from Clerk org membership) |
| `src/contexts/billing/application/plan-status.ts` | `fetchPlanStatus()` / `getPlanStatus()` — computes real plan status from Core API subscription (`status` + `stripeCustomerId`) |
| `src/contexts/billing/presentation/pages/choose-plan-page.tsx` | Onboarding plan gate (admin-only flow + non-admin fallback + sign-out) |
| `src/contexts/billing/api/checkout-handler.ts` | Creates Stripe Checkout session via Core API (`api.createCheckout`) |
| `src/contexts/billing/api/subscription-handler.ts` | Reads subscription state from Core API |
| `src/contexts/investigation/application/incident-simulator.ts` | AI processing simulator (queued → running → completed) |
| `src/lib/i18n/compose.ts` | Deep-merges per-context i18n JSON files into a single next-intl message tree |
| `src/lib/api/with-auth.ts` | `withAuth()` HOC for API routes (Clerk session + RBAC + rate limit) |
| `src/lib/api/get-backend-token.ts` | Fetches the Clerk session token to attach as Bearer when calling the Core API |
| `src/lib/api/schemas.ts` | Zod schemas for all API inputs |
| `src/lib/api/core-api-types.ts` | TypeScript types for Core API (Health, ApiKey, Feedback, PatternAnalytics, 15+ types total) |
| `src/lib/api/core-api-client.ts` | `ICoreApiClient` interface (29 methods: health/api-keys/feedback/patterns) |
| `src/lib/api/http-api-client.ts` | HTTP implementation of `ICoreApiClient` (Bearer auth with Clerk JWT) |
| `src/lib/api/mock-api-client.ts` | Mock implementation of `ICoreApiClient` |
| `src/lib/slug.ts` | `generateSlug()` and `randomSlugSuffix()` for tenant slug generation |
| `src/lib/rate-limit.ts` | Per-user rate limiting (60/min per endpoint) |
| `next.config.mjs` | Security headers, transpilePackages, optimizePackageImports (AC-050: no `withSentryConfig`) |
| `Dockerfile` | Multi-stage Docker build (AC-050: SST removed, runs as plain Node process) |

## RBAC

| Permission | Admin | Member |
|---|---|---|
| MANAGE_TEAM | yes | no |
| MANAGE_INTEGRATIONS | yes | no |
| MANAGE_BILLING | yes | no |
| MANAGE_SETTINGS | yes | no |
| SUBMIT_ANALYSIS | yes | yes |
| VIEW_ANALYSES | yes | yes |
| VIEW_INTEGRATIONS | yes | yes |
| VIEW_BILLING | yes | yes |
| VIEW_SETTINGS | yes | yes |
| VIEW_TEAM | yes | yes |

## Credits System

- Free plan: 3 credits/month (lazy renewal every 30 days via `GET /api/metrics`)
- Starter: 20 credits/month ($79/mo, $4.99 overage)
- Pro: 75 credits/month ($249/mo, $3.99 overage)
- Business: 200 credits/month ($599/mo, $2.99 overage)
- Enterprise: unlimited (contact sales)
- 1 credit per analysis
- Paid plan renewal: triggered by `invoice.paid` Stripe webhook each billing cycle
- Free plan renewal: lazy (reset on next API call when `renewDate` has passed)
- `402 Payment Required` with `{ code: "CREDITS_EXHAUSTED" }` if no credits remain
- Credits stay active during `canceling` status until `currentPeriodEnd`
- Single source of truth: `packages/shared/src/domain/constants/plans.ts`

## 15 Integration Types

Slack, GitHub, Jira, AWS CloudWatch, HubSpot, Trello, PostgreSQL, Linear, Sentry, MongoDB, Datadog, PagerDuty, Grafana, Confluence, Webhooks

Each has type-specific Zod validation for credentials. Credentials are forwarded to the Core API, which handles encryption (KMS envelope) and DynamoDB storage — the dashboard never holds credentials at rest.

## Middleware Pipeline

1. **Staging auth** — cookie check (`staging-authorized:<base64_password>`)
2. **Public routes bypass** — `/auth/*`, `/api/health`, `/staging-auth`, `/api/billing/webhook`
3. **Clerk session check** — `clerkMiddleware()` redirects to `/auth/sign-in` if missing
4. **Profile completion guard** — incomplete → `/onboarding/complete-profile` or `/onboarding/choose-plan`; complete → block onboarding access
5. **Locale detection** — Accept-Language + NEXT_LOCALE cookie

> `/api/billing/webhook` is bypassed by middleware — Stripe sends raw POST from the Core API relay and must NOT be intercepted. Signature verification happens in the route handler. In the current architecture the dashboard's webhook route only accepts events forwarded by the Core API, because Stripe points at the Core API directly.

## Observability — Sentry

Sentry wired via Next.js instrumentation hook at three runtime boundaries:

| File | Purpose |
|---|---|
| `instrumentation.ts` | Registers server/edge configs + exports `onRequestError` for Next.js error forwarding |
| `instrumentation-client.ts` | Browser init — PII scrubbing (auth headers, cookies, request bodies), env-aware sampling |
| `sentry.server.config.ts` | Server runtime init — same PII scrubbing + sampling |
| `sentry.edge.config.ts` | Edge runtime init — same PII scrubbing + sampling |
| `src/app/global-error.tsx` | Root error boundary — client component; captures via `Sentry.captureException(error)` in `useEffect` |

`next.config.mjs` wraps final config with `withSentryConfig` (source-map upload, webpack treeshake). Disable by leaving `NEXT_PUBLIC_SENTRY_DSN` blank — SDK no-ops without a DSN. SOC2/GDPR/LGPD PII scrubbing runs in every `beforeSend` hook.

## Data Models

The dashboard does **not** own any persisted data. All entities (`Tenant`, `User`, `Incident`, `Remediation`, `Pattern`, `ApiKey`, `BillingAccount`, `Invite`, `UserSettings`, `Integration`, `AuditEntry`, etc.) live in the Core API's DynamoDB single-table design (table `causeflow-<stage>`) and are modeled with ElectroDB. The full authoritative schema is in the Core repository at `causeflow/core/docs/product/05-data-model.md` and `causeflow/core/src/shared/infra/db/entities/`.

Clerk owns user identity + organization membership; the Core API mirrors the Clerk `user_id` → its own `User`/`Tenant` records keyed by email.

## Environment Variables

| Variable | Purpose |
|---|---|
| `CORE_API_URL` | Base URL for the Core API. Blank in local (non-Docker) dev falls through to the mock client. |
| `JWT_SECRET` | Shared with Core for local JWT auth (OSS runtime; must match Core). |
| `CAUSEFLOW_RUNTIME` | Set to `oss` for StubBillingService plan-gate behavior (AC-048). |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_ID` | Analytics IDs (blank = no-op). |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (client + server + edge). Blank → SDK no-ops. |
| `NEXT_PUBLIC_SITE_URL` | Canonical dashboard URL per stage |

Copy `apps/dashboard/.env.example` → `.env.local` for OSS local dev.
`STRIPE_SECRET_KEY` is **never** listed in dashboard env templates or runtime injection (AC-031 / AC-053) — billing secrets live on Core only.
Do not set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in OSS `.env.local`; it flips `isOssRuntime()` off.

## Billing (OSS)

Commercial Stripe SDKs (`@stripe/react-stripe-js`, `@stripe/stripe-js`, `stripe`) are **not** installed in the dashboard (AC-048 / AC-049).

- Checkout / portal handlers proxy to Core via `getApiClient()`; Core's StubBillingService returns 410 Gone → UI shows "Billing disabled in OSS build".
- `payment-modal.tsx` is an OSS stub — no PaymentElement / loadStripe.
- Webhook signature verification and any Stripe secret key stay on Core; the dashboard webhook route fails closed.
- Plan config (single source of truth): `packages/shared/src/domain/constants/plans.ts`.

## Local Development

```bash
pnpm --filter dashboard dev    # http://localhost:3001
pnpm --filter dashboard build  # Production build
```

Dev mode uses the mock Core API client when `CORE_API_URL` is blank — nothing in AWS is required to run locally.

### CLI Scripts

```bash
# Add credits to a tenant via Core API (requires CORE_API_URL env)
pnpm --filter dashboard run credits:add -- --tenant <tenantId> --amount <n> [--reason "reason"]
```

Scripts live in `apps/dashboard/scripts/`. The commercial `stripe:setup` and `users:delete` CLIs were removed with the OSS Stripe/AWS purge (AC-048 / AC-049). Run from the project root using `pnpm --filter dashboard run <script>`.

## Verification Protocol for Dashboard Changes

Every change to `web/apps/dashboard/` MUST be verified end-to-end before declaring done. The user has explicitly required this protocol — bugs have shipped because changes were not visually verified.

### 1. Local sanity (every change)
- Run `pnpm --filter dashboard dev` (port 3001). With `CORE_API_URL` blank in `.env.local`, the dashboard uses the mock Core API client — most UI changes can be verified against the mock alone.
- Drive the changed page with Playwright — either `pnpm exec playwright codegen http://localhost:3001/...` (interactive) or a scripted spec.
- Capture screenshots into `.artifacts/playwright/screenshots/YYYY-MM-DD_HHmm/`.
- Verify both browser console (`page.on('console')`) and the Next.js dev-server console are clean of errors before claiming done.

### 2. Staging verification (every UI flow that hits the real Core API, every webhook, every Sentry-related change)
- Sign in to `https://dashboard-staging.causeflow.ai` using the test creds in `web/apps/dashboard/.env.staging` (`STAGING_TEST_USER`, `STAGING_TEST_PASSWORD`). These are **login credentials only**, not runtime env — do NOT `cp` them over `.env.local`.
- In a parallel terminal: `aws logs tail /ecs/causeflow-staging-api --follow`. Keep the tail running while clicking through the change. Cross-check the API calls in the tail against the expected behavior — the tail is the source of truth.
- For Sentry-related changes: ask the user to perform the Sentry-side setup (Internal Integration creation, paste Client Secret in modal). Don't fake it; wait for confirmation.
- For features that depend on a real Core API response, run dashboard locally against staging by setting `CORE_API_URL=https://api-staging.causeflow.ai` plus valid Clerk staging keys in `.env.local`. Never put runtime secrets into `.env.staging`.

### 3. E2E (every PR that touches dashboard UI or APIs)
- Add or extend a Playwright spec under `web/tests/e2e/dashboard/` covering the changed flow. The PR must not merge without one.
- Round-trip tests that depend on staging-side state (e.g., real Sentry → core webhook) are gated by `E2E_TARGET=staging` and skipped locally.

### 4. Manual user steps
- When a change requires manual configuration outside the dashboard (Sentry Internal Integration, GitHub OAuth app, Slack workspace approval, etc.), the agent MUST pause and ask the user. Don't claim done before the user confirms the manual step. Surface the exact manual steps in the PR description.

### Reference URLs
- Staging dashboard: `https://dashboard-staging.causeflow.ai`
- Staging core API: `https://api-staging.causeflow.ai`
- Staging core logs: `aws logs tail /ecs/causeflow-staging-api --follow`
- Staging login creds (Playwright-only): `web/apps/dashboard/.env.staging` — `STAGING_TEST_USER` / `STAGING_TEST_PASSWORD`.

## Documentation

- [Dashboard README](../../docs/apps/dashboard/README.md)
- [API Reference](../../docs/apps/dashboard/api-reference.md)
- [Auth Flow](../../docs/apps/dashboard/auth-flow.md)
- [Data Models](../../docs/apps/dashboard/data-models.md)
- [Architecture Overview](../../docs/architecture/overview.md)
- [Deployment](../../docs/deployment/dashboard-deploy.md)
