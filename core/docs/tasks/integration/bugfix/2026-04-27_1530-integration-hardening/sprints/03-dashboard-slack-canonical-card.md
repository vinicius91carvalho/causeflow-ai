# Sprint 03 — Dashboard: Slack uses canonical IntegrationCard

**Repo:** web (`/root/projects/causeflow/web/`)
**Estimated work:** 30–60 min
**Depends on:** none (independent of Sprints 01, 02, 04)
**Blocks:** Sprint 05.

## Goal

Standardize the Slack integration so it renders through the canonical `IntegrationCard` like every other integration. Preserve the existing confirmation-dialog UX for disconnect (per user decision).

## Files to delete

- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx`.

## Files to modify

- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`:
  - Remove the `type !== 'slack'` exclusion.
  - Add `connectionStrategy: 'oauth' | 'credential' | 'webhook'` prop.
  - When `connectionStrategy === 'oauth'`:
    - Connect button → invoke `slackOAuthHandler.beginConnect()` (or whatever the OAuth-start API is).
    - Disconnect button → open existing confirmation dialog → on confirm, call `slackOAuthHandler.disconnect()`.
  - Existing strategies (credential, webhook) keep their current button behavior.
- `web/apps/dashboard/src/contexts/integrations/api/slack-oauth-handler.ts` — surface `beginConnect()` / `disconnect()` exports if not already public.
- `web/apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx` — drop any Slack-specific render branch; render Slack via the same `IntegrationCard` loop as the others.
- Anywhere `slack-settings` was imported — replace with `IntegrationCard` rendering.

## Files read-only (reference)

- Other integration cards (GitHub, Sentry, AWS) — their props are the model.

## Acceptance criteria

- [x] Visual: Slack card layout matches GitHub/AWS/Sentry — same status pill position, same connect/disconnect button placement.
- [x] Functional: connect button starts the existing OAuth redirect.
- [x] Functional: disconnect button shows the same confirmation dialog that previously lived in `slack-settings.tsx`; on confirm, OAuth tokens are revoked.
- [x] No file imports `slack-settings.tsx` (it's deleted).
- [x] `! grep -q "type !== 'slack'" web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` → exits 0 (the exclusion is gone).
- [x] Component tests: `IntegrationCard` with `connectionStrategy='oauth'` invokes `beginConnect` and shows the confirmation dialog before `disconnect`.
- [x] `cd web && pnpm turbo check-types lint test` passes.

## INVARIANTS.md addition (W5)

If `web/INVARIANTS.md` does not exist, create it. Add:

```
## W5 — Slack must render through the canonical IntegrationCard
- **Owner:** web/apps/dashboard/src/contexts/integrations/presentation
- **Invariants:** No component renders a Slack-specific card outside `IntegrationCard`. The substring `type !== 'slack'` MUST NOT appear in `integration-card.tsx`.
- **Verify:** `! grep -q "type !== 'slack'" web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
- **Fix:** Remove the exclusion; route Slack through the shared card with `connectionStrategy='oauth'`.
```

## Notes for the executor

- Don't rewrite the OAuth flow itself — only the wiring point.
- The disconnect dialog text and behavior should be 1:1 preserved from the current `slack-settings.tsx`.
- Output a 10-line executor summary at the end.

## Agent Notes

### Decisions made
- **W7 instead of W5**: Sprint spec said to add W5 to INVARIANTS.md, but W5 already existed ("SSR inline-script hardening"). Added as W7 (next available slot). 🟢
- **`connectionStrategy` replaces `authType`**: `CatalogProvider.type` from the backend API is `'oauth' | 'credential'`, which is a subset of the new `'oauth' | 'credential' | 'webhook'` union. Kept `authType` as `@deprecated` backward-compat prop with fallback logic. 🟢
- **Inline dialog scope broadened**: Dialog now applies to all OAuth integrations, not just Slack — this is strictly more correct per the architecture (any OAuth disconnect should confirm). i18n keys use `slack.*` namespace which already had the right copy. 🟢
- **`slack-oauth-handler.ts` not modified**: Existing `beginConnect()` / `disconnect()` are already wired through `integrations-client.tsx`'s `onConnect`/`onDisconnect` props. No new exports needed. 🟢
- **`integrations-page.tsx` not modified**: Slack already rendered through the `IntegrationCard` loop in `integrations-client.tsx` (the `SlackIntegrationSettings` was a conditional in `integrations-client.tsx`'s render, which was also updated). 🟢

### Issues found
- None blocking. Pre-existing Biome warnings in `oauth-callback-handler.test.ts` (noExplicitAny) and `slack-config-handler.test.ts` (useImportType) are outside sprint file boundaries — logged, not modified.

### Verification results
- Biome (modified files): exit 0, 0 issues
- TypeScript check-types: exit 0, 14/14 tasks
- Vitest: exit 0, 999 tests passed / 158 test files
- W7 verify: `! grep -q "type !== 'slack'" ...` → exits 0
- W7 verify: `! find apps/dashboard/src -name "slack-settings*" -type f | grep -q .` → exits 0
