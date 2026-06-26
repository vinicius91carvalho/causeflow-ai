# CauseFlow AI Website — Component Catalog

All components are located under `apps/website/src/components/`.

---

## Navigation Components (`navigation/`)

### `navigation/header.tsx`
- **Purpose:** Top navigation bar with logo, desktop nav links, language selector, and Dashboard CTA button.
- **Props:** None (reads locale and route from next-intl and next/navigation hooks).
- **Used on:** All pages (rendered in root layout).

### `navigation/footer.tsx`
- **Purpose:** Site footer with logo, column links (Product, Company, Legal), social icons, and copyright with locale info.
- **Props:** None.
- **Used on:** All pages (rendered in root layout).

### `navigation/mobile-menu.tsx`
- **Purpose:** Slide-out drawer navigation for mobile viewports. Mirrors header links with animated open/close.
- **Props:** None (manages own open state internally).
- **Used on:** All pages via `header.tsx`.

### `navigation/language-selector.tsx`
- **Purpose:** EN / PT-BR locale toggle button. Sets the `NEXT_LOCALE` cookie and triggers a locale redirect.
- **Props:** None (reads current locale from next-intl).
- **Used on:** All pages via `header.tsx` and `mobile-menu.tsx`.

---

## Section Components (`sections/`)

### `sections/hero-section.tsx`
- **Purpose:** Full-width homepage hero with animated headline, subheadline, primary CTA button, and secondary social-proof line.
- **Props:** `headline: string`, `subheadline: string`, `ctaLabel: string`, `ctaHref: string`
- **Used on:** `/` (Homepage).

### `sections/investigation-dashboard-preview.tsx`
- **Purpose:** Animated mock of the CauseFlow investigation dashboard. Shows a live-updating UI simulation to illustrate the product.
- **Props:** None (self-contained animation).
- **Used on:** `/` (Homepage, below hero).

### `sections/tech-logo-carousel.tsx`
- **Purpose:** Horizontally scrolling carousel of integration/partner logos (Datadog, PagerDuty, GitHub, Slack, etc.). CSS-driven infinite scroll.
- **Props:** `logos: { name: string; src: string; alt: string }[]`
- **Used on:** `/` (Homepage), `/integrations`.

### `sections/metric-card.tsx`
- **Purpose:** Single stat/metric display — large number, label, and optional icon. Used in a grid to surface key performance figures.
- **Props:** `value: string`, `label: string`, `icon?: React.ReactNode`, `suffix?: string`
- **Used on:** `/` (Homepage metrics section), `/product`.

### `sections/how-it-works-section.tsx`
- **Purpose:** Full section container rendering the multi-step "How CauseFlow Works" explanation with numbered steps and visuals.
- **Props:** None (content from i18n messages).
- **Used on:** `/` (Homepage), `/product`.

### `sections/step-card.tsx`
- **Purpose:** Single numbered step card used inside how-it-works and product flow sections.
- **Props:** `step: number`, `title: string`, `description: string`, `icon?: React.ReactNode`
- **Used on:** `/`, `/product` (via `how-it-works-section.tsx`).

### `sections/usage-modes-section.tsx`
- **Purpose:** Tabbed or toggled section presenting different usage patterns (SRE team, on-call engineer, post-mortem review).
- **Props:** None (content from i18n messages).
- **Used on:** `/` (Homepage).

### `sections/security-preview-section.tsx`
- **Purpose:** Homepage teaser for the security page — shows key compliance badges and a brief commitment statement with a link to `/security`.
- **Props:** None.
- **Used on:** `/` (Homepage).

### `sections/cross-reference-visualization.tsx`
- **Purpose:** Animated SVG/diagram showing how CauseFlow correlates signals across multiple data sources (logs, metrics, traces, alerts).
- **Props:** None (self-contained animation).
- **Used on:** `/product`.

### `sections/audit-trail-block.tsx`
- **Purpose:** Visual demo of an investigation audit trail — a chronological timeline of investigation actions with timestamps and actor labels.
- **Props:** `entries?: AuditEntry[]` (defaults to demo data if not provided).
- **Used on:** `/product`.

### `sections/feature-card.tsx`
- **Purpose:** Reusable card for a product feature highlight — icon, title, and description. Used in grids across multiple pages.
- **Props:** `icon: React.ReactNode`, `title: string`, `description: string`, `variant?: 'default' | 'highlight'`
- **Used on:** `/`, `/product`, `/security`.

### `sections/integration-card.tsx`
- **Purpose:** Card displaying a single integration partner — logo, name, category badge, and short description.
- **Props:** `name: string`, `logo: string`, `category: string`, `description: string`, `href?: string`
- **Used on:** `/integrations`.

### `sections/integration-filter.tsx`
- **Purpose:** Category filter bar for the integrations page. Buttons filter the visible integration cards by category.
- **Props:** `categories: string[]`, `activeCategory: string`, `onChange: (category: string) => void`
- **Used on:** `/integrations`.

### `sections/integrations-grid.tsx`
- **Purpose:** Responsive grid container for `integration-card` components. Handles filtering and layout.
- **Props:** None (manages filter state, reads integration data from constants).
- **Used on:** `/integrations`.

### `sections/pricing-card.tsx`
- **Purpose:** Individual pricing plan card with plan name, price (with billing period toggle), feature list, and CTA button.
- **Props:** `plan: PricingPlan`, `isAnnual: boolean`, `highlighted?: boolean`
- **Used on:** `/pricing`.

### `sections/pricing-toggle.tsx`
- **Purpose:** Annual / Monthly billing period toggle switch with savings badge when annual is selected.
- **Props:** `isAnnual: boolean`, `onChange: (isAnnual: boolean) => void`
- **Used on:** `/pricing` (via pricing page layout).

### `sections/roi-calculator.tsx`
- **Purpose:** Interactive ROI calculator. User inputs team size and average incident frequency; outputs estimated cost savings and MTTR reduction.
- **Props:** None (fully self-contained with local state).
- **Used on:** `/pricing`.

### `sections/security-commitment-card.tsx`
- **Purpose:** Card displaying a single security commitment (e.g., "End-to-End Encryption", "SOC 2 Ready") with icon and description.
- **Props:** `icon: React.ReactNode`, `title: string`, `description: string`
- **Used on:** `/security`.

### `sections/compliance-badge.tsx`
- **Purpose:** Visual badge for a compliance standard (LGPD, GDPR, SOC 2 Type II). Shows logo and certification status.
- **Props:** `standard: string`, `logo: string`, `status: 'compliant' | 'in-progress'`
- **Used on:** `/security`.

### `sections/get-started-form.tsx`
- **Purpose:** Early access sign-up form. Submits to `/api/notify` (Loops.so proxy). Includes name, email, company, message fields plus honeypot.
- **Props:** None (self-contained with form state and submission logic).
- **Used on:** `/get-started`.

### `sections/cta-section.tsx`
- **Purpose:** Generic full-width CTA banner with headline, subtext, and one or two buttons. Used as a page-ending call to action.
- **Props:** `headline: string`, `subtext?: string`, `primaryCta: { label: string; href: string }`, `secondaryCta?: { label: string; href: string }`
- **Used on:** `/`, `/product`, `/pricing`, `/security`, `/integrations`.

### `sections/phases-section.tsx`
- **Purpose:** Visual representation of investigation phases (Detect → Correlate → Investigate → Resolve → Learn). Shows phase flow diagram.
- **Props:** None (content from i18n messages).
- **Used on:** `/product`.

### `sections/timeline-section.tsx`
- **Purpose:** Vertical timeline walkthrough of a sample incident investigation. Each node represents a step with timestamp and description.
- **Props:** `events?: TimelineEvent[]` (defaults to demo data).
- **Used on:** `/product`.

---

## Root-Level Components (`components/`)

### `contact-cta-section.tsx`
- **Purpose:** Reusable contact/demo request CTA section that wraps both an inline CTA and a button to open the contact modal. Used as a global section across pages that need a softer CTA than `/get-started`.
- **Props:** None.
- **Used on:** `/product`, `/security`, `/integrations`.

### `contact-modal.tsx`
- **Purpose:** Modal dialog overlay with an embedded contact/demo request form. Submits to Loops.so. Triggered by buttons in `contact-cta-section.tsx` and `header.tsx`.
- **Props:** `open: boolean`, `onOpenChange: (open: boolean) => void`
- **Used on:** Available globally; opened from `header.tsx` and `contact-cta-section.tsx`.

### `structured-data.tsx`
- **Purpose:** Injects JSON-LD `<script>` tags for structured data (Organization, WebSite, BreadcrumbList, FAQPage). Renders in the `<head>` via Next.js metadata API.
- **Props:** `type: 'organization' | 'website' | 'breadcrumb' | 'faq'`, `data: Record<string, unknown>`
- **Used on:** All pages (Organization + WebSite on root layout; page-specific schemas per page).

---

## Component Conventions

- All components use **Tailwind CSS v4** utility classes with the CauseFlow design token system (`--color-primary`, `--color-background`, etc.) from `@causeflow/ui`.
- **Dark mode** is handled via the `.dark` class on `<html>`. Components use `dark:` prefixed utilities.
- **Mobile-first** responsive design: base styles target `< 640px`, then `sm:`, `md:`, `lg:`, `xl:` breakpoints.
- Shared primitives (Button, Card, Badge, Dialog, etc.) come from `@causeflow/ui` — not duplicated here.
- **No client components** unless interactive (forms, carousels, calculators, modals). All others are RSC (`'use server'` implicit).
- **i18n:** All user-visible strings use `useTranslations()` from next-intl. No hardcoded English strings in components.
