# CauseFlow AI — Website (Marketing Site)

## Overview

The website is a **Next.js 15 App Router** application using **Static Site Generation (SSG)** for all content pages. It serves as the marketing site for the CauseFlow AI incident investigation platform, targeting engineering teams of 2–50 engineers.

- **Hosting:** Docker image from `apps/website/Dockerfile`
- **Framework:** Next.js 15 (App Router, SSG)
- **Styling:** Tailwind CSS v4 + Shadcn/ui components
- **i18n:** next-intl (EN default, PT-BR at `/pt-br/` prefix)
- **Forms:** Zod-validated UI forms; no external form service required in OSS
- **Analytics:** Google Analytics 4 + Microsoft Clarity

---

## Routes

All routes are locale-aware. English is the default (no prefix). Portuguese (Brazil) mirrors every route under `/pt-br/`.

| Route | Page | Description |
|---|---|---|
| `/` | Homepage | Hero, dashboard preview, tech carousel, metrics, how-it-works, usage modes, security section, CTA |
| `/product` | Product / How It Works | Investigation phases, timeline walkthrough, audit trail demo |
| `/security` | Security & Compliance | Commitment cards, LGPD/GDPR compliance badges, encryption details |
| `/integrations` | Integration Partners | Filter by category, 8+ integration cards (Datadog, PagerDuty, GitHub, Slack, etc.) |
| `/pricing` | Pricing Plans | Annual/monthly toggle, plan comparison table, ROI calculator |
| `/get-started` | Sign Up / Early Access | Redirect/CTA into the dashboard sign-up flow |
| `/privacy` | Privacy Policy | Legal privacy page |
| `/terms` | Terms of Service | Legal terms page |
| `/staging-auth` | Staging Password Gate | Not localized — only active when `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging` |

---

## Bounded Contexts

All feature code lives under `src/contexts/`, organized into 4 self-contained bounded contexts. Route files under `app/` are thin orchestrators that import from contexts. Cross-context imports use direct deep paths (e.g., `@/contexts/shell/presentation/components/navigation/header`) — context `index.ts` barrel files have been removed.

| Context | Domain | Key Contents |
|---|---|---|
| `marketing` | Product pages, sections, pricing, SEO | 25+ section components (`hero-section.tsx`, `pricing-card.tsx`, `comparison-table.tsx`, `roi-calculator.tsx`, `tech-logo-carousel.tsx`, `investigation-dashboard-preview.tsx`, `audit-trail-block.tsx`, etc.); `structured-data.tsx` for JSON-LD |
| `engagement` | Contact forms, modals, CTAs | `contact-modal.tsx`, `contact-cta-section.tsx`, early-access CTAs |
| `legal` | Privacy, terms | Namespace for legal content pages |
| `shell` | Header, footer, navigation, language selector | `header.tsx`, `footer.tsx`, `mobile-menu.tsx`, `language-selector.tsx` |

App-level `src/lib/` contains shared infrastructure: `metadata.ts` (`generatePageMetadata()` SEO helper), `rate-limit.ts` (sliding window rate limiter).

See the [Bounded Contexts Reference](../../architecture/bounded-contexts.md) for the full directory structure, rules, and extraction guidelines.

---

## Middleware (`src/middleware.ts`)

The middleware runs on every request and handles the following in order:

1. **Crawler detection** — Checks 45+ bot User-Agent patterns. Bots are never redirected; they always receive the default EN locale to ensure correct indexing.

2. **Geo-location** — Reads the `CloudFront-Viewer-Country` header. Visitors from Brazil (`BR`) are redirected to `/pt-br/` if no locale preference is set.

3. **Accept-Language parsing** — Parses the `Accept-Language` request header with quality weighting (e.g., `pt-BR;q=0.9`). Maps browser locale preferences to supported locales.

4. **NEXT_LOCALE cookie** — A sticky locale preference cookie (1-year TTL) set when the user explicitly selects a language. Takes precedence over geo and Accept-Language.

5. **Staging auth integration** — Delegates to `@causeflow/shared` staging auth middleware when `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging`.

---

## i18n

- **Library:** next-intl
- **Supported locales:** `['en', 'pt-br']`
- **Routing strategy:** `prefix: 'as-needed'` — EN has no prefix, PT-BR uses `/pt-br/`
- **Messages source:** `packages/shared/src/infrastructure/i18n/messages/en.json` and `pt-br.json`
- **Config:** `apps/website/src/i18n/request.ts`

Every user-facing string is translated. Legal pages (Privacy, Terms) are EN-only with a notice for PT-BR visitors.

---

## SEO

- **Metadata helper:** `generatePageMetadata()` at `apps/website/src/lib/metadata.ts`
  - Generates `title`, `description`, `canonical`, `openGraph`, `twitter`, and `hreflang` alternates
  - Title template: `'%s | CauseFlow AI'` (keep page titles ≤ 55 chars)
- **Structured data:** JSON-LD via `structured-data.tsx` — Organization, WebSite, BreadcrumbList schemas
- **OG images:** Static OG image at `/opengraph-image.png` and per-page where relevant
- **robots.ts:** Generated `robots.txt` — `noindex` on staging (`NEXT_PUBLIC_DEPLOYMENT_STAGE=staging`)
- **sitemap.ts:** Auto-generated sitemap including all localized routes
- **hreflang:** Every page includes `<link rel="alternate" hreflang="en">` and `<link rel="alternate" hreflang="pt-BR">`

---

## Security Headers

Configured in `apps/website/next.config.mjs` via `headers()`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Restricts camera, microphone, geolocation |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Scoped to trusted origins; inline scripts via nonce |

---

## Local Development

```bash
# From project root
pnpm turbo dev

# Or directly from app directory
cd apps/website
pnpm dev
# Starts on http://127.0.0.1:3000
```

**Notes for PRoot/ARM64 environment:**
- Turbopack crashes in PRoot — Webpack is used via `next dev` (not `next dev --turbo`)
- Always use `--hostname 127.0.0.1` to avoid `os.networkInterfaces()` crash
- Kill existing servers before starting: `pkill -f "next-server|next start|next dev" 2>/dev/null`

---

## Build & Deployment

```bash
# Build (from project root, Turborepo cached)
pnpm turbo build

# Type check
pnpm turbo check-types

# Lint + format
pnpm exec biome check .

# Build the Docker image used by the OSS runtime
docker compose build causeflow-website
```

Hosted deployments are CI-owned and build the same Dockerfile. Do not deploy
manually from a developer machine.

---

## Key Dependencies

| Package | Role |
|---|---|
| `@causeflow/shared` | Types, constants (`SITE`), i18n messages, staging auth middleware |
| `@causeflow/ui` | Design system: components, themes, CSS variables |
| `@causeflow/analytics` | GA4 + Microsoft Clarity initialization and event tracking |
| `@causeflow/forms` | Form validation schemas (Zod), submission helpers |
| `next-intl` | Internationalization routing and message lookup |

---

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Root/app `.env.local` | Optional Google Analytics 4 Measurement ID |
| `NEXT_PUBLIC_CLARITY_ID` | Root/app `.env.local` | Optional Microsoft Clarity project ID |
| `NEXT_PUBLIC_DEPLOYMENT_STAGE` | `.env.local` or CI | `development`, `staging`, or `production`; staging controls noindex/staging auth |
| `NEXT_PUBLIC_DASHBOARD_URL` | `.env.local`, compose build arg, or CI | Dashboard app URL |

---

## Testing

- **Unit/Integration tests:** Vitest — colocated `*.test.ts` / `*.test.tsx` files
  - Run: `pnpm vitest run --project website`
- **E2E tests:** Playwright (Chromium only, 4 viewports)
  - `tests/audit.spec.ts` — SEO, accessibility, infrastructure checks
  - `tests/visual-functional.spec.ts` — Visual and functional checks
  - Run: `pnpm exec playwright test`
  - Screenshots saved to `./screenshots/`
