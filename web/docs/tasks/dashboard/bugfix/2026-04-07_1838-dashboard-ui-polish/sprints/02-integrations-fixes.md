# Sprint 02 — Integrations Page Fixes

**Depends on:** none
**Blocks:** none
**Est. effort:** 45-60 min
**Parallel:** yes, with Sprint 01 (no file overlap)

## Goal
Three fixes on the Integrations page:
1. AWS IAM setup guide step 5 — add hint about filtering by "AWS managed - job function" to find `ReadOnlyAccess`.
2. Test Connection success/error toast on card-level test runs (currently silent).
3. Relabel the reconfigure button on OAuth integrations (GitHub etc.) to "Reauthorize" with a re-auth icon and tooltip — the action still triggers Composio OAuth, but the label now makes the intent clear. Credential integrations (AWS, Postgres, Webhooks) keep the current "Reconfigure" gear button unchanged.

## File Boundaries
- **Create:** none
- **Modify:**
  - `apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json`
  - `apps/dashboard/src/contexts/integrations/infrastructure/i18n/pt-br.json`
  - `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
  - `apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx`
- **Read-only:**
  - `apps/dashboard/src/contexts/integrations/presentation/components/connection-modal.tsx` (reference for existing testState pattern)
  - `apps/dashboard/src/contexts/integrations/domain/types.ts`
  - `packages/ui/src/*` (check for existing Toast / Sonner / Alert primitive)

## Tasks

### Fix 1 — AWS setup hint
1. Read `en.json` key `guides.cloudwatch.steps.5` (currently line 123: *"Attach the AWS managed policy: ReadOnlyAccess (provides read-only access across all AWS services)."*).
2. Update to include a filter hint. Suggested text:
   *"Attach the AWS managed policy **ReadOnlyAccess** (provides read-only access across all AWS services). If you don't see it in the policy list, change the filter to 'AWS managed - job function'."*
3. Mirror the change in `pt-br.json` with a translated version:
   *"Anexe a política gerenciada pela AWS **ReadOnlyAccess** (fornece acesso somente leitura a todos os serviços AWS). Se não encontrar na lista, altere o filtro para 'AWS managed - job function'."*
4. If the UI renders steps as plain text (check `connection-modal.tsx` line 332-338 — uses `getGuideSteps()`), the markdown-style `**bold**` will render literally. If so, either drop the asterisks and rely on plain text, or ensure the renderer supports bold (probably not — safest: plain text). Confirm during the sprint and adjust.

### Fix 2 — Test Connection toast
1. **Probe for an existing toast primitive.** Check:
   - `grep -rn 'Toast\|sonner\|useToast' packages/ui/src/`
   - `grep -rn 'Toast\|sonner\|useToast' apps/dashboard/src/`
   - Any existing `Toaster` provider mounted in a layout
2. **If a toast system exists** (e.g. sonner re-exported from `@causeflow/ui`): import it in `integrations-client.tsx` and call it from the `onTest` wrapper.
3. **If NO toast system exists:** add a controlled local alert banner at the top of the integrations-client component:
   - Local state: `const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; name: string } | null>(null)`
   - Render a dismissable banner (reuse the existing `bg-green-500/10` / `bg-destructive/10` styles from `connection-modal.tsx:391-402`) above the integrations grid
   - Auto-dismiss via `setTimeout(() => setTestResult(null), 4500)` in a `useEffect` keyed on `testResult`
   - Include a manual close button for a11y
4. Identify where `onTest` is currently wired in `integrations-client.tsx` — trace the prop passed to `<IntegrationCard onTest={...} />`. Wrap the existing logic with `.then(() => setTestResult({ type: 'success', name }))` / `.catch(() => setTestResult({ type: 'error', name }))`.
5. Add i18n keys: `testResult.success` ("Connection to {name} succeeded") and `testResult.error` ("Connection to {name} failed"). Mirror in pt-br.json.
6. **Do NOT install a new dependency.** If no toast primitive exists and adding one looks necessary, stop and escalate.

### Fix 3 — Relabel reconfigure button for OAuth integrations (Option B)
1. In `integration-card.tsx`, find the reconfigure button block around line 247-257 (the one with `<Settings />` icon).
2. Inside the button, select the icon, label, and tooltip based on `authType`:
   - `authType === 'credential'` → icon `<Settings />`, tooltip `t('card.reconfigureTooltip')` (or current "Reconfigure" title), aria-label `Reconfigure {name}`
   - `authType === 'oauth'` → icon `<RefreshCw />` (already imported at line 4; if not, add to lucide import), tooltip `t('card.reauthorizeTooltip')`, aria-label `Reauthorize {name}`
   - Note: `RefreshCw` is already used elsewhere in the file (disconnect button line 269). Pick a different but semantically clear icon for reauthorize to avoid visual collision — e.g. `KeyRound` or `ShieldCheck`. Choose during the sprint, prefer `ShieldCheck` (signals security/permissions refresh). Confirm lucide-react has it (it does).
3. The onClick handler stays `onReconfigure` for both variants — do NOT change the behavior.
4. Add i18n keys in `integrations/infrastructure/i18n/en.json`:
   - `card.reauthorizeButton`: "Reauthorize"
   - `card.reauthorizeTooltip`: "Refresh OAuth permissions — use this if scopes or access have changed"
   - (confirm current keys for reconfigure; if missing, add `card.reconfigureButton` / `card.reconfigureTooltip` for symmetry)
5. Mirror in `pt-br.json`:
   - `card.reauthorizeButton`: "Reautorizar"
   - `card.reauthorizeTooltip`: "Atualizar permissões OAuth — use se os escopos ou o acesso mudaram"
6. Verify: GitHub card shows `ShieldCheck` + "Reauthorize" tooltip; AWS card shows `Settings` + "Reconfigure" tooltip. Both still function (click → appropriate flow).

## Acceptance Criteria
- [ ] `guides.cloudwatch.steps.5` in en.json contains the "AWS managed - job function" hint
- [ ] pt-br.json mirrors the hint
- [ ] Clicking Test Connection on a connected integration shows a visible success or error banner/toast within 1s
- [ ] Banner/toast auto-dismisses after ~4-5s
- [ ] GitHub integration card (and all other OAuth integrations) renders a "Reauthorize" button with a non-gear icon (e.g. `ShieldCheck`) and a tooltip explaining its purpose
- [ ] AWS integration card still renders the "Reconfigure" button with the `Settings` gear icon, unchanged
- [ ] Both variants still invoke `onReconfigure` when clicked (behavior preserved)
- [ ] New i18n keys `card.reauthorizeButton` and `card.reauthorizeTooltip` present in en.json and pt-br.json
- [ ] No new dependency added
- [ ] `pnpm exec biome check apps/dashboard/src/contexts/integrations/` — green
- [ ] `pnpm turbo check-types` — green
- [ ] Dev server smoke: navigate to /dashboard/integrations, click Test Connection on a connected integration, confirm toast. Check GitHub card has no gear. Open AWS connect modal and verify step 5 text.
- [ ] Screenshots saved to `./screenshots/2026-04-07_1838-ui-polish/sprint-02/`

## Return Summary
- Files modified with line counts
- Toast primitive used (existing path OR "local inline banner fallback")
- Screenshot paths for: integrations page with Test toast, GitHub card ("Reauthorize" button + icon + tooltip visible), AWS card ("Reconfigure" gear button unchanged), AWS setup guide step 5 visible
- Icon chosen for Reauthorize variant (`ShieldCheck` recommended; note alternative if selected)
- Any wording changes made to the AWS hint if plain text was required
