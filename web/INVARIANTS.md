# Invariants

Machine-verifiable contracts for `causeflow/web`. Cascades with `core/INVARIANTS.md` for cross-repo features. Enforced at edit-time by `~/.claude/hooks/scripts/check-invariants.sh`.

---

## W1 — Theme enum values

- **Owner:** `packages/ui` (ThemeProvider)
- **Preconditions:** any caller of `setTheme` passes one of `"light" | "dark" | "system"`.
- **Postconditions:** `document.documentElement` gets class `dark` iff theme resolves to dark; otherwise no theme class. LocalStorage key `causeflow-theme` stores the raw theme value.
- **Invariants:** only `"light" | "dark" | "system"` are ever written to localStorage or passed to `onThemeChange`. No other string may appear.
- **Verify:** `grep -rn "'light' | 'dark' | 'system'" packages/ui/src/themes/ apps/dashboard/src/ web/packages/ui/src/themes/ web/apps/dashboard/src/ 2>/dev/null | wc -l | awk '$1 > 0 {exit 0} {exit 1}'`
- **Fix:** pin the type union in `packages/ui/src/themes/provider.tsx` and import it at every call site.

## W2 — Locale enum values

- **Owner:** `apps/dashboard` (next-intl + settings context)
- **Preconditions:** only `"en" | "pt-br"` are valid locale strings in the dashboard.
- **Postconditions:** `PATCH /v1/users/:userId/settings` is called with `locale ∈ {en, pt-br}`. Router.push uses a `/pt-br/` prefix for PT and bare path for EN.
- **Invariants:** no locale string outside `{en, pt-br}` is ever stored, fetched, or written as a cookie.
- **Verify:** `grep -rEn "locale: ['\"](?!en|pt-br)" apps/dashboard/src/ | grep -v '\.test\.' && exit 1 || exit 0`
- **Fix:** add the locale to the enum everywhere or remove the reference.

## W3 — Settings row storage location

- **Owner:** `core/src/shared/infra/db/entities/UserSettingsEntity.ts` (defined in Core; consumed by Web).
- **Preconditions:** nothing in `apps/dashboard` writes directly to DynamoDB.
- **Postconditions:** all theme+locale writes go through `httpApiClient.updateUserSettings`. Row materializes at `pk: $causeflow#tenantid_<tid>`, `sk: settings#<userId>`.
- **Invariants:** dashboard code never references the User-entity sk form (`$user_1#userid_<...>`) for settings storage.
- **Verify:** `grep -rn '\$user_1#userid_' apps/dashboard/src/ && exit 1 || exit 0`
- **Fix:** use `httpApiClient.updateUserSettings` exclusively; never synthesize DynamoDB keys in the dashboard.

## W4 — Tenant isolation (IDOR)

- **Owner:** Core API (`auth.middleware.ts`). Web consumer inherits the contract.
- **Preconditions:** every settings API call from the dashboard is made with a valid Clerk session token.
- **Postconditions:** tenantId is extracted server-side from the JWT `org_id` claim; never accepted from request params/body.
- **Invariants:** no code path in `apps/dashboard/src/` sends a `tenantId` field in the body of `PATCH /v1/users/:userId/settings`.
- **Verify:** `grep -rn "updateUserSettings.*tenantId\|tenantId.*updateUserSettings" apps/dashboard/src/ && exit 1 || exit 0`
- **Fix:** remove the tenantId from the request body; the server derives it.

## W5 — SSR inline-script hardening (theme pre-hydration)

- **Owner:** `apps/dashboard/src/app/[locale]/layout.tsx`
- **Preconditions:** cookie values may be untrusted (cookies are set by middleware but could be edited by client).
- **Postconditions:** the inline script that applies the theme class reads the cookie and decides via a whitelist switch over known-good values, not string interpolation into the script body.
- **Invariants:** no template literal in the root layout injects a raw cookie value into the inline script. Accepted cookie value must match one of the theme-enum cases before it influences the DOM.
- **Verify:** `grep -En 'setInnerHTML.*\\$\\{[^}]*cookie' apps/dashboard/src/app/\\[locale\\]/layout.tsx && exit 1 || exit 0`
- **Fix:** rewrite the inline script to use a switch over `light`/`dark`/`system`; do not interpolate the cookie string into the script source.

## W6 — Default fallback must be safe

- **Owner:** Core API `get-settings.usecase.ts` and dashboard middleware.
- **Preconditions:** a user may not yet have a settings row.
- **Postconditions:** missing row → `{ theme: "system", locale: "en" }`. Never throw, never block login.
- **Invariants:** dashboard middleware never fails the request if the settings GET returns 404 — it proceeds with defaults and still sets the sentinel cookie to avoid refetch storms on the next request.
- **Verify:** manual — covered by Sprint 01 integration test and Sprint 03 E2E.
- **Fix:** ensure the middleware catch branch writes defaults and the sentinel.

## W7 — Slack must render through the canonical IntegrationCard

- **Owner:** `apps/dashboard/src/contexts/integrations/presentation` (IntegrationCard component)
- **Preconditions:** The integrations page passes all OAuth integrations (Slack, GitHub, etc.) through `IntegrationCard` with `connectionStrategy='oauth'`. No caller may bypass `IntegrationCard` to render a bespoke Slack UI.
- **Postconditions:** Slack disconnect, reconnect, and status display are handled by `IntegrationCard`'s `connectionStrategy='oauth'` branch. The OAuth disconnect dialog uses generic `disconnect.*` i18n keys parameterised with the integration's display name — no Slack-specific copy is embedded in the card.
- **Invariants:** No component renders a Slack-specific card outside `IntegrationCard`. The substring `type !== 'slack'` MUST NOT appear in `integration-card.tsx`. No file named `slack-settings*` exists under `apps/dashboard/src/`.
- **Verify:** `! grep -q "type !== 'slack'" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx && ! find apps/dashboard/src -name "slack-settings*" -type f | grep -q .`
- **Fix:** Remove any Slack-specific render branch in `apps/dashboard/src/contexts/integrations/presentation/`. Move all OAuth begin/disconnect logic into the `connectionStrategy: 'oauth'` branch of `IntegrationCard`.
