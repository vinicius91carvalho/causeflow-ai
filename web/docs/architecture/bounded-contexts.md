# Bounded Contexts Reference

Both apps (`website` and `dashboard`) organize feature code using DDD-style bounded contexts under `src/contexts/`. This document is the authoritative reference for the pattern, the full context catalog, and the rules that govern cross-context communication.

---

## Directory Structure

Each context follows a four-layer DDD structure. Only create layers the context actually needs:

```
src/contexts/<context-name>/
├── domain/              # Pure business logic — no framework dependencies
│   ├── types.ts         # Domain entities, value objects, enums
│   └── rbac/            # Role/permission definitions (identity context only)
├── application/         # Use cases and orchestration
│   ├── services.ts      # Business logic, service orchestration
│   └── __tests__/       # Application-layer unit tests
├── infrastructure/      # External concerns: databases, APIs, i18n, validation
│   ├── i18n/            # Per-context translation files
│   │   ├── en.json      # English translations owned by this context
│   │   └── pt-br.json   # Portuguese translations owned by this context
│   ├── *-repository.ts  # Data access objects / Core API adapters
│   ├── api-schema.ts    # Zod validation schemas for API inputs
│   └── __tests__/       # Infrastructure-layer tests
├── presentation/        # React components and UI
│   ├── components/      # All React components for this context
│   │   └── __tests__/   # Component unit and integration tests
│   └── pages/           # Server/client page implementations (dashboard only)
│                        # Moved from app/[locale]/... — app/ files are thin re-exports
├── api/                 # API route handler implementations (dashboard only)
│                        # Moved from app/api/... — app/api/ files are thin re-exports
└── lib/                 # Special exception — files that cannot fit DDD layers
    │                    # (e.g., SDK wrappers constrained by Next.js edge runtime)
```

**Layer dependency rule (enforced by convention):**

| Layer | May import from |
|---|---|
| `domain/` | Nothing (pure TypeScript, no app imports) |
| `application/` | `domain/` only |
| `infrastructure/` | `domain/`, `application`, external libs, Core API clients |
| `presentation/` | `domain/`, `application/`, `infrastructure/` |

### i18n: Per-Context Files with a Composer

Each context owns its translation keys under `infrastructure/i18n/`. A composer at `src/lib/i18n/compose.ts` deep-merges all context files into a single object that next-intl receives:

```typescript
// src/lib/i18n/compose.ts
import billingEn from '../../contexts/billing/infrastructure/i18n/en.json';
import investigationEn from '../../contexts/investigation/infrastructure/i18n/en.json';
// ... all contexts

export const dashboardMessages = {
  en: deepMerge(investigationEn, teamEn, billingEn, ...),
  'pt-br': deepMerge(investigationPtBr, teamPtBr, billingPtBr, ...),
};
```

The `dashboard.*` namespace is preserved — each context file contributes its slice of keys. Add new keys only to the owning context's JSON file; the composer picks them up automatically.

### Direct Deep Imports (No Barrels)

Context `index.ts` barrel files have been removed from all contexts in both apps. The former `lib/db/types.ts`, `lib/db/index.ts`, and `lib/db/repositories/` stub files have also been removed. All imports must use direct deep paths:

```typescript
// CORRECT — direct deep path to the owning context
import type { Incident } from '@/contexts/investigation/domain/types';
import { analysisRepository } from '@/contexts/investigation/infrastructure/analysis-repository';
import { getApiClient } from '@/lib/api/get-api-client';

// WRONG — deleted barrel/aggregation files
import { Incident } from '@/contexts/investigation';
import type { Incident } from '@/lib/db/types';
import { analysisRepository } from '@/lib/db';
```

The dashboard no longer owns a `lib/db` persistence layer; product data is
loaded through the Core API client.

Handlers that need product data should use the Core API client:

```typescript
// GOOD: route product data through Core
import { getApiClient } from '@/lib/api/get-api-client';
```

---

## Rules

1. **Direct deep imports only.** Context `index.ts` barrel files have been removed. Import directly from the specific file within the owning context (e.g., `@/contexts/team/presentation/components/invite-form`).
2. **Route files are thin re-exports.** Files under `app/` are ultra-thin re-exports to context page/handler implementations. They hold no business logic, no data fetching logic, and no domain types. Example: `export { BillingPage as default } from '@/contexts/billing/presentation/pages/billing-page'`.
3. **Page implementations live in `presentation/pages/`.** Server and client page components move from `app/[locale]/...` into the owning context's `presentation/pages/` directory (dashboard only).
4. **API handler implementations live in `api/`.** Route handler logic moves from `app/api/...` into the owning context's `api/` directory (dashboard only). The `app/api/` file re-exports the named HTTP method exports.
5. **Next.js config exports must be inlined in route files.** `export const dynamic`, `export const runtime`, and similar Next.js static config cannot be re-exported from context files — the Next.js static analyzer only reads them from the `app/` route file directly.
6. **`lib/` at the app level is shared infrastructure only.** Examples: `lib/api/with-auth.ts`, `lib/api/get-api-client.ts`, `lib/rate-limit.ts`. Context-specific logic belongs in its context's `infrastructure/` layer.
7. **Tests are colocated per layer.** Application tests go in `application/__tests__/`, infrastructure tests in `infrastructure/__tests__/`, component tests in `presentation/components/__tests__/`.

---

## Dashboard Contexts (9)

### `investigation`

The core product domain. Handles incidents, analyses, timelines, remediations, and audit trails.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — incident, analysis, remediation, timeline entities |
| `application/` | `services.ts`, `incident-simulator.ts`, `incident-templates.ts` — AI simulation workflows |
| `infrastructure/` | `analysis-repository.ts`, `incident-repository.ts`, `remediation-repository.ts`, `mock-data.ts`, `api-schema.ts`, `i18n/` |
| `presentation/components/` | `NewAnalysisForm`, `StatusBadge`, `ConfidenceIndicator`, `Timeline`, `AuditTrail`, `RemediationList`, `Toast` (7 total) |
| `presentation/pages/` | `incidents-page`, `new-incident-page`, `incident-detail-page` |
| `api/` | `analyses-handler`, `analyses-id-handler`, `feedback-handler`, `remediations-handler`, `remediations-id-handler` |

### `approvals`

Approval workflows for remediation actions proposed during incident investigation.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — approval state types |
| `infrastructure/` | `i18n/` |
| `presentation/components/` | Approval workflow UI (1 component) |
| `api/` | `approvals-handler`, `approval-respond-handler` |

### `audit`

Audit trail and compliance views. Surfaces the structured event log produced by the investigation context.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — audit event types |
| `infrastructure/` | `i18n/` |
| `presentation/components/` | Audit trail display (1 component) |
| `presentation/pages/` | `audit-page` |
| `api/` | `audit-handler` |

### `identity`

Authentication, onboarding, and user profile management. Owns RBAC definitions
and local session-facing pages/handlers.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — user/session types; `rbac/permissions.ts` — role definitions, `PERMISSIONS` map, `usePermission` hook, `RoleGuard` |
| `infrastructure/` | `user-repository.ts`, `i18n/` |
| `presentation/components/` | Sign-in form, sign-up form, onboarding steps, profile form, session skeleton (5 total) |
| `presentation/pages/` | `sign-in-page`, `sign-up-page`, `complete-profile-page`, waitlist/invitation pages |
| `api/` | `complete-profile-handler`, `connect-integration-handler` |

### `team`

Team member management and invitation flows.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — member, invite types |
| `infrastructure/` | `i18n/` |
| `presentation/components/` | Members table, invite form, role dropdown, status badges (7 total); `__tests__/` (4 files) |
| `presentation/pages/` | `team-page` |
| `api/` | `team-handler`, `team-invite-handler`, `team-invites-handler`, `team-invite-email-handler`, `team-user-handler`, `team-user-role-handler` |

### `integrations`

External service connections. Supports 15 integration types with type-specific credential schemas.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — integration type definitions |
| `infrastructure/` | `integration-repository.ts`, `api-schema.ts`, `i18n/` |
| `presentation/components/` | Integration list, connect modal, status indicators, credential forms (9 total); `__tests__/` (6 files) |
| `presentation/pages/` | `integrations-page` |
| `api/` | `integrations-handler`, `integration-type-handler` |

### `billing`

Stripe integration, credit management, and subscription lifecycle.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — plan/subscription types; `stripe-types.ts` — Stripe-specific domain types |
| `application/` | `services.ts` — checkout session + Customer Portal session creation; `__tests__/` |
| `infrastructure/` | `stripe-client.ts` (Stripe SDK singleton), `webhook-handlers.ts` (5 event handlers), `api-schema.ts`, `i18n/`; `__tests__/` |
| `presentation/components/` | Plan and billing UI (1 component) |
| `presentation/pages/` | `billing-page` |
| `api/` | `checkout-handler`, `portal-handler`, `subscription-handler`, `webhook-handler`, `metrics-handler` |

### `settings`

User and company preference management.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — settings entity types |
| `infrastructure/` | `settings-repository.ts`, `api-schema.ts`, `i18n/` |
| `presentation/components/` | Profile form, company form, notifications form, appearance form, locale selector (5 total); `__tests__/` (3 files) |
| `presentation/pages/` | `settings-page` |
| `api/` | `settings-handler`, `api-keys-handler` |

### `shared`

Cross-cutting UI that does not belong to a single domain context. Includes layout, navigation, the command palette, and global monitoring utilities.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — shared/cross-cutting types |
| `infrastructure/` | `tenant-repository.ts`, `i18n/` |
| `presentation/components/` | `DashboardLayout`, `Sidebar`, `Topbar`, `CommandPalette`, `CreditsBanner`, `MetricsCard`, `RecentAnalyses`, `QuickActions`, `EmptyState`, `SavingHours`, and more (16 total) |
| `presentation/pages/` | `dashboard-page`, `topology-page` |
| `api/` | `health-handler`, `health-detailed-handler`, `notifications-handler`, `pattern-analytics-handler`, `topology-handler`, `topology-service-handler` |
| `lib/` | `monitoring/` (error tracking, performance), `confetti.ts` |

---

## Website Contexts (4)

### `marketing`

All product content pages — sections, cards, pricing, comparison tables, SEO components, and structured data.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — marketing content types (pricing plans, comparison data, etc.) |
| `infrastructure/` | `i18n/` — all marketing page translations (home, product, integrations, security, pricing, about, deploymentApproaches) |
| `presentation/components/` | `sections/` (25+ components): `hero-section.tsx`, `pricing-card.tsx`, `comparison-table.tsx`, `roi-calculator.tsx`, `tech-logo-carousel.tsx`, `investigation-dashboard-preview.tsx`, `audit-trail-block.tsx`, `structured-data.tsx` (JSON-LD), and others |

### `engagement`

User engagement flows: contact forms, modals, and call-to-action surfaces.

| Layer | Contents |
|---|---|
| `domain/` | `types.ts` — engagement form types |
| `infrastructure/` | `api-client.ts` — Loops.so API integration, `i18n/` — getStarted translations |
| `presentation/components/` | `contact-modal.tsx`, `contact-cta-section.tsx`, early-access form and related CTAs |

### `legal`

Namespace for legal content pages (Privacy Policy, Terms of Service). Thin context designed for future extraction or expansion.

| Layer | Contents |
|---|---|
| `infrastructure/` | `i18n/` — privacy and terms translations |
| `presentation/` | Legal page content components |

### `shell`

Global site chrome: header, footer, navigation, and language selector. These components appear on every page and wrap all content.

| Layer | Contents |
|---|---|
| `infrastructure/` | `i18n/` — notFound, common (nav, cta, footer, languageSelector, cofounderCta) translations |
| `presentation/components/navigation/` | `header.tsx`, `footer.tsx`, `mobile-menu.tsx`, `language-selector.tsx`, navigation link components (5 total) |

---

## App-Level `lib/` (Shared Infrastructure)

The `lib/` directory at the app root is reserved for shared infrastructure that no single context owns.

| File | Belongs to |
|---|---|
| `lib/api/with-auth.ts` | `withAuth()` HOC for API routes — session + RBAC + rate limit (dashboard) |
| `lib/api/get-api-client.ts` | Selects HTTP Core client or mock client |
| `lib/api/http-api-client.ts` | HTTP Core API client |
| `lib/api/mock-api-client.ts` | App-only local development client |
| `lib/api/schemas.ts` | Shared Zod schemas for API inputs (dashboard) |
| `lib/i18n/compose.ts` | Deep-merges per-context i18n JSON files into a single next-intl message object |
| `lib/rate-limit.ts` | Per-user rate limiting (dashboard + website) |
| `lib/metadata.ts` | `generatePageMetadata()` SEO helper (website) |

> **Important:** Context `infrastructure/` layers should use the Core API
> client for product data. The former `lib/db/index.ts` barrel has been removed.

---

## Future: Microfrontend / Microservice Extraction

Each context is designed for independent extraction. To convert a context to a separate service:

1. Extract the context directory into its own package under `packages/` or a separate repository.
2. Create an `index.ts` barrel as the package's public API to define the contract surface.
3. Replace direct imports with API calls or an event-based communication layer at the boundary.
4. Move context-specific environment variables to the extracted service's configuration.

This architecture ensures that bounded context extraction is a refactor, not a rewrite.
