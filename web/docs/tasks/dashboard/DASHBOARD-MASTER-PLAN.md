# CauseFlow AI — Dashboard Master Plan

> **Status:** COMPLETE — All 10 phases implemented
> **Created:** 2026-02-24
> **Completed:** 2026-02-24
> **Domain:** dashboard.causeflow.ai
> **App:** `apps/dashboard/` (Next.js, SSR)

---

## Executive Summary

Build the CauseFlow AI Dashboard — a multi-tenant SaaS application for AI-powered incident investigation. The dashboard enables engineering teams (2-50 engineers) to submit investigations, manage integrations, track usage/credits, and collaborate with role-based access.

**Architecture:** Next.js 15 (App Router, SSR) + AWS Cognito + DynamoDB + KMS, deployed via SST to `dashboard.causeflow.ai`.

---

## Architecture Decisions

### Authentication: Cognito + Auth.js (next-auth v5)

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Identity Provider | AWS Cognito User Pool | User management, social federation (Google/GitHub), Lambda triggers for custom SES emails, MFA |
| Session Layer | Auth.js v5 (next-auth) | Next.js middleware auth guards, JWT session management, OIDC integration with Cognito |
| Email | Amazon SES + Lambda | Branded HTML verification emails, password reset, invite emails |

**Why Auth.js on top of Cognito?** Auth.js gives us native Next.js middleware integration, type-safe sessions, and clean callback hooks for onboarding redirects — without reinventing session management. Cognito handles the heavy lifting (user pool, social federation, Lambda triggers).

**Flow:**
1. User signs up → Cognito creates user → Lambda trigger sends branded SES email
2. User verifies email → signs in → Auth.js creates JWT session
3. Middleware checks session + profile completeness → routes to `/dashboard` or `/onboarding/complete-profile`
4. Social users (Google/GitHub) → Cognito federated sign-in → Auth.js session → middleware detects missing company attributes → redirect to onboarding

### Database: DynamoDB Single-Table Design

**Partition strategy:** `tenantId` as the partition key for all entities → logical tenant isolation.

| Entity | PK | SK | Example |
|--------|----|----|---------|
| Tenant | `TENANT#<id>` | `METADATA` | Company name, plan, credits, created |
| User | `TENANT#<id>` | `USER#<userId>` | Name, email, role, lastLogin |
| Analysis | `TENANT#<id>` | `ANALYSIS#<timestamp>#<id>` | Prompt, status, result, confidence |
| Integration | `TENANT#<id>` | `INTEGRATION#<type>` | Type, encrypted credentials, status |
| Settings | `TENANT#<id>` | `SETTINGS` | Notification prefs, theme, locale |
| Invite | `TENANT#<id>` | `INVITE#<email>` | Role, invitedBy, expiresAt |

**GSIs:**
- `GSI1`: `PK=userId, SK=tenantId` → Look up user's tenant(s)
- `GSI2`: `PK=TENANT#<id>, SK=status#timestamp` → Filter analyses by status

**Encryption:** Integration credentials encrypted with AWS KMS (per-tenant key or shared key with tenant context). Decrypt in-memory only, never log plaintext.

### New Packages

| Package | Purpose |
|---------|---------|
| `packages/auth/` | Cognito SDK integration, Auth.js config, session types, auth utilities |
| Database layer | `apps/dashboard/src/lib/db/` — DynamoDB client, repositories, KMS encryption (stays in app until a second consumer needs it) |

### Dashboard Layout

```
+----------------------------------------------------------+
|  Topbar: Logo | Breadcrumbs | Search (Cmd+K) | Theme | User Menu  |
+------+---------------------------------------------------+
|      |                                                   |
| Side |   Main Content Area                               |
| bar  |                                                   |
|      |   (scrollable, responsive)                        |
| Nav  |                                                   |
|      |                                                   |
|      |                                                   |
+------+---------------------------------------------------+
```

**Sidebar items:**
- Overview (home)
- Analyses (history + new)
- Integrations
- Team (RBAC)
- Settings
- Credits/Usage (badge)

---

## Phases

### Phase 1: Dashboard App Scaffold & Layout — COMPLETE
**Effort:** ~1 session | **Dependencies:** None

Create the Next.js app, configure shared packages, build the dashboard shell layout.

- Create `apps/dashboard/` with Next.js 15 (App Router, SSR)
- Configure TypeScript, Tailwind, Biome, Turbo pipeline
- Integrate `@causeflow/ui` theme system (light/dark, theme switcher in topbar)
- Set up `next-intl` for i18n (EN default, PT-BR)
- Build dashboard layout: collapsible sidebar + topbar + main content area
- Create placeholder routes: `/dashboard`, `/dashboard/analyses`, `/dashboard/integrations`, `/dashboard/team`, `/dashboard/settings`
- Add Vitest project config for dashboard
- Extend Playwright config for dashboard E2E tests
- Add `apps/dashboard/sst.config.ts` skeleton for `dashboard.causeflow.ai`

**Deliverable:** Running dashboard shell at `localhost:3001` with navigation, theme toggle, responsive layout. No auth yet — all routes public.

---

### Phase 2: Authentication (Cognito + Auth.js) — COMPLETE
**Effort:** ~2 sessions | **Dependencies:** Phase 1

Full authentication flow with Cognito User Pool, social login, and branded emails.

- Create `packages/auth/` with clean architecture
  - Domain: session types, user types, role types
  - Infrastructure: Cognito SDK client, Auth.js config + providers
  - Presentation: `useSession` hook, `AuthProvider`, `withAuth` HOC
- SST resources: Cognito User Pool (email/password + Google + GitHub federation)
- SST resources: SES domain verification for `causeflow.ai`
- Lambda trigger: Custom Message → branded HTML email template (CauseFlow AI branding)
- Auth pages (custom UI, not Cognito hosted UI):
  - `/auth/sign-in` — Email/password + social buttons
  - `/auth/sign-up` — Registration form
  - `/auth/verify-email` — Verification code input
  - `/auth/forgot-password` — Reset flow
- Next.js middleware: protect `/dashboard/*` routes, redirect unauthenticated users to `/auth/sign-in`
- Session management: JWT with access/refresh tokens, auto-refresh
- User menu in topbar: avatar, name, sign-out

**Deliverable:** Full sign-up → verify email → sign-in → protected dashboard flow. Social login with Google and GitHub.

---

### Phase 3: Onboarding Flow — COMPLETE
**Effort:** ~1 session | **Dependencies:** Phase 2

Guide new users (especially social login) through profile and company setup.

- Middleware logic: detect missing profile attributes → redirect to `/onboarding/complete-profile`
- Onboarding pages:
  - `/onboarding/complete-profile` — Company name, website URL, team size, role
  - `/onboarding/connect-first-integration` — Quick setup of one integration (optional, skip-able)
  - `/onboarding/welcome` — Success screen with next steps
- Progress indicator (step 1/2/3)
- Save company as Tenant entity in DynamoDB
- Set user's `tenantId` and `role=Admin` (first user = admin)
- After completion → redirect to `/dashboard`

**Deliverable:** Smooth onboarding that creates the tenant, sets up the admin user, and optionally connects a first integration.

---

### Phase 4: Database & Data Layer (DynamoDB + KMS) — COMPLETE
**Effort:** ~1-2 sessions | **Dependencies:** Phase 2

Build the data access layer with tenant isolation and encryption.

- SST resources: DynamoDB table with single-table design + GSIs
- SST resources: KMS key for integration credential encryption
- Data access layer (`apps/dashboard/src/lib/db/`):
  - DynamoDB client (AWS SDK v3)
  - Base repository with automatic `tenantId` injection
  - Entity repositories: Tenant, User, Analysis, Integration, Settings
  - KMS encryption utilities: `encrypt(plaintext)`, `decrypt(ciphertext)`
- API routes (Next.js Route Handlers under `app/api/`):
  - `POST /api/analyses` — Submit new analysis
  - `GET /api/analyses` — List analyses (paginated, by tenant)
  - `GET /api/analyses/[id]` — Get analysis detail
  - `GET /api/integrations` — List integrations
  - `POST /api/integrations` — Connect integration (encrypt credentials)
  - `DELETE /api/integrations/[type]` — Disconnect integration
  - `GET /api/metrics` — Dashboard overview metrics
  - `GET /api/team` — List team members
  - `POST /api/team/invite` — Invite team member
  - `PATCH /api/team/[userId]/role` — Change user role (Admin only)
- Middleware: extract `tenantId` from session, inject into every DB operation
- Input validation with Zod schemas on all API routes
- Rate limiting on API routes

**Deliverable:** Complete API layer with tenant-isolated data access, encrypted credentials, and validated inputs.

---

### Phase 5: Dashboard Home & Metrics — COMPLETE
**Effort:** ~1 session | **Dependencies:** Phase 4

Build the overview page with real-time metrics and credit tracking.

- Metrics cards (server components with DynamoDB queries):
  - Total Analyses (all-time count)
  - Analyses This Month (current month count)
  - Active Integrations (connected count)
  - Team Members (count)
- Credits banner: "X Credits Remaining — Renews [date]"
  - Visual progress bar (used/total)
  - Warning state when < 20% remaining
  - Link to upgrade plan
- Saving Hours widget:
  - Formula: `analyses_count × avg_manual_investigation_time` (from pricing page ROI calculator)
  - Display: "You saved ~X hours this month with CauseFlow AI"
- Recent analyses list (last 5, with status badges)
- Quick action buttons: "New Analysis", "Connect Integration"
- Empty state: friendly illustration when no analyses yet, guide to first analysis

**Deliverable:** Information-rich dashboard home showing key metrics, credits, and quick actions.

---

### Phase 6: Analyses Feature — COMPLETE
**Effort:** ~2 sessions | **Dependencies:** Phase 4, Phase 5

The core feature — submit investigation prompts and view results.

- **New Analysis page** (`/dashboard/analyses/new`):
  - Prompt input (textarea with markdown support)
  - Context selector: which integrations to include in analysis
  - Severity selector: Low / Medium / High / Critical
  - Submit button → POST to `/api/analyses`
  - Loading state with progress indicator
- **Analysis History** (`/dashboard/analyses`):
  - Filterable list (status, severity, date range)
  - Sortable by date (default: newest first)
  - Status badges: Queued, Running, Completed, Failed
  - Click → navigate to detail view
  - Pagination (cursor-based from DynamoDB)
  - No delete action (by design — immutable audit trail)
- **Analysis Detail** (`/dashboard/analyses/[id]`):
  - Status banner with timestamp
  - Original prompt
  - Root cause analysis (confidence score 0-100%)
  - Chronological timeline of events
  - Fix recommendations
  - Data sources consulted (which integrations were queried)
  - Investigation audit trail (every action the agent took)
- **Real-time updates:**
  - Poll for status changes while analysis is running (SSE if budget allows)
  - Toast notification when analysis completes

**Deliverable:** Full analysis submission → tracking → results viewing flow with audit trail.

---

### Phase 7: Integrations Management — COMPLETE
**Effort:** ~1-2 sessions | **Dependencies:** Phase 4

Manage connected tools and services.

- **Integrations page** (`/dashboard/integrations`):
  - Grid of integration cards (reuse integration data from `@causeflow/shared`)
  - States: Available, Connected, Error
  - Category filter (Communication, Code, Monitoring, Management, CRM, Database)
  - Search by name
- **Connection modal** (Dialog component):
  - Dynamic form based on integration type:
    - OAuth flow (Slack, GitHub, Jira, HubSpot): redirect to OAuth, handle callback
    - API key (CloudWatch, Datadog, Sentry): input field + test connection
    - Database (PostgreSQL, MySQL, MongoDB): host, port, database, credentials
  - "Test Connection" button before saving
  - Credentials encrypted via KMS before DynamoDB write
- **Connected integration card:**
  - Status indicator (connected, error, rate-limited)
  - Last synced timestamp
  - "Disconnect" button with confirmation dialog
  - "Reconfigure" button
- **Integration health check:**
  - Periodic validation of stored credentials
  - Visual indicator if connection is broken

**Deliverable:** Integration catalog with connection modals, credential encryption, and status management.

---

### Phase 8: Access Management (RBAC) — COMPLETE
**Effort:** ~1 session | **Dependencies:** Phase 4

Role-based access control for team collaboration.

- **Roles:**
  - Admin: full access, manage team, manage integrations, manage billing
  - Member: submit analyses, view history, view integrations (read-only)
- **Team page** (`/dashboard/team`):
  - Team members table (name, email, role, last active, joined date)
  - Invite button → modal with email + role selector
  - Admin actions: change role, remove member
  - Pending invites list with resend/revoke actions
- **Invite flow:**
  - Admin sends invite → SES branded email → recipient clicks link
  - Link → sign-up (pre-filled email) → auto-joins tenant with assigned role
  - Invite expires after 7 days
- **Permission guards:**
  - Server-side: API routes check role before executing
  - Client-side: conditional UI rendering (hide admin-only elements for members)
  - Middleware: role-based route protection
- **Role in session:** Store role in JWT (via Cognito custom claims or DB lookup at session creation)

**Deliverable:** Team management with invite system and role-based UI/API protection.

---

### Phase 9: Settings, Polish & Performance — COMPLETE
**Effort:** ~1 session | **Dependencies:** Phases 5-8

User settings, notifications, and performance optimization.

- **Settings page** (`/dashboard/settings`):
  - Profile tab: name, avatar, email (read-only), password change
  - Company tab: company name, URL, team size (Admin only)
  - Notifications tab: email preferences (analysis complete, credit warning, team invite)
  - Appearance tab: theme selection, language
- **Keyboard shortcuts:**
  - `Cmd+K` / `Ctrl+K` → Command palette (search analyses, navigate, quick actions)
  - `N` → New analysis (when not in input)
- **Performance optimization:**
  - Server Components for data-heavy pages
  - Streaming with Suspense for analysis results
  - Skeleton loading states (not spinners)
  - Image optimization (WebP, lazy loading)
  - Bundle analysis and code splitting
- **Polish:**
  - Empty states with illustrations and CTAs
  - Error boundaries with friendly recovery UI
  - Toast notifications (success, error, info)
  - Breadcrumbs for navigation context
  - Mobile responsiveness (all dashboard pages)

**Deliverable:** Polished, performant dashboard with settings management and keyboard shortcuts.

---

### Phase 10: Deployment & CI/CD — COMPLETE
**Effort:** ~1 session | **Dependencies:** All phases

Deploy the dashboard to production.

- SST config for `dashboard.causeflow.ai`:
  - Next.js SSR deployment (Lambda + CloudFront)
  - Cognito User Pool (production settings)
  - DynamoDB table (on-demand billing, backups enabled)
  - KMS key (production)
  - SES (production, out of sandbox)
  - WAF rules (rate limiting, bot protection)
  - Environment variables for each stage
- Staging at `app-staging.causeflow.ai` or `staging-dashboard.causeflow.ai`
- GitHub Actions workflow for dashboard CI/CD:
  - Build → Test → Lint → Type check → Deploy staging → E2E on staging → Deploy production
- Monitoring:
  - CloudWatch alarms (Lambda errors, DynamoDB throttling)
  - Error tracking (consider Sentry integration)
- DNS: CNAME/A record for `dashboard.causeflow.ai` → CloudFront

**Deliverable:** Production deployment with CI/CD pipeline, monitoring, and staging environment.

---

## Dependency Graph

```
Phase 1 (Scaffold)
    ↓
Phase 2 (Auth)
    ↓
Phase 3 (Onboarding) ──→ Phase 4 (Database)
                              ↓
                    ┌─────────┼─────────┐
                    ↓         ↓         ↓
              Phase 5    Phase 6    Phase 7
              (Home)    (Analyses) (Integrations)
                    ↓         ↓         ↓
                    └─────────┼─────────┘
                              ↓
                         Phase 8 (RBAC)
                              ↓
                         Phase 9 (Polish)
                              ↓
                         Phase 10 (Deploy)
```

**Parallelizable:** Phases 5, 6, 7 can run in parallel (different pages/features, independent files).

---

## UX Enhancements (Suggestions Beyond Requirements)

1. **Command Palette (Cmd+K)** — SREs love keyboard-driven interfaces. Quick search across analyses, navigate pages, trigger actions.
2. **Skeleton Loading** — Instead of spinners, use shimmer skeleton screens for perceived performance (feels faster).
3. **Empty States** — Beautiful, helpful empty states on every page that guide users to take action (not just "No data").
4. **Toast Notifications** — Non-blocking feedback for async actions (analysis submitted, integration connected, invite sent).
5. **Breadcrumbs** — Navigation context for nested views (`Dashboard > Analyses > Analysis #1234`).
6. **Activity Feed** — Optional sidebar widget showing team's recent actions.
7. **Credit Warning** — In-app banner when credits drop below 20%, with upgrade CTA.
8. **Onboarding Checklist** — Persistent widget showing setup progress (connect integration, invite team member, run first analysis).
9. **Responsive Mobile** — Full mobile dashboard experience (not just desktop).
10. **Dark Mode** — Already supported via theme system, ensure all dashboard components respect it.

---

## Tech Stack (Dashboard-Specific Additions)

| Tool | Purpose |
|------|---------|
| Auth.js v5 | Next.js auth integration (wraps Cognito) |
| AWS Cognito | User pool, social federation, MFA |
| Amazon SES | Branded transactional emails |
| DynamoDB | Primary database (single-table design) |
| AWS KMS | Credential encryption for integrations |
| AWS Lambda | Cognito triggers (custom email), API helpers |
| Zod | API input validation |
| SWR or TanStack Query | Client-side data fetching and caching |
| Radix UI (via @causeflow/ui) | Accessible UI primitives |

---

## Estimated Timeline

| Phase | Sessions | Cumulative |
|-------|----------|------------|
| Phase 1: Scaffold | 1 | 1 |
| Phase 2: Auth | 2 | 3 |
| Phase 3: Onboarding | 1 | 4 |
| Phase 4: Database | 1-2 | 5-6 |
| Phase 5-7: Features (parallel) | 2-3 | 7-9 |
| Phase 8: RBAC | 1 | 8-10 |
| Phase 9: Polish | 1 | 9-11 |
| Phase 10: Deploy | 1 | 10-12 |

**Total estimate:** 10-12 focused sessions.

---

## Notes

- Each phase will have its own task file: `docs/tasks/dashboard/build/YYYY-MM-DD_HHmm-phase-N-name.md`
- Task files are created at the start of each phase with detailed checkboxes
- All phases follow TDD (tests first) and mobile-first development order
- Shared packages (`@causeflow/shared`, `@causeflow/ui`) will be extended as needed during each phase
- The `packages/auth/` package is created in Phase 2 and reusable across apps
