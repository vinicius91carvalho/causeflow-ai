# Architecture Invariants — UI Polish

## Clerk theme overrides
- **Owner:** `apps/dashboard/src/styles/clerk-overrides.css` (path may vary — find via glob)
- **Preconditions:** Any Clerk UI rendered inside the dashboard must inherit CauseFlow surface and foreground tokens.
- **Postconditions:** Clerk MembersPage invite UI uses `hsl(var(--card))` for container and `hsl(var(--background))` for input field surfaces in both light and dark mode.
- **Invariants:**
  - No hardcoded `#fff` / `#000` / `white` / `black` color values in Clerk override rules — always reference CSS variables.
  - Light-mode and dark-mode rules are symmetrical (any selector targeted in one is targeted in the other).
- **Verify:** Playwright snapshot of `/dashboard/team#/organization-members` in light and dark theme shows tokens applied
- **Fix:** Add the missing rules to `clerk-overrides.css`

## Integration card action buttons by auth type
- **Owner:** `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
- **Preconditions:** The card receives an `authType: 'oauth' | 'credential'` prop.
- **Postconditions:** The reconfigure button is rendered for BOTH auth types, but its label, icon, and tooltip differ. `authType === 'credential'` uses `Settings` icon + "Reconfigure" label. `authType === 'oauth'` uses `RefreshCw` (or similar) icon + "Reauthorize" label + tooltip "Refresh OAuth permissions".
- **Invariants:**
  - Credential integration cards render "Reconfigure" with the `Settings` gear icon.
  - OAuth integration cards render "Reauthorize" with a re-auth icon — never the `Settings` gear.
  - Both variants invoke the same `onReconfigure` callback.
- **Verify:** Visual inspection of GitHub card (reauthorize) and AWS card (reconfigure); `grep -n 'authType' integration-card.tsx` shows conditional rendering
- **Fix:** In `integration-card.tsx`, select the label/icon based on `authType` inside the reconfigure button block.

## Test Connection feedback
- **Owner:** `apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx`
- **Preconditions:** Any invocation of card-level test connection must produce a visible UI signal to the user.
- **Postconditions:** Success and error outcomes both emit a toast/alert visible on screen within 1s, auto-dismissing after 4-5s.
- **Invariants:** `onTest` handler passed to `<IntegrationCard>` never resolves silently — always triggers a toast or alert state.
- **Verify:** Manual click on Test Connection for a connected integration shows a colored banner
- **Fix:** Wire `onTest` to a toast hook or controlled inline alert state in the parent component.

## /api/integrations response shape contract
- **Owner:** `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts`
- **Preconditions:** Callers of `GET /api/integrations` must extract the `.integrations` property from the JSON response.
- **Postconditions:** Response is always `{ integrations: ApiIntegration[] }`. Legacy raw-array responses exist only as a back-compat branch.
- **Invariants:**
  - `dashboard-overview.tsx` and any other consumer handles both `{ integrations: [...] }` and `[...]` shapes.
  - Integration count derived from the response drives `hasIntegrations` correctly — a user with N≥1 integrations NEVER lands on Branch A.
- **Verify:** `pnpm vitest run apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.test`
- **Fix:** Update any consumer that calls `Array.isArray(json)` directly without checking `.integrations` first.

## Confetti trigger discipline
- **Owner:** `apps/dashboard/src/contexts/shared/lib/confetti.ts`
- **Preconditions:** Each confetti function corresponds to exactly one UX moment.
- **Postconditions:** `signUpConfetti()` fires exclusively at end-of-tutorial completion.
- **Invariants:**
  - `grep -rn 'signUpConfetti(' apps/dashboard/src | wc -l` returns exactly **2**: one in `confetti.ts` (definition) and one in the onboarding tutorial completion handler (call site).
  - No usages of `signUpConfetti` exist in sign-up pages, plan-select pages, or auth callbacks.
- **Verify:** `grep -rn 'signUpConfetti' apps/dashboard/src`
- **Fix:** Remove stray call sites; keep only the end-of-tutorial one.
