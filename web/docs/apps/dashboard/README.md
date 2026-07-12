# CauseFlow AI — Dashboard

The dashboard is the product application for CauseFlow AI. It provides incident
management, root-cause investigation views, remediation workflows, team
collaboration, integrations, audit trails, LLM connector settings, and billing
state.

## Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 15 (App Router, SSR) |
| Auth | Local JWT auth in OSS; hosted deployments can use Core-issued Clerk-backed tokens |
| Backend | Core API (`CORE_API_URL`); blank locally uses the mock Core API client |
| Billing | Stub billing in OSS; Stripe-backed flows in hosted deployments |
| Hosting | Docker image from `apps/dashboard/Dockerfile` |
| Styling | Tailwind CSS v4 + `@causeflow/ui` design system |
| Language | TypeScript (strict mode) |
| i18n | next-intl (EN default, PT-BR at `/pt-br/` prefix) |
| Package | `@causeflow/dashboard` |

---

## Local Runtime

From the `web/` repo root:

```bash
docker compose up -d
```

The dashboard is served at `http://localhost:3001` and calls Core at
`http://causeflow-api:5171` inside the compose network. Override the sibling
Core checkout path with `CORE_CONTEXT=/abs/path/to/core`.

For app-only development:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm --filter @causeflow/dashboard dev
```

Leave `CORE_API_URL` blank for mock mode, or point it at `http://localhost:3099`
when Core is running locally.

---

## Routes

All localized pages live under `src/app/[locale]/` and support `en` plus
`pt-br`.

### Auth Routes

| Route | Description |
|---|---|
| `/auth/sign-in` | Sign in with the OSS local auth form or hosted auth provider |
| `/auth/sign-up` | Register a new local/hosted account |
| `/accept-invitation` | Accept team invitation |
| `/create-organization` | Create an organization/workspace |
| `/waitlist` | Waitlist signup |
| `/beta-waitlist` | Beta access gate |

### Dashboard Routes

| Route | Description |
|---|---|
| `/dashboard` | Overview: metrics, credits, recent incidents, quick actions |
| `/dashboard/incidents` | Paginated incident list with status/severity filters |
| `/dashboard/incidents/new` | Create a new incident |
| `/dashboard/incidents/[id]` | Incident detail, live feed, evidence, remediations, feedback |
| `/dashboard/integrations` | Integration catalog and connection management |
| `/dashboard/team` | Team members and invites |
| `/dashboard/settings` | Profile, company, LLM connector, notifications, appearance, API keys |
| `/dashboard/billing` | Subscription/plan state and usage |
| `/dashboard/audit` | Audit trail |
| `/dashboard/intelligence` | Pattern insights and AI memory |
| `/dashboard/relay` | Integration relay health status |

Legacy `/dashboard/analyses*` routes still exist for backwards compatibility
and are superseded by incidents routes.

### API Routes

Next.js API routes are BFF handlers over Core. They live in `src/app/api/` and
delegate to context handlers under `src/contexts/**/api/`.

---

## Key Features

### Incident Management

- Users create incidents with title, description, and severity.
- Core performs triage and investigation, then streams live updates back to the
  dashboard.
- Incident lifecycle: `open` -> `triaging` -> `investigating` ->
  `awaiting_approval` -> `remediating` -> `resolved` -> `closed`.
- Evidence, known-solution suggestions, tool-call output, remediation proposals,
  and feedback render on the incident detail page.

### Integrations

The dashboard exposes the integration catalog and connection flows. In OSS mode,
the stub connector can be enabled/connected for local golden-path testing. Real
credentials are forwarded to Core; the dashboard does not persist secrets.

### LLM Connector

The settings page includes an OSS LLM connector card backed by
`/api/settings/llm-connector`, which proxies Core `/v1/oss/llm-connector`.
This controls the OpenAI-compatible local investigation connector.

### Billing

OSS mode uses stub billing and plan-gate behavior. Hosted deployments can proxy
Stripe checkout, portal, webhook, and subscription endpoints through Core.

---

## Bounded Contexts

Feature code lives under `src/contexts/`; route files under `app/` are thin
orchestrators that re-export from contexts.

| Context | Domain |
|---|---|
| `investigation` | Incidents, analyses, live feed, remediations |
| `identity` | Auth, local sessions, onboarding, user profile, RBAC |
| `billing` | Plan state, credits, checkout/portal proxies |
| `team` | Team management and invites |
| `integrations` | External service connections and stub connector |
| `settings` | Profile/company preferences and LLM connector |
| `approvals` | Approval workflows |
| `audit` | Audit trail |
| `onboarding` | Tutorial and setup flow |
| `shared` | Layout, navigation, API clients, cross-context UI |

App-level `src/lib/` contains shared infrastructure: `withAuth`, Core API
clients, mock API client, local session helpers, rate limiting, i18n composer,
and logging.
