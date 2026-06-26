# Sprint 02 — Stale-investigation Safety Net (web)

**Repo:** `web/`
**Size:** S (30–45 min)
**Depends on:** —
**Parent PRD:** `../spec.md`

---

## Goal

Add an informational client-side warning that surfaces when an incident has been in `triaging` or `investigating` for more than 60 seconds **and** has had no new feed evidence in the last 30 seconds. The warning is a one-liner under the existing spinner. No CTA. No new network calls. No status mutation.

This is a defence-in-depth net: Sprint 1 fixes the specific known bug, but anything that *could* cause an incident to sit forever in a transitional state (network partition, a future bug of the same shape, a slow worker) should still surface to the user instead of looking like an active investigation.

---

## File Boundaries

### files_to_modify
- `web/apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/root-cause-card.tsx`

### files_to_create
- `web/apps/dashboard/src/contexts/investigation/presentation/lib/is-stale-investigation.ts`
- `web/apps/dashboard/src/contexts/investigation/presentation/lib/__tests__/is-stale-investigation.test.ts`

### files_read_only
- `web/apps/dashboard/src/contexts/investigation/domain/types.ts` — `Incident` type, especially `status`, `updatedAt`, `evidenceByAgent`
- `web/apps/dashboard/src/contexts/investigation/presentation/hooks/use-investigation-feed.ts` — to understand the feed shape passed in
- `web/apps/dashboard/src/contexts/investigation/presentation/lib/group-feed-items.ts` — to confirm the evidence-timestamp field name
- `web/apps/dashboard/messages/en.json` and `messages/pt-BR.json` (for the `next-intl` key — read existing keys to mirror the namespace)

### shared_contracts
- **`Incident` type fields** consumed read-only: `status`, `updatedAt`, plus a way to derive "newest evidence timestamp." If the existing `Incident` does not expose feed timestamps directly, derive from the props the parent component already passes to `RootCauseCard` (do NOT add new props that bubble up from the API layer; if a derivation requires data not currently in scope, accept the `incident.updatedAt` alone as a proxy and document the limitation in a one-line code comment — no comment otherwise).
- **`next-intl` keys** added under the `incidentDetail.rootCause` namespace (mirror existing keys like `rootCauseInvestigating`).

---

## Acceptance Criteria

1. **Pure helper** `isStaleInvestigation({ status, updatedAt, latestEvidenceAt, now })` returns `true` iff:
   - `status` ∈ `{'triaging', 'investigating'}`, **and**
   - `now - updatedAt >= 60_000 ms`, **and**
   - `now - latestEvidenceAt >= 30_000 ms` (or `latestEvidenceAt` is absent and `now - updatedAt >= 60_000 ms`).
   - Else `false`.
2. **Vitest cases** in `is-stale-investigation.test.ts` cover:
   - Status `resolved` → always `false`.
   - Status `triaging`, fresh `updatedAt` (<60s) → `false`.
   - Status `triaging`, stale `updatedAt` (>60s), recent evidence (<30s) → `false`.
   - Status `triaging`, stale `updatedAt`, stale latest evidence → `true`.
   - Status `investigating`, stale `updatedAt`, no evidence at all → `true`.
   - Boundary at exactly 60s and 30s — must use `>=`.
3. **`RootCauseCard`**: when `!hasRootCause && isInvestigating && isStaleInvestigation(...)`, render a small subordinate paragraph **inside** the existing spinner banner (NOT a separate card). Text comes from `t('rootCauseSlowHint')` (or equivalent existing-namespace key). The spinner stays. No retry button. No icon other than what already lives in the banner.
4. **i18n:** add `rootCauseSlowHint` (or equivalent) keys to both `en.json` and `pt-BR.json` mirror files. EN: "Investigation is taking longer than expected." pt-BR: "A investigação está demorando mais do que o esperado."
5. The component does **not** poll, fetch, dispatch a redux action, mutate state, or schedule a side effect. It re-renders on the parent's existing 5-second poll and uses `Date.now()` (passed via prop or derived inside) to compute staleness.
6. Existing tests for `RootCauseCard` (if any — check the colocated `__tests__` directory; if absent, none to fix) stay green.
7. `pnpm check` (Biome) clean. `pnpm test` clean.

---

## TDD Plan

1. **Red:** Write `is-stale-investigation.test.ts` with all six cases above. They fail because the helper does not exist.
2. **Green:** Implement `is-stale-investigation.ts` as a pure function. Re-run; all pass.
3. **Wire-up:** Modify `root-cause-card.tsx` to call the helper inside the existing `isInvestigating && !hasRootCause` branch, conditionally render the hint paragraph. Add the i18n keys.
4. **Manual check:** With `pnpm dev` running, visit a fixture incident in `triaging` (mock `updatedAt` to 70 s ago) and confirm the hint shows. Confirm it does NOT show for a freshly-`triaging` incident.
5. **Regress:** Re-run `pnpm test` and `pnpm check`.

---

## Implementation Notes

- **Do not poll a clock state.** `Date.now()` evaluated once per render is sufficient; the parent re-renders every ~5s already. No `setInterval`/`setTimeout`/`useEffect` needed.
- **Latest evidence timestamp:** if the parent component receives `feedItems`, prefer `feedItems[0]?.timestamp` (or the field name confirmed from `group-feed-items.ts`) as `latestEvidenceAt`. If only `incident.updatedAt` is reliably available in `RootCauseCard`'s prop scope, fall back to `incident.updatedAt` alone — the helper accepts an optional `latestEvidenceAt`. Don't widen the prop interface unnecessarily.
- **Mobile-first reminder** (`~/.claude/rules/web.md`): the hint paragraph must wrap cleanly at <640 px. Use Tailwind `text-sm` and the same prose colour the existing banner uses; do not introduce a new colour token.
- **No new icons.** The Lucide spinner already lives in the banner.

---

## Rollback Plan

This sprint is additive frontend-only with no API contract or state mutation. To roll back: revert the three files. No data state to clean up.

---

## Out of Scope

- Any backend status mutation triggered by staleness (PRD §6 A3 — we explicitly chose not to do this).
- Auto-marking an incident `inconclusive` from the client (rejected per A3).
- A retry button or "force resolve" CTA.
- Changing the spinner's design/copy itself.
- Plumbing a stale-incident metric to telemetry — out of scope; if needed, future work.

---

## Done Definition

- [x] Helper + tests in place; all cases green.
- [x] `RootCauseCard` renders the hint when stale, hides it otherwise.
- [x] i18n keys added in both locales.
- [x] `pnpm test`, `pnpm check` green.
- [ ] Manual browser check at <640 px and at desktop width per `~/.claude/rules/web.md`.
- [ ] Code review passed.
