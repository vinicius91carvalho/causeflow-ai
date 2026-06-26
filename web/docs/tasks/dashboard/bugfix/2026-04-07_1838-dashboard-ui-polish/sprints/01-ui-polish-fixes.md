# Sprint 01 — Dashboard UI Polish (3 fixes)

**Depends on:** none
**Blocks:** none
**Est. effort:** 60-90 min

## Goal
Three independent UI fixes in one sprint:
1. Clerk invite member modal colors (light mode missing)
2. Clerk OTP input centering (selector mismatch)
3. End-of-tutorial confetti rewrite (two side cannons, brand colors, no stars)

## File Boundaries
- **Create:** none
- **Modify:**
  - `apps/dashboard/src/styles/clerk-overrides.css` (verify path with glob — could be elsewhere; search `clerk-overrides.css`)
  - `apps/dashboard/src/contexts/shared/lib/confetti.ts`
  - One onboarding tutorial component file (TBD by audit — search for `signUpConfetti` call site)
- **Read-only:**
  - `packages/ui/src/themes/original/tokens/light.css`
  - `packages/ui/src/themes/original/tokens/dark.css`
  - `apps/dashboard/src/contexts/onboarding/presentation/components/*.tsx`

## Tasks

### Fix 1 — Clerk invite modal colors
1. Glob for `clerk-overrides.css` to confirm path.
2. Read it. Note existing dark-mode-only rules (`html.dark .cl-...`).
3. Open `/dashboard/team#/organization-members` via Playwright MCP (`browser_navigate`, `browser_snapshot`) in **light mode** to inspect the Clerk DOM. Identify the actual class names for:
   - The invite container/card surface
   - The email input field
   - The "Send invitation" button
4. Add **light-mode** CSS rules (no `html.dark` prefix) targeting those classes:
   ```css
   .cl-membersPageInviteButton,
   .cl-organizationMembers__invitationsList { background-color: hsl(var(--card)) !important; }
   .cl-formFieldInput { background-color: hsl(var(--background)) !important; color: hsl(var(--foreground)) !important; border-color: hsl(var(--border)) !important; }
   .cl-formFieldLabel { color: hsl(var(--foreground)) !important; }
   ```
   (Use the actual class names from the snapshot — these are illustrative.)
5. Re-snapshot to verify.
6. Snapshot in dark mode to confirm no regression.

### Fix 2 — Clerk OTP centering
1. Open `/auth/verify-email` via Playwright MCP (you'll need a verification flow trigger; if hard to reach, mock by navigating to a page that renders the Clerk verify component, or use a screenshot from the existing flow).
2. Snapshot the OTP input. Identify the actual class on the digit `<input>` elements (likely `.cl-otpCodeFieldInput` or `.cl-formFieldInput.cl-otpCodeInput` — confirm).
3. Read the existing `text-align: center` block in `clerk-overrides.css`. If the selector is wrong, fix it. Add `!important` if specificity is fighting. Ensure the rule applies regardless of `html.dark`.
4. Re-snapshot to verify digits are centered.

### Fix 3 — End-of-tutorial confetti
1. `grep -rn 'signUpConfetti' apps/dashboard/src` — list every call site.
2. Audit each call site: it should be in the onboarding tutorial wizard's **final step** completion handler. If it's anywhere else (sign-up page, plan-select, profile-complete), **remove** it from those locations.
3. Rewrite `signUpConfetti()` in `confetti.ts` to:
   ```ts
   export function signUpConfetti() {
     const colors = ['#10D9A3', '#A855F7']; // CauseFlow light green + purple
     const defaults = {
       particleCount: 60,
       spread: 55,
       startVelocity: 55,
       ticks: 200,
       shapes: ['circle', 'square'] as const,
       colors,
     };
     // Left cannon — fires from bottom-left, angled up-right
     confetti({ ...defaults, angle: 60, origin: { x: 0, y: 0.7 } });
     // Right cannon — fires from bottom-right, angled up-left
     confetti({ ...defaults, angle: 120, origin: { x: 1, y: 0.7 } });
   }
   ```
4. Verify `grep -rn 'signUpConfetti(' apps/dashboard/src | wc -l` returns exactly **2** (definition + single call site).
5. Run the dev server, complete the tutorial, watch the confetti play. (Or invoke directly from browser console: `window.testConfetti?.()` if there's a debug hook; otherwise complete the flow manually.)

## Acceptance Criteria
- [ ] Clerk invite modal in light mode: container is CauseFlow card surface, input is CauseFlow background surface, text is CauseFlow foreground (verified via Playwright snapshot)
- [ ] Clerk invite modal in dark mode: still correct (no regression)
- [ ] Clerk OTP digits visually centered inside each input box (verified via Playwright snapshot)
- [ ] `signUpConfetti()` rewritten with two side cannons, only `#10D9A3` and `#A855F7`, no stars
- [ ] Exactly one call site for `signUpConfetti()` outside `confetti.ts`, in the tutorial wizard final step
- [ ] `pnpm exec biome check .` — green
- [ ] `pnpm turbo check-types` — green
- [ ] `pnpm turbo build` — green
- [ ] Screenshots saved to `./screenshots/2026-04-07_1838-ui-polish/`
- [ ] All next/playwright processes killed at end

## Return Summary
- Files modified with line counts
- Clerk class names found from snapshot (so future Clerk SDK upgrades can re-verify)
- All call sites of `signUpConfetti` before and after
- Screenshot paths
- Build/lint/types output
