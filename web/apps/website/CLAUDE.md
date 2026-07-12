# CauseFlow AI — Website

Marketing site for CauseFlow AI. Next.js 15 App Router with SSG (Static Site Generation).

> For global rules, task workflow, and tech stack, see the root [CLAUDE.md](../../CLAUDE.md).

## App Overview

- **Purpose**: Marketing, SEO, lead generation for the incident investigation platform
- **Rendering**: Static Site Generation (SSG) — all pages pre-rendered at build time
- **Hosting**: Docker image from `apps/website/Dockerfile`
- **i18n**: English (default, no prefix) + Portuguese (/pt-br/ prefix) via next-intl

## Routes

| Route | Page | Key Feature |
|---|---|---|
| `/` | Homepage | Hero, dashboard preview, metrics, how-it-works, usage modes |
| `/product` | Product | Phases, timeline, audit trail demo |
| `/security` | Security | Commitment cards, LGPD/GDPR badges |
| `/integrations` | Integrations | Category filter, 8+ partner cards |
| `/pricing` | Pricing | Annual/monthly toggle, ROI calculator |
| `/privacy` | Privacy Policy | Legal |
| `/terms` | Terms of Service | Legal |
| `/use-cases` | Use Cases | Incident investigation stories |
| `/from-opsgenie` | Opsgenie migration | Migration landing page |
| `/staging-auth` | Staging Gate | Password protection (not localized) |

All routes (except staging-auth) are localized: EN at root, PT-BR at /pt-br/. `/get-started` was retired when the dashboard moved to production — requests redirect to `https://dashboard.causeflow.ai` via `next.config.mjs`.

## Bounded Contexts

All feature code lives under `src/contexts/`. Route files under `app/` are thin orchestrators. Cross-context imports use direct deep paths (context `index.ts` barrel files have been removed).

Each context uses DDD layers (create only the layers the context needs):

| Layer | Purpose |
|---|---|
| `domain/` | Pure content/business types — no framework imports |
| `infrastructure/` | External concerns: API clients, i18n JSON files |
| `presentation/pages/` | Page implementations (server components) |
| `presentation/components/` | React components and UI |
| `api/` | API route handler implementations |

Route files in `app/` are **thin re-exports** (1-3 lines) that delegate to context implementations:
```typescript
// app/[locale]/product/page.tsx
export { default, generateMetadata } from '@/contexts/marketing/presentation/pages/product-page';
```

Per-context i18n files live at `infrastructure/i18n/en.json` and `pt-br.json`. A composer at `src/lib/i18n/compose.ts` deep-merges all context files into a unified message tree for next-intl.

| Context | Domain | Key Paths |
|---|---|---|
| `marketing` | Product pages, sections, pricing, SEO, use cases | `domain/types.ts`, `infrastructure/i18n/`, `presentation/pages/` (home, product, pricing, security, integrations, use-cases, from-opsgenie), `presentation/components/sections/` (25+ components, `structured-data.tsx`), `presentation/data/` (use-cases) |
| `legal` | Privacy, terms | `infrastructure/i18n/` (privacy, terms), `presentation/pages/` (privacy, terms) |
| `shell` | Header, footer, navigation, language selector, staging auth | `infrastructure/i18n/` (notFound, common), `presentation/pages/` (not-found, staging-auth), `presentation/components/navigation/` (header, footer, mobile-menu, language-selector), `presentation/components/staging-auth-form.tsx` |

## Key Files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Crawler detection, geo-redirect, locale cookie, staging auth |
| `src/lib/metadata.ts` | `generatePageMetadata()` — canonical URLs, hreflang, OG |
| `src/lib/rate-limit.ts` | Sliding window rate limiter (60s, per-IP) |
| `src/lib/i18n/compose.ts` | Deep-merges per-context i18n JSON files into a single next-intl message tree |
| `src/contexts/marketing/presentation/components/sections/` | 25+ reusable section components |
| `src/contexts/shell/presentation/components/navigation/` | Header, footer, mobile menu, language selector |
| `src/contexts/marketing/presentation/components/sections/structured-data.tsx` | JSON-LD schema (Organization, Website, FAQ) |
| `src/i18n/routing.ts` | Locale config: ['en', 'pt-br'], prefix 'as-needed' |
| `next.config.mjs` | Security headers (CSP, HSTS), transpilePackages, redirects |
| `Dockerfile` | Multi-stage Docker build (AC-050: SST removed, runs as plain Node process) |

## Dependencies (workspace packages)

- `@causeflow/shared` — SITE constant, ROUTES, types, i18n messages, staging auth middleware
- `@causeflow/ui` — Design system components, themes, layouts
- `@causeflow/analytics` — AnalyticsProvider (GA4 + Clarity)
- `@causeflow/forms` — Zod schemas (notifySchema), sanitization

## Middleware Pipeline

1. **Crawler detection** (45+ bot patterns) — never redirect bots (SEO)
2. **Staging auth** — cookie check if `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'`
3. **Geo-location** — CloudFront header check for Brazil → PT-BR redirect
4. **Accept-Language** — Quality-weighted locale detection
5. **NEXT_LOCALE cookie** — Sticky preference (1-year max-age)

## SEO Checklist

- Every page uses `generatePageMetadata()` for canonical + hreflang + OG
- `robots.ts` blocks staging (`noindex, nofollow`)
- `sitemap.ts` generates XML sitemap for all routes x locales
- `structured-data.tsx` injects JSON-LD (Organization, Website, FAQ)
- Title template: `'%s | CauseFlow AI'` — keep page titles <= 55 chars

## Local Development

```bash
pnpm --filter website dev     # http://localhost:3000
pnpm --filter website build   # Production build
```

## Security Headers (next.config.mjs)

- `X-Frame-Options: DENY`
- `Content-Security-Policy` (self + GA + Clarity + Loops)
- `Strict-Transport-Security` (2 years + preload)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/microphone/geolocation disabled)

## Documentation

- [Website README](../../docs/apps/website/README.md)
- [Component Catalog](../../docs/apps/website/components.md)
- [Architecture Overview](../../docs/architecture/overview.md)
- [Deployment](../../docs/deployment/website-deploy.md)
