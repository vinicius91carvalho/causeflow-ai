# Onboarding Integrations Step

## Summary

Add an integrations setup step to the onboarding flow, positioned after plan selection and before business profile. Users can connect key integrations during onboarding or skip to set up later.

**Flow change:** `welcome → choose-plan → **integrations** → business-profile`

Also: remove the unused `connect-aws` onboarding step.

---

## Correctness Discovery

1. **Audience:** New users completing onboarding after plan selection. They need a quick way to connect their most important tools before diving into the product.
2. **Verification:** After Stripe checkout completes, user lands on `/onboarding/integrations`. The page shows 14 curated integrations in a grid. Clicking "Connect" opens the existing connection modal (credential or OAuth). "Skip for now" and "Continue" both advance to `/onboarding/business-profile`. The "More integrations" button links to `/dashboard/integrations`.

---

## Acceptance Criteria

- [ ] New route `/onboarding/integrations` renders the integrations setup page
- [ ] Page shows exactly these 14 integrations in order: AWS CloudWatch, GitHub, Notion, Shortcut, Slack, Sentry, Datadog, Trello, Jira, PagerDuty, ZenDesk, Intercom, Linear, GitLab
- [ ] Each integration card shows: icon, name, description, Connect/Authorize button
- [ ] Clicking Connect opens the existing `ConnectionModal` (credential-based) or triggers OAuth popup (OAuth-based), reusing existing integrations infrastructure
- [ ] Connected integrations show a visual "connected" status indicator
- [ ] "More integrations" button at the bottom links to `/dashboard/integrations`
- [ ] "Skip for now" link advances to `/onboarding/business-profile`
- [ ] "Continue" button advances to `/onboarding/business-profile`
- [ ] After Stripe checkout completes (onboarding flow), user is redirected to `/onboarding/integrations` instead of `/onboarding/business-profile`
- [ ] `/onboarding/connect-aws` route is removed
- [ ] Welcome page no longer links to `/onboarding/connect-aws`
- [ ] Page follows mobile-first responsive layout (2-col on mobile, 3-col on tablet, 4-col on desktop)
- [ ] i18n keys added for EN (and PT-BR if existing onboarding translations cover PT-BR)
- [ ] Existing tests updated (checkout-complete-handler redirect assertions)

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `apps/dashboard/src/app/[locale]/onboarding/integrations/page.tsx` | Thin route re-export |
| `apps/dashboard/src/contexts/onboarding/presentation/pages/onboarding-integrations-page.tsx` | Server component page wrapper |
| `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx` | Client component: fetches catalog, renders curated grid, handles connections |

### Modified Files

| File | Change |
|------|--------|
| `apps/dashboard/src/contexts/billing/api/checkout-complete-handler.ts` | Change onboarding redirect from `/onboarding/business-profile?welcome=1` to `/onboarding/integrations` |
| `apps/dashboard/src/contexts/billing/api/checkout-complete-handler.test.ts` | Update redirect assertions |
| `apps/dashboard/src/contexts/identity/presentation/pages/welcome-page.tsx` | Remove connect-aws href, update step links |

### Deleted Files

| File | Reason |
|------|--------|
| `apps/dashboard/src/app/[locale]/onboarding/connect-aws/page.tsx` | Step removed from flow |

### Reused from Integrations Context (read-only, no modifications)

| File | Usage |
|------|-------|
| `contexts/integrations/presentation/components/connection-modal.tsx` | Connection modal for credential-based integrations |
| `contexts/integrations/presentation/components/status-indicator.tsx` | Connected/disconnected dot indicator |
| `contexts/integrations/domain/types.ts` | `IntegrationType`, `INTEGRATION_AUTH_TYPES`, `IntegrationStatus` |
| `packages/shared/src/domain/constants/integrations.ts` | `INTEGRATIONS` catalog for icons, descriptions, categories |

### Cross-Context Import Note

The onboarding integrations grid will import from the `integrations` context (connection-modal, status-indicator, types) and from `packages/shared` (catalog). This is acceptable cross-context usage since we're reusing existing infrastructure, not duplicating it.

---

## Curated Integration List

These 14 integrations are shown on the onboarding page, in this order:

| # | Catalog ID | Display Name | Auth Type |
|---|-----------|-------------|-----------|
| 1 | `aws-cloudwatch` | AWS CloudWatch | credentials |
| 2 | `github` | GitHub | oauth |
| 3 | `notion` | Notion | oauth |
| 4 | `shortcut` | Shortcut | oauth |
| 5 | `slack` | Slack | oauth |
| 6 | `sentry` | Sentry | oauth |
| 7 | `datadog` | Datadog | oauth |
| 8 | `trello` | Trello | oauth |
| 9 | `jira` | Jira | oauth |
| 10 | `pagerduty` | PagerDuty | oauth |
| 11 | `zendesk` | Zendesk | credentials (CRM) |
| 12 | `intercom` | Intercom | oauth (CRM) |
| 13 | `linear` | Linear | oauth |
| 14 | `gitlab` | GitLab | oauth |

The `ONBOARDING_INTEGRATION_IDS` constant should be defined in the onboarding grid component.

---

## Navigation Flow (Updated)

```
/onboarding/welcome
    ↓ (user clicks "Get Started")
/onboarding/choose-plan
    ↓ (Stripe checkout → /api/billing/checkout/complete)
/onboarding/integrations        ← NEW
    ↓ ("Continue" or "Skip for now")
/onboarding/business-profile
    ↓ (submit or skip)
/dashboard?welcome=1
```

### Key Redirect Changes

1. **`checkout-complete-handler.ts` line ~75:** Change `'/onboarding/business-profile?welcome=1'` → `'/onboarding/integrations'`
2. **Onboarding integrations page:** Both Continue and Skip navigate to `/onboarding/business-profile`
3. **Business profile page:** Unchanged — still redirects to `/dashboard?welcome=1` on submit, `/dashboard` on skip

---

## UI Design

### Page Layout

```
┌─────────────────────────────────────────────┐
│         Set Up Your Integrations            │
│   Connect your tools to get the most out    │
│   of CauseFlow. You can always add more     │
│   from Settings later.                      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ AWS  │  │GitHub│  │Notion│  │Short │   │
│  │  ✓   │  │      │  │      │  │ cut  │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │Slack │  │Sentry│  │Data  │  │Trello│   │
│  │      │  │      │  │ dog  │  │      │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ Jira │  │Pager │  │Zen   │  │Inter │   │
│  │      │  │ Duty │  │ desk │  │ com  │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│  ┌──────┐  ┌──────┐                        │
│  │Linear│  │GitLab│   [+ More integrations] │
│  │      │  │      │                        │
│  └──────┘  └──────┘                        │
│                                             │
├─────────────────────────────────────────────┤
│          Skip for now     [Continue →]      │
└─────────────────────────────────────────────┘
```

### Card Design (Simplified from integration-card.tsx)

Each card shows:
- Integration icon (from PROVIDER_ICONS map in integrations-client.tsx)
- Integration name
- Short description (from INTEGRATIONS catalog)
- Action button: "Connect" (credentials) / "Authorize" (OAuth) / "Connected ✓" (already connected)
- Status indicator dot when connected

### Responsive Grid

- Mobile (< 640px): 2 columns
- Tablet (640-1024px): 3 columns
- Desktop (> 1024px): 4 columns

---

## Implementation Notes

### `onboarding-integrations-grid.tsx` (Client Component)

This is the main new component. It should:

1. **On mount:** Fetch integrations status from `GET /api/integrations` to know which are already connected
2. **Render grid:** Filter `INTEGRATIONS` catalog to only the 14 curated IDs, render simplified cards
3. **Connect flow:** 
   - For `credentials` auth type: open `ConnectionModal` from integrations context
   - For `oauth` auth type: POST to `/api/integrations/oauth/{id}/authorize` and open popup (same as `integrations-client.tsx`)
4. **OAuth callback:** Listen for `message` event with `oauth-callback` type to refresh status
5. **Track connected count:** Show "X of 14 connected" or similar progress indicator
6. **Navigation:** "Continue" and "Skip for now" both use `router.push('/onboarding/business-profile')`

### Icon Resolution

Reuse `PROVIDER_ICONS` map from `integrations-client.tsx`. If importing directly creates circular dependencies, extract the icon map to a shared file within the integrations context (e.g., `integrations/presentation/components/provider-icons.ts`).

### i18n Keys

Add under `dashboard.onboarding.integrations` namespace:
- `title`: "Set Up Your Integrations"
- `description`: "Connect your tools to get the most out of CauseFlow. You can always add more from Settings later."
- `connect`: "Connect"
- `authorize`: "Authorize"
- `connected`: "Connected"
- `moreIntegrations`: "More integrations"
- `skip`: "Skip for now"
- `continue`: "Continue"
- `progress`: "{count} of {total} connected"

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| OAuth popups may not work in onboarding layout (no dashboard chrome) | The onboarding layout is a simple centered card — popups should work fine since they're window-level |
| Connection modal needs dashboard sidebar context | ConnectionModal is self-contained — it only needs the integration type and callbacks |
| Removing connect-aws breaks existing links | Only one reference exists (welcome-page.tsx line 66) — update it |

---

## Out of Scope

- Modifying the `TUTORIAL_STEPS` modal wizard (it's a separate post-onboarding feature)
- Changing the integrations catalog or adding new integrations
- Updating the legacy `STEP_KEYS` / `OnboardingProgress` model
- E2E tests (can be added in a follow-up task)
