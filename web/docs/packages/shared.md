# @causeflow/shared

Central repository for types, constants, utilities, i18n messages, and middleware shared across all apps in the monorepo.

## Purpose

Single source of truth for domain knowledge. Both `apps/website` and `apps/dashboard` import from this package to avoid duplication of types, routing constants, pricing data, integration lists, and locale messages.

## Architecture

Follows Clean Architecture with a strict dependency direction:

```
domain/        — types, constants (no dependencies)
application/   — utils (depends on domain only)
infrastructure/ — middleware, i18n (depends on domain + application)
```

## Exports Map

| Export Path | Contents |
|---|---|
| `.` | Main index — re-exports all public symbols |
| `./types` | TypeScript types and interfaces |
| `./constants` | Runtime constants (site config, routes, content data) |
| `./utils` | Pure utility functions |
| `./i18n/en` | English locale messages (JSON) |
| `./i18n/pt-br` | Portuguese (Brazil) locale messages (JSON) |
| `./infrastructure/middleware/staging-auth` | Staging authentication middleware |

## Types (`./types`)

Defined in `domain/types/`:

| Type | Description |
|---|---|
| `Locale` | `'en' \| 'pt-br'` — supported locales |
| `NavItem` | `{ label, href, external? }` — navigation link shape |
| `Integration` | `{ id, name, category, description, logo, available }` |
| `PricingPlan` | `{ id, name, price, features[], cta, highlighted? }` |
| `Competitor` | `{ id, name, slug, tagline, logoUrl }` |
| `FAQItem` | `{ question, answer }` |

## Constants (`./constants`)

Defined in `domain/constants/`:

| Constant | File | Description |
|---|---|---|
| `SITE` | `site.ts` | Site-wide config: URLs, name, social links |
| `ROUTES` | `routes.ts` | All app route strings |
| `PRICING_PLANS` | `pricing.ts` | Plan objects (Starter, Growth, Enterprise) |
| `COMPETITORS` | `competitors.ts` | Competitor data for comparison pages |
| `HEADER_NAV_ITEMS` | `navigation.ts` | Top navigation links |
| `FOOTER_LINKS` | `navigation.ts` | Footer link groups |
| `INTEGRATIONS` | `integrations.ts` | Integration catalog (50+ entries) |

### SITE Object (`domain/constants/site.ts`)

The `SITE` constant is the authoritative source for all URLs and branding:

```typescript
export const SITE = {
  name: 'CauseFlow AI',
  url: 'https://causeflow.ai',
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.causeflow.ai',
  stagingUrl: 'https://staging.causeflow.ai',
  // ... social links, support email, etc.
}
```

`dashboardUrl` reads from `NEXT_PUBLIC_DASHBOARD_URL` at runtime. SST injects the correct value per deployment stage (staging vs. production) so the link in the website header always points to the correct dashboard environment. The fallback ensures correctness in local development without any env file configuration.

## Utils (`./utils`)

Defined in `application/utils/`:

| Function | Signature | Description |
|---|---|---|
| `formatNumber` | `(n: number, locale?: string) => string` | Locale-aware number formatting |
| `formatPrice` | `(cents: number, currency?: string) => string` | Price formatting with currency symbol |
| `generateCanonicalUrl` | `(path: string, locale?: Locale) => string` | Builds absolute canonical URL for a route |
| `generatePageTitle` | `(title: string) => string` | Appends ` \| CauseFlow AI` suffix |

## i18n Messages

Files live at `infrastructure/i18n/messages/`:

- `en.json` — English (default locale, no URL prefix)
- `pt-br.json` — Portuguese Brazil (served at `/pt-br/` prefix)

Both files share an identical key structure. All user-facing strings (page titles, descriptions, navigation labels, CTA text, form labels, error messages) live here. Never hardcode visible strings in components — always reference the message key.

## Staging Auth Middleware (`./infrastructure/middleware/staging-auth`)

Cookie-based password gate for staging environments.

```typescript
import { checkStagingAuth } from '@causeflow/shared/infrastructure/middleware/staging-auth'

// In Next.js middleware.ts:
const result = checkStagingAuth(request)
if (result) return result  // redirect to /staging-auth or serve the gate page
```

**Activation conditions:**
- `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'`
- `NEXT_PUBLIC_STAGING_PASSWORD` is set

**Cookie format:** `staging-authorized:<base64(password)>`

**Bypassed paths:** `/staging-auth`, `/_next/*`, `/api/*`, and all static assets.

**Password:** `causeflow-staging-2026` — hardcoded in both `apps/website/sst.config.ts` and `apps/dashboard/sst.config.ts`.

## Dependencies

This package has **no runtime dependencies**. It is pure TypeScript and JSON. This keeps it lightweight and ensures it can be imported in any environment (server, client, edge) without side effects or bundle weight.

Dev dependencies (for type checking only): `typescript`, `@types/node`.
