# Page Shells

A page shell is the outermost frame that wraps all page content: header/nav, main landmark, footer or sidebar, and the centering / width constraints that every page inherits. CauseFlow has three distinct shells because it has three distinct surfaces.

## 1. Marketing Shell (`apps/website`)

Every marketing page composes these three layout primitives from `@causeflow/ui/layouts`:

- `PageLayout` — the outer `min-h-screen flex flex-col` wrapper with optional `header` and `footer` slots and a `<main id="main-content" className="flex-1">` in between. Source: `packages/ui/src/presentation/layouts/page-layout.tsx`.
- `SectionLayout` — a full-bleed `<section>` with vertical rhythm (`py-16 sm:py-20 lg:py-24`), a contained inner container (`mx-auto max-w-7xl`), and four background variants: `default`, `dark`, `muted`, `accent`. Source: `packages/ui/src/presentation/layouts/section-layout.tsx`.
- `TwoColumnLayout` — stacks on mobile, splits 50/50 at `lg`, with optional `reversed` for alternating layouts. Source: `packages/ui/src/presentation/layouts/two-column-layout.tsx`.

**Composition rule:** `PageLayout` wraps the whole page; every content band is a `SectionLayout`; two-column bands go inside a `SectionLayout` and use `TwoColumnLayout` for the split.

**Real example — `home-page.tsx`:**

```tsx
// apps/website/src/contexts/marketing/presentation/pages/home-page.tsx:255-530
<PageLayout header={<Header />} footer={<Footer />}>
  <HeroSection variant="dark" ...>
    <InvestigationDashboardPreview ... />
  </HeroSection>

  <SectionLayout id="metrics" className="py-12 sm:py-16 lg:py-20">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard ... />
    </div>
  </SectionLayout>

  <SectionLayout variant="dark" id="cross-tool">
    <TwoColumnLayout
      left={<AnimateOnScroll variant="fade-left">...</AnimateOnScroll>}
      right={<AnimateOnScroll variant="fade-right" delay={200}>...</AnimateOnScroll>}
    />
  </SectionLayout>
</PageLayout>
```

### Full-bleed vs contained

`SectionLayout` is intentionally two-layer:

- The outer `<section>` is full-bleed so backgrounds (`variant="dark"`) extend edge-to-edge on wide monitors.
- The inner `<div className="mx-auto max-w-7xl">` contains content so text stays readable.

Override padding via `className` when a section needs tighter or looser rhythm (`home-page.tsx:319` uses `py-12 sm:py-16 lg:py-20` instead of the default `py-16 sm:py-20 lg:py-24`).

### Hero sections

The home / product / security heroes use `HeroSection` (`apps/website/src/contexts/marketing/presentation/components/sections/hero-section.tsx`) — itself a specialized `<section>` with:

- `variant: 'dark' | 'light'` background
- Two absolute-positioned blurred glow divs when `dark` (`hero-section.tsx:38-43`)
- Optional `badge`, `title`, `subtitle`, `primaryCta`, `secondaryCta`, `trustText`, and a `children` slot (right-column visualization)
- Responsive: text stacks full-width when `children` is absent; splits `lg:flex-row` when a visualization child is provided

Heroes are NOT wrapped in `SectionLayout` because they manage their own padding (`py-16 sm:py-20 lg:py-28`) and glow effects.

## 2. Dashboard Shell (`apps/dashboard` — authenticated product)

Source: `apps/dashboard/src/contexts/shared/presentation/components/layout/dashboard-layout.tsx`.

```tsx
<ToastProvider>
  <CommandPaletteProvider>
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} ... />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-gradient-to-br ...">
        <Topbar onMobileMenuOpen={...} breadcrumb={breadcrumb} />
        <div className="shrink-0 border-b border-border/50 px-4 py-2 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
        <main id="main-content" className="relative flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {/* grid overlay (opacity 0.02) */}
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
    <OnboardingOrchestrator />
  </CommandPaletteProvider>
</ToastProvider>
```

Key invariants:

- Root container is `flex h-dvh overflow-hidden` — the shell itself does not scroll; `<main>` does (`overflow-y-auto`). This means sticky positioning inside a page works without competing with a document-level scroll.
- Sidebar is collapsible (`collapsed` state) and mobile-drawer (`mobileOpen` state) in one component.
- Topbar is 4rem high (`h-16`); breadcrumbs bar is ~2.25rem; main padding is `p-4 sm:p-6 lg:p-8`. Pages that need fixed-viewport content (like `IncidentDetail`) compute against these (see `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx:128`: `sm:h-[calc(100dvh-10.25rem)]`).
- `ToastProvider` and `CommandPaletteProvider` live in the shell so every page inherits them.
- The `OnboardingOrchestrator` is mounted as a sibling of the main layout so it can overlay any route without intercepting navigation.

Routes: `apps/dashboard/src/app/[locale]/dashboard/layout.tsx` renders `DashboardLayout` for every page under `/dashboard/*`.

## 3. Auth / Onboarding Shell (`apps/dashboard` — pre-tenant surfaces)

Source: `apps/dashboard/src/app/[locale]/onboarding/layout.tsx`.

A much simpler shell for first-run screens: no sidebar, no topbar. Just a centered card on a subtle gradient:

```tsx
<ToastProvider>
  <main className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
    {/* grid overlay, opacity-[0.02] */}
    <div className="relative w-full max-w-5xl">{children}</div>
  </main>
</ToastProvider>
```

Notes:

- `metadata.robots = { index: false, follow: false }` — onboarding is never indexable.
- The gradient + grid overlay is the same visual DNA as the dashboard's `<main>` background, so the transition from onboarding to dashboard feels continuous.
- `max-w-5xl` is wider than a typical auth card because the business-profile wizard renders multi-column field groups.

## When to Use Which

| Situation | Shell |
|---|---|
| Any public marketing / docs page | `PageLayout` + `SectionLayout` bands |
| Any authenticated in-product page | `DashboardLayout` |
| First-run setup (welcome, business-profile, integrations, choose-plan) | Onboarding layout at `app/[locale]/onboarding/layout.tsx` |
| Legal / content-heavy page | `LegalPageLayout` (`packages/ui/src/presentation/layouts/legal-page-layout.tsx`) — consistent prose width + side TOC |

## Anti-patterns

- Do not wrap a `HeroSection` in a `SectionLayout` — both apply padding and will double it.
- Do not add document-level scroll inside `DashboardLayout`; scroll belongs to `<main>`. Adding `overflow-y-auto` on the shell container breaks the fixed-viewport pages (`IncidentDetail`).
- Do not create ad-hoc gradient backgrounds on marketing pages; use `SectionLayout variant="dark"` or `variant="muted"` so themes can override.
