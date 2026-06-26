# Sprint 4 — Page, Middleware Guard, Checkout Redirect

**PRD:** `../spec.md`
**Batch:** 3
**Depends on:** Sprint 2 (API routes), Sprint 3 (renderer)
**Model:** sonnet

> **⚠ Parallel PRD coordination (see spec.md §12):** Another terminal is applying a separate PRD concurrently. This sprint touches `src/middleware.ts` and `src/contexts/billing/api/checkout-handler.ts` — both are high-conflict-risk files. Before starting: `git pull --rebase origin main` and re-read the current contents of those two files. If a merge conflict appears, resolve manually — do NOT auto-resolve or `--theirs`/`--ours` blindly.

## Objective

Wire the renderer into a real `/onboarding/business-profile` page, enforce it via middleware, redirect the Stripe checkout success flow there instead of straight to `/dashboard`, **and reconcile the parallel-safe stubs left by Sprint 2** (replace `buildMarkdownStub` with the real `generateBusinessProfileMarkdown` + `resolveLocalizedSchema` from Sprint 1).

## Tasks

1. Create `contexts/onboarding/presentation/pages/business-profile-page.tsx` (client component):
   - Accepts `locale: 'en' | 'pt-br'` as a prop (passed in by the server-component route wrapper that reads next-intl's request locale)
   - Fetches `GET /api/onboarding/business-profile/schema` on mount
   - Fetches `GET /api/onboarding/business-profile` to detect existing draft/submission (pre-fill if present)
   - Renders `<Wizard schema={schema} locale={locale} ... />` from Sprint 3
   - `onSubmit(answers, locale)` → `POST /api/onboarding/business-profile` with body `{ schemaVersion, answers, locale }` → on success, clear draft + `router.replace('/dashboard?welcome=1')`; on Hindsight failure, show toast but still proceed
   - `onSkip` → `POST /api/onboarding/business-profile/skip` → `router.replace('/dashboard')`
   - Shows `CauseFlowLoader` while schema loads; error state if schema fetch fails
1b. **Reconcile Sprint 2 stubs in `contexts/onboarding/api/business-profile-handler.ts`:**
   - Replace `buildMarkdownStub(answers)` with a real call:
     ```ts
     const schema = getActiveSchema();
     const resolvedLocale = body.locale ?? readRequestLocale(request) ?? schema.defaultLocale;
     const markdown = generateBusinessProfileMarkdown(schema, body.answers, {
       submittedAt: new Date().toISOString(),
       locale: resolvedLocale,
     });
     ```
   - Import `generateBusinessProfileMarkdown` from `@/contexts/onboarding/application/business-profile-markdown` and `getActiveSchema` from `@/contexts/onboarding/infrastructure/business-profile-schemas/registry`.
   - Delete the `TODO(sprint-4): replace stub ...` marker.
   - Persist `resolvedLocale` on the `BusinessProfile` record.
   - Pass `markdown` to `seedMemoryContext`.
2. Create the route at `src/app/[locale]/onboarding/business-profile/page.tsx` as a **thin server-component orchestrator** that resolves the next-intl locale and passes it down:
   ```tsx
   import { getLocale } from 'next-intl/server';
   import { BusinessProfilePage } from '@/contexts/onboarding/presentation/pages/business-profile-page';

   export const dynamic = 'force-dynamic';

   export default async function Page() {
     const locale = await getLocale(); // 'en' | 'pt-br'
     return <BusinessProfilePage locale={locale === 'pt-br' ? 'pt-br' : 'en'} />;
   }
   ```
3. Update `src/middleware.ts` — add a guard after the profile-completion check:
   - If path starts with `/dashboard` AND session exists AND tenant has a paid/trial subscription AND tenant has not submitted or skipped the business profile → redirect to `/onboarding/business-profile`
   - The business-profile page itself is allowed through
   - Use the existing edge-safe DynamoDB read pattern (or a lightweight cookie/session flag set on successful checkout; prefer reading tenantId from session and hitting a small edge-safe endpoint — **implementation detail**: mirror the existing profile-guard strategy exactly)
4. Update `contexts/billing/api/checkout-handler.ts`:
   - Change `successUrl` when `from === 'onboarding'` from `${baseUrl}/dashboard?welcome=1` to `${baseUrl}/onboarding/business-profile?welcome=1`
5. Add i18n keys under `contexts/onboarding/infrastructure/i18n/en.json` (and `pt-br.json`) for page shell copy only: `businessProfile.loadError`, `businessProfile.submitError`, `businessProfile.hindsightWarning`, `businessProfile.skipCta`. (Form field copy stays in the JSON schema.)

## Tests (Vitest)

- `business-profile-page.test.tsx`: fetches schema, renders wizard, happy-path submit calls correct endpoints in order, failure shows toast.
- `middleware.test.ts`: new guard redirects correctly; business-profile page itself is not redirected; skipped profile is treated as "done".
- `checkout-handler.test.ts`: `from=onboarding` now points at `/onboarding/business-profile?welcome=1`.

## Acceptance

- All tests green.
- Dev server starts; navigating to `/onboarding/business-profile` with a session renders the v1 wizard.
- Biome + typecheck clean.
- **Browser verification protocol (required):** start `pnpm --filter dashboard dev`, navigate to `/onboarding/business-profile` with a test session, snapshot, verify clean console + server log, save screenshots under `.artifacts/playwright/screenshots/`.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-page.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-page.test.tsx
  - apps/dashboard/src/app/[locale]/onboarding/business-profile/page.tsx

files_to_modify:
  - apps/dashboard/src/middleware.ts
  - apps/dashboard/src/middleware.test.ts
  - apps/dashboard/src/contexts/billing/api/checkout-handler.ts
  - apps/dashboard/src/contexts/billing/api/checkout-handler.test.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-handler.ts          # reconcile Sprint 2 stub → real transformer
  - apps/dashboard/src/contexts/onboarding/api/business-profile-handler.test.ts     # update test: markdown body is real, locale-aware
  - apps/dashboard/src/contexts/onboarding/infrastructure/i18n/en.json
  - apps/dashboard/src/contexts/onboarding/infrastructure/i18n/pt-br.json

files_read_only:
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.tsx
  - apps/dashboard/src/contexts/onboarding/api/business-profile-handler.ts
  - apps/dashboard/src/contexts/identity/lib/auth-edge.ts

shared_contracts:
  - BusinessProfileFormSchema (from Sprint 1)
  - API routes (from Sprint 2)
  - Wizard component (from Sprint 3)
```
