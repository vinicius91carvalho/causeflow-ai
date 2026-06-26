# Sprint 1: Onboarding Integrations Step

## Objective

Add an integrations setup step to the onboarding flow after plan selection and before business profile. Users can connect key integrations during onboarding or skip.

**Flow change:** `welcome → choose-plan → **integrations** → business-profile`

---

## Files to Create

- `apps/dashboard/src/app/[locale]/onboarding/integrations/page.tsx` — Thin route re-export
- `apps/dashboard/src/contexts/onboarding/presentation/pages/onboarding-integrations-page.tsx` — Server component page wrapper
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx` — Client component: curated grid with connection handling
- `apps/dashboard/src/contexts/onboarding/presentation/components/__tests__/onboarding-integrations-grid.test.tsx` — Unit tests for the grid component

## Files to Modify

- `apps/dashboard/src/contexts/billing/api/checkout-complete-handler.ts` — Change onboarding redirect from `'/onboarding/business-profile?welcome=1'` to `'/onboarding/integrations'`
- `apps/dashboard/src/contexts/billing/api/checkout-complete-handler.test.ts` — Update redirect assertion to expect `/onboarding/integrations`
- `apps/dashboard/src/contexts/identity/presentation/pages/welcome-page.tsx` — Remove "Connect AWS" step, update step list
- `apps/dashboard/src/contexts/onboarding/infrastructure/i18n/en.json` — Add `onboarding.integrations.*` i18n keys
- `apps/dashboard/src/contexts/onboarding/infrastructure/i18n/pt-br.json` — Add `onboarding.integrations.*` i18n keys (PT-BR translations)

## Files to Delete

- `apps/dashboard/src/app/[locale]/onboarding/connect-aws/page.tsx` — Step removed from onboarding flow

## Files Read-Only (reference only, do NOT modify)

- `apps/dashboard/src/contexts/integrations/presentation/components/connection-modal.tsx` — Reuse for credential-based connections
- `apps/dashboard/src/contexts/integrations/presentation/components/status-indicator.tsx` — Reuse for connected indicator
- `apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx` — Reference for PROVIDER_ICONS and OAuth flow patterns
- `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` — Reference for card design
- `apps/dashboard/src/contexts/integrations/domain/types.ts` — IntegrationType, auth type constants
- `packages/shared/src/domain/constants/integrations.ts` — INTEGRATIONS catalog with IDs, names, descriptions
- `apps/dashboard/src/app/[locale]/onboarding/business-profile/page.tsx` — Reference for route pattern
- `apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-page.tsx` — Reference for page pattern

---

## Acceptance Criteria

- [ ] New route `/onboarding/integrations` renders the integrations setup page
- [ ] Page shows exactly 14 curated integrations in order: AWS CloudWatch, GitHub, Notion, Shortcut, Slack, Sentry, Datadog, Trello, Jira, PagerDuty, ZenDesk, Intercom, Linear, GitLab
- [ ] Each card shows: icon, name, description, Connect/Authorize button
- [ ] Clicking Connect opens the existing `ConnectionModal` (credential-based) or triggers OAuth popup (OAuth-based), reusing existing integrations infrastructure
- [ ] Connected integrations show a visual "connected" status indicator
- [ ] "More integrations" button at bottom links to `/dashboard/integrations`
- [ ] "Skip for now" link advances to `/onboarding/business-profile`
- [ ] "Continue" button advances to `/onboarding/business-profile`
- [ ] Checkout-complete-handler redirects to `/onboarding/integrations` instead of `/onboarding/business-profile?welcome=1`
- [ ] `/onboarding/connect-aws` route file is deleted
- [ ] Welcome page no longer links to `/onboarding/connect-aws`
- [ ] Responsive grid: 2-col mobile, 3-col tablet, 4-col desktop
- [ ] i18n keys added for EN and PT-BR
- [ ] Existing checkout-complete-handler tests updated
- [ ] New unit tests for onboarding-integrations-grid component
- [ ] All builds pass, all existing tests pass

---

## Implementation Details

### 1. Route Page (`app/[locale]/onboarding/integrations/page.tsx`)

Thin re-export, same pattern as business-profile:
```tsx
export { default } from '@/contexts/onboarding/presentation/pages/onboarding-integrations-page';
```

### 2. Server Page (`onboarding-integrations-page.tsx`)

Server component wrapper. Minimal — just renders the client grid component:
```tsx
import OnboardingIntegrationsGrid from '../components/onboarding-integrations-grid';
export default function OnboardingIntegrationsPage() {
  return <OnboardingIntegrationsGrid />;
}
```

### 3. Client Grid (`onboarding-integrations-grid.tsx`)

This is the main new component. Key patterns:

**ONBOARDING_INTEGRATION_IDS constant:**
```ts
const ONBOARDING_INTEGRATION_IDS = [
  'aws-cloudwatch', 'github', 'notion', 'shortcut', 'slack', 'sentry',
  'datadog', 'trello', 'jira', 'pagerduty', 'zendesk', 'intercom', 'linear', 'gitlab'
] as const;
```

**On mount:** Fetch integration statuses from `GET /api/integrations` to know which are connected.

**Grid rendering:** Filter INTEGRATIONS catalog to only the 14 curated IDs, render simplified cards.

**Connect flow:**
- For `credentials` auth type: open `ConnectionModal` from integrations context
- For `oauth` auth type: POST to `/api/integrations/oauth/{id}/authorize` and open popup (same as integrations-client.tsx)

**OAuth callback:** Listen for `message` event with `oauth-callback` type to refresh status.

**Track connected count:** Show "{count} of {total} connected" progress indicator.

**Navigation:** "Continue" and "Skip for now" both use `router.push('/onboarding/business-profile')`.

**Responsive grid classes:** `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`

**Icon resolution:** Import PROVIDER_ICONS from integrations-client.tsx. If this creates circular dependency issues, extract to a shared file.

### 4. Checkout Handler Change

In `checkout-complete-handler.ts`, change:
```ts
// FROM:
: '/onboarding/business-profile?welcome=1';
// TO:
: '/onboarding/integrations';
```

### 5. Welcome Page Update

In `welcome-page.tsx`, remove or replace the "Connect AWS" step:
```ts
// Remove this step:
{
  icon: Cloud,
  title: 'Connect AWS',
  description: 'Link your AWS account...',
  href: '/onboarding/connect-aws',
}
// Replace with integrations step:
{
  icon: Plug,
  title: 'Set Up Integrations',
  description: 'Connect your tools to get the most out of CauseFlow.',
  href: '/onboarding/integrations',
}
```
Also remove the duplicate "Install an Integration" step since the new integrations step covers it.

### 6. Delete connect-aws route

```bash
rm apps/dashboard/src/app/[locale]/onboarding/connect-aws/page.tsx
```

Also check if `contexts/identity/presentation/components/connect-aws-form.tsx` exists and should be removed (the page re-exports it). If the form is used elsewhere, keep it; if only used by the deleted route, remove it too.

### 7. i18n Keys

Add under onboarding namespace in both en.json and pt-br.json:
```json
"integrations": {
  "title": "Set Up Your Integrations",
  "description": "Connect your tools to get the most out of CauseFlow. You can always add more from Settings later.",
  "connect": "Connect",
  "authorize": "Authorize",
  "connected": "Connected",
  "moreIntegrations": "More integrations",
  "skip": "Skip for now",
  "continue": "Continue",
  "progress": "{count} of {total} connected"
}
```

PT-BR translations:
```json
"integrations": {
  "title": "Configure Suas Integrações",
  "description": "Conecte suas ferramentas para aproveitar ao máximo o CauseFlow. Você sempre pode adicionar mais nas Configurações.",
  "connect": "Conectar",
  "authorize": "Autorizar",
  "connected": "Conectado",
  "moreIntegrations": "Mais integrações",
  "skip": "Pular por agora",
  "continue": "Continuar",
  "progress": "{count} de {total} conectados"
}
```

---

## Testing

### Unit Tests for onboarding-integrations-grid.tsx

Test cases:
1. Renders all 14 integration cards
2. Shows correct integration names and descriptions
3. Shows "Connect" for credential-based, "Authorize" for OAuth-based
4. Opens ConnectionModal when clicking Connect on credential integration
5. Initiates OAuth flow when clicking Authorize on OAuth integration
6. Shows connected status for already-connected integrations
7. "Skip for now" navigates to /onboarding/business-profile
8. "Continue" navigates to /onboarding/business-profile
9. "More integrations" links to /dashboard/integrations
10. Responsive grid renders correct column count at breakpoints

### Updated Tests for checkout-complete-handler.test.ts

Update the onboarding success redirect assertion from `/onboarding/business-profile?welcome=1` to `/onboarding/integrations`.

---

## IMPORTANT Rules (from session learnings)

- **useToast API:** The project uses `const { addToast } = useToast()` with `addToast(message, type)`. Do NOT use shadcn's `toast({ title, description, variant })` pattern — it does not exist here.
- **Package manager:** Use `pnpm` exclusively. Never `npm` or `npx`.
- **No barrel imports:** Always use direct deep paths to files, never context index.ts barrels.
- **Mobile-first:** Build responsive from small to large breakpoints.
- **Dark theme:** Project uses deep indigo + teal dark theme. Cards use `bg-card border-border`.
