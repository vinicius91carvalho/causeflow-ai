# Onboarding — Feature Pages

Four-page first-run flow that gets a new tenant from sign-up to a usable dashboard. All pages share the minimal layout at `apps/dashboard/src/app/[locale]/onboarding/layout.tsx` — a centered card on a `bg-gradient-to-br from-background via-background to-primary/5` background with a decorative grid overlay and a `ToastProvider` wrapper (`layout.tsx:14-31`). The layout sets `robots: { index: false, follow: false }`.

## Flow

```
sign-up  →  /onboarding/welcome            (identity context)
         →  /onboarding/integrations       (onboarding context)
         →  /onboarding/business-profile   (onboarding context)
         →  /onboarding/choose-plan        (billing context)
         →  /dashboard?welcome=1
```

Each step can be skipped. Skipping routes the user forward (integrations → business-profile) or to `/dashboard` (business-profile skip). The choose-plan step has no explicit skip — admins must pick a plan; non-admins see a "not admin" screen.

---

## 1. `/onboarding/welcome`

Route: `apps/dashboard/src/app/[locale]/onboarding/welcome/page.tsx` (thin re-export).
Implementation: `apps/dashboard/src/contexts/identity/presentation/pages/welcome-page.tsx` — note the welcome page lives in the **identity** bounded context, not onboarding.

**Purpose.** Orient the new user, present the three setup steps as a vertical stack of clickable cards, and provide a primary "Get Started" button. Purely navigational; no API calls.

**Flow position.** First screen after Clerk sign-up; defaults to this route when the tenant has not completed onboarding.

**Key components.**

- `StepCard` (local, `welcome-page.tsx:21-53`) — anchor wrapper (`<Link>`) over card with Lucide icon (`Plug`, `Briefcase`, `CreditCard`), title, description, and a trailing `ArrowRight`. Uses `group` + `hover:border-primary/30 hover:shadow-md` for hover affordance.
- `Button` primitive from `@causeflow/ui/primitives` — the "Get Started" CTA (`welcome-page.tsx:116-120`).
- `next/image` for the CauseFlow logo (`priority`), `next/link` for navigation.

**Form validation.** None.

**Exit / skip.** No skip. Every card and the CTA are navigation links — users click through in any order.

---

## 2. `/onboarding/integrations`

Route: `apps/dashboard/src/app/[locale]/onboarding/integrations/page.tsx` → `OnboardingIntegrationsPage` → `OnboardingIntegrationsGrid`.
Source: `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx`.

**Purpose.** Let the tenant connect third-party providers (Slack, GitHub, Jira, Sentry, Datadog, AWS CloudWatch, etc. — see the `ONBOARDING_INTEGRATION_IDS` tuple at `onboarding-integrations-grid.tsx:14-29`). Each integration is one of two auth types driven by `ONBOARDING_AUTH_TYPES` (`onboarding-integrations-grid.tsx:33-48`): `'oauth'` opens a popup to `/api/integrations/oauth/<provider>/authorize`; `'credential'` opens the `ConnectionModal` from the `integrations` context.

**Flow position.** Step 2. Continues to `/onboarding/business-profile`.

**Key components.**

- Integration cards (inline, `onboarding-integrations-grid.tsx:234-286`) — compose primitives manually: bordered card (`rounded-xl border border-border bg-card`), colored icon swatch (tinted via inline `backgroundColor`), name, description (`line-clamp-2`), Connect / Authorize button. Connected cards show a green `Check` badge with `role="img"` + `aria-label`.
- `ConnectionModal` (`@/contexts/integrations/presentation/components/connection-modal`) — credential flow.
- `CauseFlowLoader` (`@/contexts/shared/presentation/components/causeflow-loader`) — loading state.
- Grid uses responsive columns: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (mobile-first).

**Form validation.** None — each integration has its own modal schema.

**Exit / skip.** Skip and Continue both route to `/onboarding/business-profile` (`onboarding-integrations-grid.tsx:302-317`). A "more integrations" link also routes forward. OAuth success is surfaced via `postMessage` from the popup (`handleMessage` at `:157-171`) or via `visibilitychange` refresh when the popup closes without posting (`:174-182`).

**Status refresh.** On mount: `/api/integrations` + `/api/integrations/catalog` in parallel (`:152-154`). After connect: refetches `/api/integrations` only.

---

## 3. `/onboarding/business-profile`

Route: `apps/dashboard/src/app/[locale]/onboarding/business-profile/page.tsx` → `BusinessProfilePage`.
Source: `apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-page.tsx`.

**Purpose.** Capture a structured profile of the tenant's team / product / domain via a dynamic, multi-step wizard backed by a JSON schema served from `/api/onboarding/business-profile/schema`. Data is POSTed to `/api/onboarding/business-profile` and syncs to the Hindsight knowledge store.

**Flow position.** Step 3. On submit: `/dashboard?welcome=1` (first-run) or `/dashboard/settings` (edit mode, `?edit=1`).

**Key components.**

- `BusinessProfileWizard` (`apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.tsx`) — owns step index, per-step validation, localStorage draft auto-save.
- `StepRenderer` (`…/business-profile/step-renderer.tsx`) — renders the active step's field list.
- `FieldRenderer` (`…/business-profile/field-renderer.tsx`) — per-field switch (text / textarea / select / tags / etc.).
- `TagsInput` (`…/business-profile/tags-input.tsx`) — free-form tag entry used by tag-type fields.
- `Button` primitive — Back / Next / Submit (`wizard.tsx:145-176`). Spinner is a Lucide `Loader2` with `animate-spin`.
- `CauseFlowLoader` — shown while the schema is in flight.
- Page-level header uses the `ToastProvider` from `layout.tsx` for the non-blocking warning toast emitted when the POST succeeds locally but Hindsight sync failed (`business-profile-page.tsx:75-81`).

**Form validation.** Per-step Zod schemas generated lazily from the loaded JSON schema by `buildZodSchemaForStep` at `@/contexts/onboarding/application/build-zod-from-schema` (`wizard.tsx:70-86`). `validateCurrentStep` runs `safeParse`; the first issue per field populates `errors[fieldId]`, which `StepRenderer` surfaces inline. Localization of field labels/descriptions/enum options is handled by `resolveLocalizedSchema` (`wizard.tsx:36`).

**Draft persistence.** On every `answers` change, `saveDraft(schema.version, answers)` writes to localStorage (`wizard.tsx:53-55`). Key is per-schema-version, locale-agnostic. Cleared on successful submit (`wizard.tsx:104`).

**Exit / skip.** "Skip for now" button (copy from `resolvedSchema.skipLabel`, default `'Skip for now'`) calls `POST /api/onboarding/business-profile/skip` fire-and-forget, then routes to `/dashboard` (`business-profile-page.tsx:93-100`). Skipping never blocks navigation — if the API call throws, the user still advances.

---

## 4. `/onboarding/choose-plan`

Route: `apps/dashboard/src/app/[locale]/onboarding/choose-plan/page.tsx` → re-export of `ChoosePlanPage`.
Source: `apps/dashboard/src/contexts/billing/presentation/pages/choose-plan-page.tsx` — in the **billing** bounded context.

**Purpose.** Self-service plan selection. Fetches `/api/billing/plans`, filters to `selfService === true`, and renders a three-card grid (Starter, Pro, Business). "Pro" is marked popular (`:273`) and gets an emerald-filled treatment plus a "Popular" badge. Clicking a plan POSTs to `/api/billing/checkout` and redirects to the Stripe Checkout URL.

**Flow position.** Step 4. On success: Stripe Checkout → Stripe returns the user to `/dashboard`.

**Key components.**

- Plan `<article>` cards (inline, `choose-plan-page.tsx:278-413`) — bordered card with Lucide plan icon (`Zap` / `Sparkles` / `Shield`), price, trial badge, key metrics, features list with `Check` bullets, and a full-width CTA button.
- `CauseFlowLoader` — pre-ready state while the subscription check runs.
- Lucide icons: `Check`, `Loader2`, `LogOut`, `Mail`, `Shield`, `Sparkles`, `Zap`.
- Clerk hooks: `useAuth` for `orgRole`, `useClerk` for `signOut` — only `org:admin` can configure billing.
- `cn` from `@causeflow/ui/lib` for conditional Tailwind composition.
- `SITE.email` from `@causeflow/shared/constants` for the Enterprise mailto link.

**Form validation.** None — this is a selection, not a form.

**Exit / skip.** There is no skip for admins. Two navigational branches:

- Non-admin landing (`notAdmin === true`, `:207-224`) — renders a "contact your admin" card with a **Sign out** button (Clerk `signOut({ redirectUrl: '/auth/sign-in' })`).
- Admin with an existing real Stripe subscription (`:132-161`) — redirects straight to `/dashboard`. The "real" check requires `subscriptionStatus === 'active' | 'trialing'` **and** `hasStripeCustomer === true`; the second gate is essential because Core API defaults `subscriptionStatus` to `'active'` for fresh tenants (`:123-131`).

A persistent **Sign out** button sits in the top-right of the page (`:237-245`) so users stuck on the plan gate can escape. Fallback plans are hard-coded (`FALLBACK_PLANS` at `:28-86`) so the page still renders if `/api/billing/plans` is unreachable.

---

## Patterns Summary

| Concern | Pattern used |
|---|---|
| Card frame | `rounded-{xl,2xl} border border-border bg-card shadow-{sm,xl}` — consistent across all four pages |
| Enter animation | `animate-in fade-in slide-in-from-bottom-4 duration-500` (welcome and choose-plan) |
| Loading | `CauseFlowLoader` — used on choose-plan, business-profile, integrations |
| Primary CTA | `@causeflow/ui/primitives` `Button` on welcome / business-profile; hand-rolled Tailwind buttons on choose-plan and integrations (flag as drift — see `patterns/ctas.md`) |
| Skip affordance | Muted text-link (`text-muted-foreground hover:text-foreground` + `underline-offset-2`) on integrations and business-profile |
| Progress | Visible progress bar inside `BusinessProfileWizard`; "X of Y" counter on integrations (`data-testid="progress-indicator"`) |

Translation namespaces used: `dashboard.onboarding.*` (integrations grid) and `dashboard.choosePlan.*` (plan page). Welcome and the wizard shell use hard-coded English strings — flag as i18n drift.
