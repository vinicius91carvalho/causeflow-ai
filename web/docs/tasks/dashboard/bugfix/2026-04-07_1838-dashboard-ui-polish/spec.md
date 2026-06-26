# PRD B — Dashboard Fixes: Clerk, Confetti, Integrations, Overview Branching

**Created:** 2026-04-07 18:38
**Mode:** Standard (3 sprints)
**Status:** Build Candidate (pending tag)
**Owner:** Vinicius

---

## 1. Intent

Six small UI fixes across Clerk surfaces, onboarding confetti, and the Integrations page. All are trust-erosion issues for new users.

**Sprint 1 — Clerk + confetti:**
1. **Clerk invite member modal colors** — On `/dashboard/team#/organization-members` (Clerk's `<OrganizationProfile>` MembersPage), the invite-by-email field and its container render with white background and black text input that ignore the CauseFlow theme tokens. We have `clerk-overrides.css` with dark-mode rules but **no light-mode rules** for the members invite UI, so the Clerk default leaks through.
2. **Clerk OTP input centering** — On the verify-email screen, OTP digits are not centered inside their input boxes. `clerk-overrides.css` already has `text-align: center !important` rules but the selectors don't match the current Clerk DOM.
3. **End-of-tutorial confetti** — The current `signUpConfetti()` fires one central burst with gold/teal stars. The user wants two side-cannon confetti bursts (left + right firing inward), shapes are circles/squares (no stars), and colors are CauseFlow brand light green and purple. The confetti must fire **only at the end of the onboarding tutorial**, not at any other point.

**Sprint 2 — Integrations page fixes:**
4. **AWS IAM setup — `ReadOnlyAccess` discoverability hint** — The setup guide step 5 currently says *"Attach the AWS managed policy: ReadOnlyAccess (provides read-only access across all AWS services)."* Users report being unable to locate `ReadOnlyAccess` in the IAM role-creation flow because AWS Console by default filters policies poorly. Add a hint: *"If you don't see ReadOnlyAccess, change the filter to 'AWS managed - job function'."*
5. **Test Connection — missing success feedback** — The "Test Connection" button (`Zap` icon) on the integration card at `integration-card.tsx:243` calls `onTest`. When the test succeeds, no feedback is shown to the user: the inline success banner exists only inside `connection-modal.tsx` (`testState === 'success'`, line 391), but the test button on the card does not open that modal. Net result: user clicks, hears nothing, assumes broken. Need a toast (or compact alert) confirming success — and error — after card-level test runs.
6. **Reconfigure (gear) button on OAuth integrations is a confusing no-op** — For GitHub (and all Composio OAuth integrations: Slack, Jira, Linear, Sentry, etc.) the gear button calls `onReconfigure`, which triggers the Composio OAuth authorize flow. The user is bounced to Composio, then back to the dashboard, with no visible change to their integration. For credential-based integrations (AWS, Postgres, Webhooks) the same button correctly re-opens the credentials form. **Fix (Option B):** relabel the button to "Reauthorize" when `authType === 'oauth'` (keep "Reconfigure" for credential), change its icon to `RefreshCw` (or similar re-auth metaphor), add a tooltip "Refresh OAuth permissions — use this if scopes or access have changed". The button stays functional for the rare case of scope upgrades. Credential integrations keep the current `Settings` gear icon and "Reconfigure" label.

**Sprint 3 — Overview branching bug:**
7. **`/dashboard` stays stuck on Branch A even with integrations connected** — `dashboard-overview.tsx:112-116` treats the `/api/integrations` response as a raw array, but the handler at `integrations-handler.ts:13-21` returns `{ integrations: [...] }`. `Array.isArray(responseObject)` is always `false`, so `integrationCount` stays `0` regardless of reality. `hasIntegrations` is always `false`, `selectEmptyStateBranch` always returns `'A'`, and users with real integrations never see Branch B or Branch C. This is the root cause of "still showing we need to connect integrations" despite having integrations connected. Fix: extract `.integrations` from the JSON response, with a fallback for the legacy raw-array shape (the handler also has a raw-array branch at line 17-19). Add a unit test covering both response shapes. Add a Playwright test that stubs `/api/integrations` with a 2-item array and asserts Branch B renders.

## 2. Why now

Visual polish issues on auth, onboarding, and integration-setup screens are the **first** thing every new user sees. They directly impact trust and conversion. The AWS setup hint specifically fixes a documented friction point where new users abandon the AWS connect flow because they can't find the policy.

## 3. Scope

### In scope (Sprint 1 — Clerk + confetti)
- Add light-mode CSS rules to `clerk-overrides.css` for the Clerk MembersPage invite UI: container surface, input field, label, button — all using CauseFlow tokens (`hsl(var(--card))`, `hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--border))`, `hsl(var(--primary))`).
- Investigate the actual Clerk OTP DOM via Playwright snapshot, identify the correct selector, update `clerk-overrides.css` so OTP digits are centered horizontally inside each input box. Verify in both light and dark mode.
- Rewrite `signUpConfetti()` in `apps/dashboard/src/contexts/shared/lib/confetti.ts` to fire two side cannons with CauseFlow light green (`#10D9A3`) and purple (`#A855F7`) hex colors. No stars — `shapes: ['circle', 'square']`. Trigger origins: `{ x: 0, y: 0.7 }` and `{ x: 1, y: 0.7 }` with angles 60° (left) and 120° (right).
- Audit the onboarding orchestrator (`onboarding-orchestrator.tsx` and any wizard steps) to confirm `signUpConfetti()` is invoked **only on the final tutorial step's completion** — not on sign-up redirect, not on plan-select, not on profile-complete. If it currently fires at the wrong moment, move it.
- Visual verification via Playwright MCP screenshots for all three: Clerk invite modal (light + dark), OTP screen (light + dark), confetti playback recording (or final-frame screenshot).

### In scope (Sprint 3 — Overview branching bug)
- Fix `dashboard-overview.tsx` integration count extraction to handle the wrapped `{ integrations: [...] }` response shape. Keep backward-compat for raw-array responses (the handler has that fallback).
- Add unit tests that mock `fetch('/api/integrations')` with both response shapes and assert `integrationCount` is populated correctly.
- Add / update a Playwright test (`tests/dashboard/dashboard-overview.spec.ts` already exists per git status) with an intercept that returns a 2-item integration list and asserts `[data-testid="branch-b-empty-state"]` is visible (not Branch A).
- Document the actual response shape contract in a code comment on the handler.
- **NOT changing branch logic itself** — just fixing the broken input. Option X (leave Relay out of branching) per user pick pending confirmation.

### In scope (Sprint 2 — Integrations fixes)
- Update `integrations/infrastructure/i18n/en.json` key `guides.cloudwatch.steps.5` to add the filter hint. Update `pt-br.json` mirror. The new step text: *"Attach the AWS managed policy **ReadOnlyAccess** (provides read-only access across all AWS services). **If you don't see it in the list, change the filter to 'AWS managed - job function'.**"* (tweak wording as needed; keep the filter hint explicit).
- Add a toast/alert for card-level "Test Connection" results. Approach: extend `onTest` handler in `integrations-client.tsx` (the parent that wires `onTest` into each `IntegrationCard`) to show a toast on success AND error. Use the existing toast system (`@causeflow/ui` likely re-exports `sonner` or a similar primitive — confirm during the sprint; if none exists, use a lightweight inline alert state with auto-dismiss).
- In `integration-card.tsx`, relabel the reconfigure button based on `authType`: for `'oauth'` use label "Reauthorize" + a re-auth icon (e.g. `RefreshCw` from lucide-react) + tooltip "Refresh OAuth permissions"; for `'credential'` keep the current `Settings` gear icon and "Reconfigure" label. The underlying `onReconfigure` handler is unchanged.
- Add i18n keys `card.reauthorizeButton` and `card.reauthorizeTooltip` alongside existing reconfigure keys.
- E2E or manual verification: test connection toast visible on card click, AWS setup guide shows the filter hint, GitHub card shows "Reauthorize" button (not gear), AWS card shows "Reconfigure" gear button unchanged.

### Out of scope
- Any other Clerk UI element (sign-in, sign-up, password reset) unless the same selectors collide. Document if so but do not over-fix.
- Restyling the entire `clerk-overrides.css` file. Only target the broken areas.
- Replacing `canvas-confetti` with another library.
- Changing `planSelectConfetti()` or `analysisCompleteConfetti()` — those are separate flows.
- Refactoring the Test Connection server-side logic. Just the UI feedback layer.
- Changing what `onReconfigure` actually does under the hood for OAuth integrations — it still triggers Composio OAuth. We only change the label/icon/tooltip (user picked Option B).
- Rewriting the AWS setup guide beyond the single step 5 hint.

## 4. Audience & Verification (Correctness Discovery — Standard)

1. **Audience:** Every new user signing up. The decision they make: "Does this product feel professional enough to trust with my incident data?"
2. **Verification:** Playwright MCP visual snapshots in both light and dark mode for the Clerk surfaces; manual playback of the onboarding tutorial confetti; comparison against CauseFlow brand colors.

## 5. Acceptance Criteria

### Sprint 1
- [ ] Clerk invite modal on `/dashboard/team#/organization-members` shows: container with `hsl(var(--card))` background, input with `hsl(var(--background))` background, foreground text using `hsl(var(--foreground))`, in BOTH light and dark mode.
- [ ] Clerk OTP digits on `/auth/verify-email` are visually centered inside each input box, in BOTH light and dark mode. Confirmed by Playwright snapshot.
- [ ] `signUpConfetti()` fires two side cannons, no stars, only the two CauseFlow colors (`#10D9A3` light green + `#A855F7` purple).
- [ ] `signUpConfetti()` is invoked **exactly once**, at the end of the onboarding tutorial wizard (last step completion), and NOT at any other entry point. Verified by `grep -rn 'signUpConfetti' apps/dashboard/src`.
- [ ] No regression on `planSelectConfetti()` or `analysisCompleteConfetti()`.

### Sprint 3
- [ ] `dashboard-overview.tsx` correctly extracts `.integrations` from the wrapped response
- [ ] With 2 integrations connected (and no analyses), user lands on Branch B ("Run your first analysis")
- [ ] Unit test covers both wrapped and raw-array response shapes
- [ ] Playwright test with mocked `/api/integrations` returning 2 items asserts Branch B renders
- [ ] Regression: user with no integrations still lands on Branch A
- [ ] Regression: user with analyses still lands on Branch C and sees all 7 sections

### Sprint 2
- [ ] `guides.cloudwatch.steps.5` in en.json and pt-br.json contains the "AWS managed - job function" filter hint.
- [ ] Clicking "Test Connection" on a connected integration card triggers a visible toast/alert: green success or red error, within 5s of click, auto-dismisses.
- [ ] Toast appears for both success and error paths (verified with at least one forced error via network throttling or bad credentials).
- [ ] GitHub (and any OAuth) integration card: button labeled "Reauthorize" with a re-auth icon and tooltip "Refresh OAuth permissions". Clicking it still invokes the Composio OAuth flow.
- [ ] AWS (and any credential) integration card: button labeled "Reconfigure" with the `Settings` gear icon, unchanged from today.
- [ ] i18n keys `card.reauthorizeButton` / `card.reauthorizeTooltip` added to en.json and pt-br.json.
- [ ] No hardcoded strings introduced — all UI text uses `useTranslations`; new i18n keys mirrored in en.json and pt-br.json.

### Global
- [ ] `pnpm turbo build` — green
- [ ] `pnpm exec biome check .` — green
- [ ] `pnpm turbo check-types` — green
- [ ] `pnpm turbo test` — green
- [ ] Dev server smoke: visit Clerk members invite modal, verify-email, complete onboarding tutorial, integrations page (test AWS connect flow hint visibility, test connection toast, GitHub card) — all visually correct
- [ ] Screenshots saved to `./screenshots/2026-04-07_1838-ui-polish/` for before/after comparison

## 6. Sprint Plan

Three sprints, all can run in parallel (no file overlap):
- `01-ui-polish-fixes.md` — Clerk overrides + confetti
- `02-integrations-fixes.md` — AWS hint + Test Connection toast + hide OAuth reconfigure button
- `03-overview-branching-bug.md` — Fix integration count extraction in dashboard-overview

## 7. Risks & Mitigations

- **Risk:** Clerk DOM selector changes between Clerk SDK versions, breaking our overrides. **Mitigation:** Use `browser_snapshot` to grab the current DOM during the sprint; document the Clerk version used in a code comment near the override.
- **Risk:** Confetti trigger is wired in multiple places and we miss one. **Mitigation:** Grep step is part of acceptance.
- **Risk:** Brand color hexes don't match what design intends. **Mitigation:** Hexes are derived from `packages/ui/src/themes/original/tokens/light.css` (chart-4 purple, success emerald lifted to `#10D9A3` for visibility). User confirmed "use CauseFlow brand colors" — these are the closest hex equivalents. If they don't match, easy to swap.
- **Risk:** No existing toast primitive in `@causeflow/ui`. **Mitigation:** Sprint 2 first task is to check for one; if absent, use a controlled inline alert banner at the top of the integrations page that auto-dismisses after 4s. Do NOT pull in a new dependency without escalation.
- **Risk:** "Reauthorize" label confuses users who aren't sure when to click it. **Mitigation:** Tooltip explicitly states the purpose ("Refresh OAuth permissions — use this if scopes or access have changed"). Icon change signals that this is a distinct action from "settings".
- **Risk:** The AWS setup hint text wording conflicts with actual AWS Console UI (AWS Console changes over time). **Mitigation:** "AWS managed - job function" is a stable AWS IAM concept; verify text against current AWS Console during dev-server smoke check before committing.

## 8. Files Touched (estimated)

**Sprint 1:**
- `apps/dashboard/src/styles/clerk-overrides.css` (or wherever it lives — find via glob)
- `apps/dashboard/src/contexts/shared/lib/confetti.ts`
- `apps/dashboard/src/contexts/onboarding/presentation/components/*.tsx` (one file, audit which)

**Sprint 2:**
- `apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json`
- `apps/dashboard/src/contexts/integrations/infrastructure/i18n/pt-br.json`
- `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
- `apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx` (for Test Connection toast wiring)

**Sprint 3:**
- `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx`
- `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.test.tsx` (create if absent)
- `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` (add contract comment only, no logic change)
- `tests/dashboard/dashboard-overview.spec.ts` (already in git status as untracked — extend it)

Estimated: ~11 files total.

## 9. Verification Plan

1. `pnpm exec biome check .` — green
2. `pnpm turbo check-types` — green
3. `pnpm turbo build` — green
4. Dev server: navigate to each affected screen via Playwright MCP, snapshot, compare
5. Save screenshots to `./screenshots/2026-04-07_1838-ui-polish/{before,after}/`
6. Kill all next/playwright processes when done
