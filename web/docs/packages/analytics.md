# @causeflow/analytics

GA4 and Microsoft Clarity integration for CauseFlow AI. Provides a React provider, a tracking hook, and a type-safe event catalog used across both `apps/website` and `apps/dashboard`.

## Overview

Analytics is config-driven and environment-aware. Scripts load with `lazyOnload` strategy — they are deferred until after the first user interaction, keeping Lighthouse scores unaffected by third-party script weight.

## AnalyticsProvider

Wraps the application at the root layout level. Injects GA4 and Microsoft Clarity `<script>` tags using Next.js `<Script>` with `strategy="lazyOnload"`.

```typescript
import { AnalyticsProvider } from '@causeflow/analytics'

// apps/website/src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsProvider
          ga4Id={process.env.NEXT_PUBLIC_GA4_ID}
          clarityId={process.env.NEXT_PUBLIC_CLARITY_ID}
        >
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  )
}
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `ga4Id` | `string \| undefined` | Google Analytics Measurement ID (`G-XXXXXXXXXX`) |
| `clarityId` | `string \| undefined` | Microsoft Clarity project ID |

If either ID is `undefined` or empty, the corresponding script is silently skipped. This means analytics is automatically disabled in local development if `.env.local` omits the IDs.

## useTrackEvent() Hook

Client-only hook for sending custom events to GA4's `gtag('event', ...)` interface.

```typescript
import { useTrackEvent } from '@causeflow/analytics'

function PricingCard({ plan }) {
  const trackEvent = useTrackEvent()

  return (
    <button
      onClick={() =>
        trackEvent({
          name: 'pricing_plan_click',
          planId: plan.id,
          planName: plan.name,
        })
      }
    >
      Get Started
    </button>
  )
}
```

The hook is a no-op when `gtag` is not available (server-side render, analytics disabled, ad blocker). Call sites do not need guard checks.

## Event Catalog

All events are defined as a **discriminated union** type keyed on `name`. TypeScript enforces that every event carries its required payload fields.

| Event Name | Required Fields | Description |
|---|---|---|
| `page_view` | `path, title` | Manual page view (supplements GA4 automatic collection) |
| `cta_click` | `ctaId, ctaText, location` | Any call-to-action button click |
| `form_submit` | `formId, status` | Form submission attempt (success or error) |
| `roi_calculator_use` | `teamSize, incidentsPerMonth, result` | ROI calculator interaction |
| `pricing_plan_click` | `planId, planName` | Pricing plan selection |
| `integration_filter` | `category, resultCount` | Integration catalog filter change |
| `language_switch` | `fromLocale, toLocale` | i18n language toggle |
| `demo_request` | `source` | Demo/trial request initiated |
| `compare_page_view` | `competitor` | Competitor comparison page viewed |

### Type Safety Example

```typescript
// This compiles:
trackEvent({ name: 'cta_click', ctaId: 'hero-primary', ctaText: 'Start Free Trial', location: 'hero' })

// This fails at compile time (missing required field):
trackEvent({ name: 'cta_click', ctaId: 'hero-primary' })
//                                               ^^^^^^ Error: missing ctaText, location
```

## Configuration

Analytics behavior is driven by environment variables:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_GA4_ID` | No | Google Analytics 4 Measurement ID |
| `NEXT_PUBLIC_CLARITY_ID` | No | Microsoft Clarity Project ID |

Both variables are defined in the root `.env.local` with real values for production. They are omitted or left empty in local development to avoid polluting production analytics data.

## Performance

- **Strategy:** `lazyOnload` — scripts load after the page becomes interactive, not during critical render path
- **Blocked in tests:** Playwright's `test.beforeEach` blocks all analytics and tracker domains (GA, Microsoft Clarity, Intercom) so test runs never fire real tracking events
- **No bundle cost at build time:** Scripts are injected at runtime, not bundled
