# SaaS Marketing Website — Site Structure & Technical Reference

> Generic reference document for a B2B SaaS marketing website with product dashboard. All content references are placeholders — adapt to your domain.

---

## Table of Contents

- [Overview](#overview)
- [Pages & Routes](#pages--routes)
- [Page Breakdown](#page-breakdown)
- [Shared Layout & Navigation](#shared-layout--navigation)
- [Reusable Section Components](#reusable-section-components)
- [Interactive Elements](#interactive-elements)
- [Animation System](#animation-system)
- [Design System & Theming](#design-system--theming)
- [Accessibility](#accessibility)
- [Performance Patterns](#performance-patterns)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Testing Strategy](#testing-strategy)

---

## Overview

**Total pages:** 11 routes (7 marketing + 1 engagement + 2 legal + 1 staging gate)
**Localization:** 2 locales (default + secondary with URL prefix)
**Rendering:** Static Site Generation (SSG) for marketing, Server-Side Rendering (SSR) for dashboard
**API routes:** 2 (form submission + access check)

---

## Pages & Routes

| Route | Category | Purpose |
|---|---|---|
| `/` | Marketing | Homepage — hero, social proof, how it works, features, CTAs |
| `/product` | Marketing | Product deep-dive — phases, architecture, audit trail |
| `/pricing` | Marketing | Plans, ROI calculator, competitive comparison, FAQ |
| `/security` | Marketing | Security commitments, compliance, architecture layers |
| `/integrations` | Marketing | Filterable integration catalog with category tabs |
| `/about` | Marketing | Company story, team, mission |
| `/from-[competitor]` | Marketing | Competitor migration landing page |
| `/get-started` | Engagement | Sign-up form + benefits (can be gated with "Coming Soon" overlay) |
| `/privacy` | Legal | Privacy policy |
| `/terms` | Legal | Terms of service |
| `/staging-auth` | Internal | Password gate for staging environment (not localized) |

All marketing, engagement, and legal routes support i18n (e.g., `/pt-br/pricing`).

---

## Page Breakdown

### Homepage (`/`)

The most section-dense page. Serves as the primary conversion funnel.

| # | Section | Component | Description |
|---|---|---|---|
| 1 | **Hero** | `hero-section` | Headline, subtitle, 2 CTAs (primary + secondary), animated dashboard preview visualization |
| 2 | **Logo Carousel** | `tech-logo-carousel` | Infinite-scroll rows (2 rows, opposite directions) of product & technology partner logos. Pauses on hover |
| 3 | **Metrics** | `metric-card` (x3) | 3-column stat cards showing industry pain points (value, label, source citation) |
| 4 | **Why Now** | `why-now-section` | Market context — why the timing is right for this category |
| 5 | **Differentiator** | `why-different-section` | Competitive positioning — what makes this product unique |
| 6 | **Category Validation** | `category-is-real-section` | Social proof that the product category has market demand |
| 7 | **How It Works** | `step-card` (x6) | 6-step vertical timeline with numbered cards showing the product flow |
| 8 | **Deployment Approaches** | `deployment-approaches-section` | Data flow visualization showing how the product integrates (API, Web, Chat) |
| 9 | **Cross-Reference Viz** | `cross-reference-visualization` | Interactive SVG showing how data sources interconnect. Mouse-responsive with particle effects |
| 10 | **Usage Modes** | `usage-mode-card` (x6) | 6-card grid of deployment modes (API, Web, Slack, Jira, MCP, Agent). Some can be disabled/"Coming Soon" |
| 11 | **Security Summary** | `security-commitment-card` (x6) | 6 commitment cards + compliance badges (locale-aware) |
| 12 | **Founder CTA** | `cofounder-cta` | Personal outreach card with social links (LinkedIn, calendar booking) |
| 13 | **Final CTA** | `cta-section` | Bottom-of-page conversion section, opens contact modal |

**Total sections:** 13

---

### Product Page (`/product`)

Deep technical walkthrough of the product capabilities.

| # | Section | Description |
|---|---|---|
| 1 | **Hero** | Title, subtitle, CTAs (no child visualization) |
| 2 | **Phase 1: Assisted** | 4-step timeline showing the initial automation phase + supplementary note box |
| 3 | **Phase 2: Learning** | 3 feature cards with hover effects (investigate, learn, resolve) |
| 4 | **Phase 3: Autonomous** | Badge + 4-card grid of autonomous capabilities |
| 5 | **Audit Trail** | Code-block styled log display showing audit record format |
| 6 | **Architecture Diagram** | 4 vertically stacked architecture layers (Connectivity, Core, AI, Security) with connecting arrows |
| 7 | **Deployment Approaches** | Detailed variant of deployment data flows |
| 8 | **Founder CTA** | Inline variant |
| 9 | **Final CTA** | Contact modal trigger |

**Total sections:** 9

---

### Pricing Page (`/pricing`)

Conversion-focused with interactive calculator and competitive comparison.

| # | Section | Description |
|---|---|---|
| 1 | **Hero** | Title, subtitle, primary CTA |
| 2 | **Pricing Cards** | 5-column grid (Free / Starter / Pro / Business / Enterprise) with selection highlight state |
| 3 | **ROI Calculator** | 3 interactive inputs (sliders + dropdown) with live output calculations (hours saved, cost savings, annual impact) |
| 4 | **Competitive Comparison** | Multi-column comparison table (your product vs competitor pricing models) |
| 5 | **FAQ Accordion** | Collapsible Q&A items using Radix Accordion |
| 6 | **Founder CTA** | Inline variant |
| 7 | **Final CTA** | Contact modal trigger |

**Total sections:** 7

---

### Security Page (`/security`)

Trust-building page for enterprise buyers and compliance teams.

| # | Section | Description |
|---|---|---|
| 1 | **Security Hero** | Custom hero variant with security-focused messaging |
| 2 | **Architecture Layers** | 5 visual boxes (WAF, Network, Credentials, Database, Logging) |
| 3 | **AI/LLM Commitments** | 5 commitment cards (No Training on Data, Zero Access, ISO, Private Connectivity, Guardrails) |
| 4 | **Compliance Cards** | Locale-aware compliance badges (e.g., GDPR, LGPD, SOC 2, ISO 27001) |
| 5 | **Isolation Layers** | 6-layer text list showing security isolation stack |
| 6 | **Commitment Groups** | Multiple pillar sections with grouped cards |
| 7 | **Deployment Approaches** | Security-focused variant of deployment visualization |

**Total sections:** 7

---

### Integrations Page (`/integrations`)

Catalog page showing all supported integrations.

| # | Section | Description |
|---|---|---|
| 1 | **Hero** | Title, subtitle, CTA |
| 2 | **Integration Catalog** | Tab-based filter (All, Communication, Code, Monitoring, Management, CRM, Database, Knowledge, API) → 17+ integration cards. Each card shows logo, name, status badge (Available / Coming Soon) |
| 3 | **Integration Principles** | 6 feature cards explaining integration philosophy (Easy Setup, Read-Only, Minimal Permissions, No Sensitive Data, Cross-Platform, Open API) |
| 4 | **Final CTA** | Contact modal trigger |

**Total sections:** 4

---

### Get-Started Page (`/get-started`)

Engagement page for lead capture.

| # | Section | Description |
|---|---|---|
| 1 | **Form + Benefits** | Two-column layout: left = sign-up form (name, email, company, team size), right = 6-item checklist of benefits. Form can be blurred with "Coming Soon" overlay |
| 2 | **Alternative CTA** | "Schedule a Demo" button for users who prefer a call |

**Total sections:** 2

---

### Competitor Migration Page (`/from-[competitor]`)

Targeted landing page for users migrating from a specific competitor.

| # | Section | Description |
|---|---|---|
| 1 | **Hero** | Competitor-specific headline, subtitle, CTA |
| 2 | **What's Happening** | Explanation of competitor situation + source links |
| 3 | **Why Switch** | 3-card grid (feature comparisons, pricing advantage, setup speed) |

**Total sections:** 3

---

### Legal Pages (`/privacy`, `/terms`)

Simple text-heavy pages with legal content.

| # | Section | Description |
|---|---|---|
| 1 | **Legal Content** | Full-width prose content rendered from structured data |

**Total sections:** 1 each

---

## Shared Layout & Navigation

### Header

- **Desktop:** Logo + 4 navigation links + language selector + CTA button (beta/sign-up) + optional secondary link
- **Mobile:** Logo + hamburger menu triggering a Sheet drawer
- **Mobile Menu Contents:** Navigation items + dashboard link + sign-up CTA
- **Language Selector:** Locale switcher dropdown (EN / PT-BR)

### Footer

- **4-column grid:**
  - Brand column (logo + tagline)
  - Product column (Product, Pricing, Integrations, Security)
  - Connect column (About, Contact, LinkedIn, social links)
  - Legal column (Privacy, Terms)
- **Bottom bar:** Copyright + compliance badges (locale-aware)

### Page Layout Wrapper

```
<PageLayout>
  <Header />
  <main>{children}</main>
  <Footer />
</PageLayout>
```

---

## Reusable Section Components

### Core Sections (28+ components)

| Component | Props | Usage |
|---|---|---|
| `hero-section` | variant (dark/light), badge, title, subtitle, CTAs, children slot | Every page |
| `cta-section` | title, subtitle, primaryCTA, secondaryCTA | Page bottoms |
| `contact-cta-section` | Wraps cta-section with contact modal trigger | Most pages |
| `section-layout` | variant (default/muted/dark), padding, id | Section wrapper |

### Card Components

| Component | Props | Usage |
|---|---|---|
| `metric-card` | value, label, source, sourceUrl | Homepage metrics |
| `step-card` | number, title, description | How-it-works timelines |
| `feature-card` | icon, title, description, hover effects | Product/integration features |
| `pricing-card` | plan name, price, features list, CTA, selected state | Pricing page |
| `integration-card` | logo, name, status badge (MVP/Coming Soon) | Integrations catalog |
| `security-commitment-card` | icon, title, description | Security page |
| `usage-mode-card` | SVG icon, title, description, disabled state | Homepage modes |
| `founder-card` | photo, name, role, links | About page |

### Visualization Components

| Component | Description |
|---|---|
| `investigation-dashboard-preview` | Interactive SVG with mouse-responsive orbiting nodes, phase-based reveal animations, scanning loops |
| `cross-reference-visualization` | Phase-based SVG animation showing data interconnections with glow/shimmer effects |
| `audit-trail-block` | Code-block styled log display |
| `architecture-layer-box` | Colored box with icon, title, subtitle; variants for product/security contexts |
| `deployment-approaches-section` | 3 variants (hero/detailed/security) showing data flow diagrams |

### Interactive Components

| Component | Description |
|---|---|
| `pricing-interactive` | State wrapper managing pricing card selection + ROI calculator |
| `roi-calculator` | 3 inputs (2 sliders + 1 dropdown) with live calculated outputs |
| `integration-filter` | Tab-based category filtering for integration cards |
| `faq-accordion` | Radix Accordion with collapsible Q&A items |
| `tech-logo-carousel` | Infinite-scroll horizontal carousel, 2 rows, direction variants, pause-on-hover |
| `comparison-table` | Multi-column responsive comparison grid |

### Engagement Components

| Component | Description |
|---|---|
| `contact-modal` | Dual-purpose modal (waitlist + contact form), confetti on success |
| `beta-access-modal` | Email validation against allowlist, conditional routing |
| `dashboard-demo-modal` | Demo request with pre-filled email |
| `get-started-form` | Multi-field sign-up form, supports "Coming Soon" blur overlay |
| `coming-soon-overlay` | Badge overlay for gated features |
| `cofounder-cta` | Personal outreach section with social links (LinkedIn, Cal.com) |

### Data Components

| Component | Description |
|---|---|
| `structured-data` | JSON-LD schema generation (Organization, Website, FAQ) |
| `page-icons` | SVG icon definitions for product page |
| `integration-icons` | SVG icon definitions for integration page |

---

## Interactive Elements

### Modals / Dialogs (3)

1. **Contact Modal** — Dual-purpose (waitlist/contact), confetti celebration on submit, form reset on close
2. **Beta Access Modal** — Email input, checks against allowlist (DynamoDB), routes to dashboard or falls back to demo modal
3. **Demo Modal** — Demo request form with pre-filled email from previous interaction

### Forms (3)

1. **Contact/Waitlist Form** — Email field + honeypot, Zod validation, API submission
2. **Get-Started Form** — Name, email, company, team size (can be gated with blur overlay)
3. **ROI Calculator** — 3 input controls (incident slider, time dropdown, engineer slider) with live calculated outputs (hours saved, cost reduction, annual savings)

### Accordions (1)

- **FAQ Accordion** — Radix-based collapsible Q&A sections on pricing page

### Tabs (1)

- **Integration Filter** — 9 category tabs dynamically filtering 17+ integration cards

### Carousels (1)

- **Tech Logo Carousel** — Infinite horizontal scroll, 2 rows (product logos + tech logos), opposite directions (LTR/RTL), CSS animation pauses on hover

---

## Animation System

### 1. Scroll-Triggered Animations (Primary Pattern)

**Component:** `AnimateOnScroll` wrapper
**Mechanism:** Intersection Observer hook triggers CSS class additions

| Variant | Effect |
|---|---|
| `fade-up` (default) | Translate Y + fade in |
| `fade-in` | Opacity only |
| `fade-left` | Translate X from left + fade |
| `fade-right` | Translate X from right + fade |
| `scale-up` | Scale from 0.95 + fade |
| `bounce-in` | Spring entrance |
| `depth-shift` | Z-axis perspective shift |

**Configuration:**
- Duration: 600ms default
- Easing: cubic-bezier (custom)
- Stagger: 100ms increments per element
- Respects `prefers-reduced-motion`
- Skips already-visible elements

### 2. CSS Keyframe Animations

Defined in theme animation files (`themes/<name>/animations/keyframes.css`):

| Animation | Duration | Use Case |
|---|---|---|
| `scroll` / `scroll-reverse` | 30s linear infinite | Logo carousel horizontal movement |
| `center-receive` | 1.5s | Pulsing scale effect on central elements |
| `glow-pulse` | 2s | Box-shadow glow effect on cards |
| `shimmer` | 2.5s | Text gradient shimmer animation |
| `float` | 3s | Vertical floating motion for decorative elements |
| `button-glow` | 2s | CTA button glow pulse |
| `bounce-in` | 0.6s | Spring entrance for modals/tooltips |
| `pulse-ring` | 1.5s | Radar ping effect on status indicators |
| `accordion-down` / `accordion-up` | 0.2s | Radix Accordion height transitions |

**Tailwind utility classes** (registered via `@utility`):
```
animate-scroll, animate-scroll-reverse, animate-center-receive,
animate-glow-pulse, animate-shimmer, animate-float,
animate-bounce-in, animate-pulse-ring
```

### 3. Interactive SVG Animations

Used for hero visualizations and data flow diagrams:

- **Mouse tracking:** `requestAnimationFrame`-throttled mouse position → particle repulsion, node repositioning
- **Phase-based reveals:** Sequential SVG path drawing with configurable timing per phase
- **Scanning animation:** 120ms interval cycling through tool nodes with highlight state
- **Glow/shimmer effects:** CSS filters + opacity transitions on SVG elements

### 4. Micro-interactions

| Element | Animation |
|---|---|
| Pricing cards | Hover: `-translate-y-1` (lift) + `bg-accent` transition |
| Feature cards | Hover: subtle lift + shadow increase |
| Buttons | Hover: glow pulse + scale(1.02) |
| Navigation links | Hover: underline slide-in |
| Modal open/close | Radix Dialog enter/exit transitions |
| Confetti | `canvas-confetti` burst on form success |
| Carousel | CSS `animation-play-state: paused` on hover |

### 5. Performance Considerations

- `will-change: height` on accordion items
- `will-change: transform` on animated cards
- `contain: layout style` on scroll-triggered sections
- Hardware-accelerated transforms (GPU compositing)
- Intersection Observer for lazy animation triggering (no scroll listeners)

---

## Design System & Theming

### Two-Layer CSS Variable Architecture (Tailwind v4)

```
Layer 1: shared/base.css
  Maps semantic names to CSS variables
  e.g., --color-primary, --color-background, --color-foreground

Layer 2: themes/<name>/tokens/light.css + dark.css
  Sets actual HSL values for the CSS variables
  Dark mode activated via .dark class on <html>
```

### Theme Folder Structure

```
themes/<name>/
  entry.css           # Single import point
  tokens/
    light.css         # Light mode HSL values
    dark.css          # Dark mode HSL values
  animations/
    keyframes.css     # @keyframes definitions
    utilities.css     # @utility animation classes
  fonts/
    index.css         # @font-face declarations
  images/             # Theme-specific images (OG, favicon, etc.)
```

### Component Variants

Using **Class Variance Authority (CVA)** for type-safe component variants:

```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "...", ghost: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "md" },
})
```

### Icon System

- **Lucide React** — 375+ tree-shakeable SVG icons
- Page-specific SVG icons defined in dedicated icon components (`page-icons.tsx`, `integration-icons.tsx`)
- All decorative icons marked `aria-hidden="true"`

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Semantic HTML | `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>` |
| Heading hierarchy | h1 > h2 > h3 enforced per page |
| ARIA labels | All interactive buttons, icon-only elements |
| Keyboard navigation | Native `<button>`, `<a>`, `<input>` elements; Radix handles focus trapping in modals |
| Reduced motion | `prefers-reduced-motion` media query disables scroll animations |
| Color contrast | WCAG AA compliance |
| Form labels | `htmlFor` associations on all form fields |
| Alt text | Required on all `<img>` elements (Biome `useAltText: error`) |
| Focus indicators | Visible focus rings on all interactive elements |

---

## Performance Patterns

| Technique | Implementation |
|---|---|
| **SSG** | All marketing pages pre-rendered at build time |
| **Dynamic imports** | Heavy components (pricing interactive, ROI calculator, visualizations) lazy-loaded with skeleton placeholders |
| **Image optimization** | Next.js `<Image>` with WebP, lazy loading, `decoding="async"`, correct `width`/`height` |
| **Font loading** | `font-display: swap` + `<link rel="preload">` for critical fonts |
| **CSS containment** | `contain: layout style` on animated sections |
| **Hardware acceleration** | `will-change` on transform/height-animated elements |
| **Bundle splitting** | Per-route code splitting via Next.js App Router |
| **Package optimization** | `optimizePackageImports` for UI library, icons, Radix components |
| **Analytics blocking** | Test environment blocks GA4, Clarity, Intercom domains |

### Performance Targets

| Metric | Target |
|---|---|
| LCP | < 2s |
| CLS | < 0.1 |
| FID / INP | < 200ms |
| JS bundle | < 200KB gzipped |
| Lighthouse score | 100/100 all categories |

---

## Architecture

### Modular Monolith (Modlito Pattern)

The codebase follows a **modular monolith** architecture with bounded contexts and clean architecture layers.

#### Bounded Contexts (Website: 4 contexts)

| Context | Responsibility | Key Components |
|---|---|---|
| `marketing` | Product pages, sections, pricing, SEO, structured data | 28+ section components, JSON-LD generation |
| `engagement` | Forms, modals, CTAs, API integrations | Contact/demo/beta modals, form hooks |
| `legal` | Privacy and terms pages | Simple page templates |
| `shell` | Header, footer, navigation, staging auth | Navigation, language selector, mobile menu |

#### Bounded Contexts (Dashboard: 9 contexts)

| Context | Responsibility |
|---|---|
| `investigation` | Core product — incident analysis, timelines, recommendations |
| `approvals` | Approval workflows |
| `audit` | Audit trail logging and display |
| `identity` | Authentication, RBAC, user profiles |
| `team` | Team management, invitations |
| `integrations` | Third-party service connections |
| `billing` | Stripe subscriptions, usage tracking |
| `settings` | App configuration, preferences |
| `shared` | Cross-context utilities |

#### Clean Architecture Layers (per context)

```
domain/           # Pure types, interfaces — no framework imports
application/      # Use cases, service orchestration (dashboard only)
infrastructure/   # API clients, repositories, i18n translations
presentation/     # React components, pages
  pages/          # Page-level server components
  components/     # Feature components
api/              # API route handler implementations (where needed)
```

**Layer dependency rule:** Domain has zero imports. Each higher layer may only import from lower layers. Never import across contexts except via explicit deep paths.

#### i18n Architecture

Each context owns its own translation files:
```
contexts/<name>/infrastructure/i18n/
  en.json
  pt-br.json
```

A composer utility (`lib/i18n/compose.ts`) deep-merges all context translation files into a single `next-intl` message tree at build time.

---

## Tech Stack

### Core Framework

| Tool | Version | Purpose |
|---|---|---|
| **Next.js** | 16 | App Router, SSG (website), SSR (dashboard), API routes |
| **React** | 19 | Server + Client Components, Suspense, Actions |
| **TypeScript** | 5.8+ | Strict mode, ESNext target |
| **Hono** | 4.x | Lightweight API framework for edge functions / microservices |

### Styling & UI

| Tool | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | 4 | Utility-first CSS with CSS-first configuration (no `tailwind.config.js`) |
| **Shadcn/ui** | latest | Pre-built accessible component library built on Radix |
| **Radix UI** | latest | Headless, accessible component primitives |
| **Class Variance Authority** | 0.7+ | Type-safe component variant API |
| **Tailwind Merge** | 3.x | Intelligent Tailwind class deduplication |
| **Lucide React** | latest | Tree-shakeable SVG icon library |
| **canvas-confetti** | 1.9+ | Celebration animation on form success |

### Monorepo & Build

| Tool | Version | Purpose |
|---|---|---|
| **pnpm** | 10+ | Workspace-aware package manager (npm/npx forbidden) |
| **Turborepo** | 2.x | Build orchestration with remote caching |
| **Biome** | 2.x | Linting + formatting (replaces ESLint + Prettier) |

### Testing

| Tool | Version | Purpose |
|---|---|---|
| **Vitest** | 4.x | Unit + integration tests, coverage via v8 |
| **Playwright** | 1.58+ | E2E tests, 4 viewports (mobile/tablet/desktop/wide), chromium |

### Authentication

| Tool | Version | Purpose |
|---|---|---|
| **Auth.js (next-auth)** | 5.x | Session management, OAuth2 providers |
| **AWS Cognito** | SDK v3 | OIDC, email/password, social auth federation |
| **jose** | 6.x | JWT signing and verification |

### Data & API

| Tool | Version | Purpose |
|---|---|---|
| **Zod** | 3.24+ | Runtime schema validation + TypeScript inference |
| **DynamoDB** | SDK v3 | Single-table design, tenant-isolated |
| **AWS KMS** | SDK v3 | Credential encryption at rest |

### Payments

| Tool | Version | Purpose |
|---|---|---|
| **Stripe** | SDK v20+ | Checkout, subscriptions, customer portal, webhooks |

### i18n

| Tool | Version | Purpose |
|---|---|---|
| **next-intl** | 4.x | Internationalization with App Router support |

### Infrastructure & Deployment

| Tool | Version | Purpose |
|---|---|---|
| **SST** | v3 | Infrastructure-as-code on AWS (Lambda, CloudFront, DynamoDB) |
| **GitHub Actions** | — | CI/CD: auto-deploy staging on push, manual production |
| **AWS CloudFront** | — | CDN + WAF + edge functions |
| **AWS WAF** | — | Rate limiting, bot protection, IP reputation |
| **AWS Route 53** | — | DNS management |
| **AWS ACM** | — | SSL/TLS certificate management |
| **AWS CloudWatch** | — | Logging, alarms, monitoring |

### Analytics

| Tool | Version | Purpose |
|---|---|---|
| **Google Analytics 4** | — | Traffic + conversion tracking |
| **Microsoft Clarity** | — | Session replay + heatmaps |

---

## Monorepo Structure

```
project-root/
├── apps/
│   ├── website/                 # Marketing site (SSG)
│   │   └── src/
│   │       ├── app/             # Thin route re-exports only (no business logic)
│   │       ├── contexts/        # Bounded contexts
│   │       │   ├── marketing/   # Product pages, sections, SEO
│   │       │   ├── engagement/  # Forms, modals, CTAs
│   │       │   ├── legal/       # Privacy, terms
│   │       │   └── shell/       # Header, footer, navigation
│   │       └── lib/             # Shared infra: metadata, rate-limit, i18n composer
│   │
│   └── dashboard/               # Product app (SSR + Auth)
│       └── src/
│           ├── app/             # Thin route orchestrators + API routes
│           ├── contexts/        # 9 bounded contexts (see Architecture)
│           └── lib/             # Shared infra: db client, auth, rate-limit
│
├── packages/
│   ├── shared/                  # Types, constants, utilities
│   ├── ui/                      # Design system (Radix + Shadcn + themes)
│   │   └── src/themes/          # Theme system (tokens, animations, fonts)
│   ├── analytics/               # GA4 + Clarity tracking
│   ├── auth/                    # Auth.js config + Cognito integration
│   └── forms/                   # Form logic + Zod schemas
│
├── docs/
│   ├── architecture/            # System design, bounded contexts guide
│   │   └── decisions/           # Architecture Decision Records (ADRs)
│   ├── apps/                    # Per-app documentation
│   ├── packages/                # Per-package documentation
│   ├── deployment/              # Deploy guides, CI/CD docs
│   ├── development/             # Dev setup, troubleshooting
│   ├── solutions/               # Solved problems knowledge base
│   │   ├── infrastructure/
│   │   ├── patterns/
│   │   ├── bugfixes/
│   │   ├── security/
│   │   └── performance/
│   └── tasks/                   # PRD task files
│
├── tests/                       # Playwright E2E tests
│   ├── audit.spec.ts            # SEO, accessibility, infrastructure checks
│   └── visual-functional.spec.ts # Visual and functional verification
│
├── biome.json                   # Biome linting + formatting config
├── turbo.json                   # Turborepo pipeline config
├── pnpm-workspace.yaml          # Workspace package definitions
├── vitest.config.ts             # Root Vitest config (multi-project)
├── playwright.config.ts         # Playwright config (4 viewports, chromium)
├── sst.config.ts                # SST infrastructure definition
└── tsconfig.base.json           # Shared TypeScript config
```

---

## Infrastructure & Deployment

### Environments

| Environment | Website | Dashboard |
|---|---|---|
| Production | `https://yourdomain.com` | `https://dashboard.yourdomain.com` |
| Staging | `https://staging.yourdomain.com` | `https://dashboard-staging.yourdomain.com` |
| Local Dev | `http://127.0.0.1:3000` | `http://127.0.0.1:3001` |

### CI/CD Pipeline

```
Push to main
  → GitHub Actions triggers
  → Build (pnpm turbo build)
  → Lint (biome check)
  → Type check (tsc --noEmit)
  → Unit tests (vitest)
  → Deploy to staging (SST)
  → E2E tests on staging (Playwright)
  → Manual approval for production
  → Deploy to production (SST)
  → Lighthouse audit (all pages, target 100/100)
```

### AWS Architecture

```
Route 53 (DNS)
  → CloudFront (CDN + WAF)
    → Lambda@Edge (Next.js via OpenNext)
      → DynamoDB (data)
      → Cognito (auth)
      → KMS (encryption)
      → CloudWatch (monitoring)
```

---

## Testing Strategy

### Unit / Integration (Vitest)

- 7 test projects (one per package + one per app)
- Colocated test files: `*.test.ts` / `*.test.tsx` next to source
- Coverage via `@vitest/coverage-v8`
- Node environment (no browser needed)

### E2E (Playwright)

- **4 viewports:** Mobile (375px), Tablet (768px), Desktop (1280px), Wide (1920px)
- **Browser:** Chromium only
- **Test files:**
  - `audit.spec.ts` — SEO meta tags, accessibility, security headers, structured data
  - `visual-functional.spec.ts` — Visual rendering, interactive elements, navigation flows
- **Network blocking:** Analytics/tracker domains blocked in `beforeEach`
- **No hardcoded waits:** Uses `expect(locator).toBeVisible()` and `waitUntil: 'domcontentloaded'`

### Testing Pyramid

```
        /  E2E  \        ← Playwright (critical user flows)
       /----------\
      / Integration \    ← Vitest (cross-module, API routes)
     /--------------\
    /   Unit Tests   \   ← Vitest (pure functions, components)
   /------------------\
```

---

## Security Headers

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | Self + analytics + auth provider domains |

---

## Commands Reference

```bash
# Build & Development
pnpm turbo build              # Build all packages and apps (cached)
pnpm turbo dev                # Start all dev servers
pnpm turbo test               # Run all Vitest tests (cached)
pnpm turbo lint               # Run Biome linting
pnpm turbo check-types        # TypeScript type checking

# Linting & Formatting
pnpm exec biome check .              # Check lint + format
pnpm exec biome check --write .      # Auto-fix lint + format

# E2E Testing
pnpm exec playwright test             # Run all E2E tests
pnpm exec playwright test --ui        # Interactive test runner

# Coverage
pnpm vitest run --coverage            # Tests with coverage report
```
