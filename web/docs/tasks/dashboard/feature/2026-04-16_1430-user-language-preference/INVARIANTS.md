# INVARIANTS — User Language Preference

Machine-verifiable contracts for cross-cutting concepts introduced or touched by this PRD.
The `check-invariants.sh` PostToolUse hook walks from an edited file up to the project root.

---

## Locale Enum

- **Owner:** Core module `user` — canonical source is the ElectroDB schema at `/root/projects/causeflow/core/src/shared/infra/db/entities/UserSettingsEntity.ts` and the Zod validator in `/root/projects/causeflow/core/src/modules/user/infra/user.routes.ts` (`updateSettingsSchema`).
- **Preconditions:** Any consumer (dashboard, E2E tests, future mobile clients) MUST constrain the locale input to the union `'en' | 'pt-br'` at compile time AND validate at the request boundary.
- **Postconditions:** Core persists only these two values; a request with any other value returns HTTP 400.
- **Invariants:** The enum is defined in exactly one place per codebase (core Zod, dashboard TS type). Changing one without the other is a contract break.
- **Verify:** `bash -c "grep -rn \"'en', 'pt-br'\" /root/projects/causeflow/core/src /root/projects/causeflow/web/apps/dashboard/src | grep -v node_modules | grep -v '\\.test\\.' | awk -F: '{print \$1}' | sort -u | wc -l | awk '{exit (\$1 >= 2 ? 0 : 1)}'"`
- **Fix:** If the grep finds divergent values (e.g. `'en', 'pt-BR'` with capital BR, or a third locale), align both repos to the canonical `'en' | 'pt-br'` — or write a deliberate PRD to expand the enum in lock-step.

---

## Language Cookie Name

- **Owner:** Dashboard middleware at `/root/projects/causeflow/web/apps/dashboard/src/middleware.ts` (lines 11-12).
- **Preconditions:** Any code that reads or writes the locale cookie MUST use the exact cookie name `NEXT_LOCALE`; inventing a second cookie name is forbidden.
- **Postconditions:** Cookie has `Path=/`, `SameSite=Lax`, `Max-Age=31536000` (365 days); `Secure` is set when the response is over HTTPS. Cookie is NOT `HttpOnly` (next-intl reads it client-side).
- **Invariants:** Exactly one cookie name in play across dashboard code. No renames without a coordinated migration (invalidates existing users' preferences).
- **Verify:** `bash -c "grep -rn 'NEXT_LOCALE' /root/projects/causeflow/web/apps/dashboard/src | grep -v node_modules | wc -l | awk '{exit (\$1 >= 1 ? 0 : 1)}'"`
- **Fix:** If a second cookie name appears (e.g. `locale` or `cf_locale`), replace with `NEXT_LOCALE`. If a rename is intentional, write a migration PRD that updates middleware + all readers + sets both cookies temporarily.

---

## `/api/settings` Routing Rule

- **Owner:** Dashboard settings handler at `/root/projects/causeflow/web/apps/dashboard/src/contexts/settings/api/settings-handler.ts`.
- **Preconditions:** Any field added to `updateSettingsSchema` in the future MUST be explicitly classified as user-scoped (→ `HttpApiClient.updateUserSettings`) or tenant-scoped (→ `HttpApiClient.updateTenant`) before merge.
- **Postconditions:** `locale`, `theme`, `notifications` always route to the user-settings endpoint. `companyName`, `name` (as company display name), `websiteUrl` always route to the tenant endpoint. A single request body may contain both kinds — each field goes to its designated endpoint.
- **Invariants:** No field is silently dropped. No field is routed to both endpoints.
- **Verify:** The unit test file `settings-handler.test.ts` (added in Sprint 3) asserts routing for each field. Command: `bash -c "cd /root/projects/causeflow/web && pnpm vitest run apps/dashboard/src/contexts/settings/api/settings-handler.test.ts --reporter=dot"`
- **Fix:** If the test fails, inspect the handler and restore the routing split. Never merge a change that breaks the routing test.

---

## Locale Sync Sentinel Cookie

- **Owner:** Dashboard authenticated layout sync at `/root/projects/causeflow/web/apps/dashboard/src/contexts/identity/application/sync-locale-from-server.ts` (added in Sprint 5).
- **Preconditions:** Sentinel cookie value is bound to the current Clerk session id; any component that inspects it must treat "sentinel != currentSessionId" as "sync has not run for this session."
- **Postconditions:** Sync runs at most once per Clerk session. After a successful sync, the sentinel equals the Clerk session id.
- **Invariants:** The sentinel is written AFTER any locale cookie overwrite (no redirect loop). The sentinel expires with the same max-age as `NEXT_LOCALE`.
- **Verify:** The Vitest unit test for `sync-locale-from-server.ts` asserts the write order. Command: `bash -c "cd /root/projects/causeflow/web && pnpm vitest run apps/dashboard/src/contexts/identity/application/sync-locale-from-server.test.ts --reporter=dot"` (test added in Sprint 5).
- **Fix:** If the sync runs more than once per session (observed via logs), verify that the sentinel is set on every path through the function (success, failure, and no-op) — not just the success path.

---

**Dependency direction:** Dashboard → Core (dashboard consumes core's locale enum). Dashboard owns its own cookie mechanics (`NEXT_LOCALE`, sync sentinel) and handler routing; core has no opinion on those.
