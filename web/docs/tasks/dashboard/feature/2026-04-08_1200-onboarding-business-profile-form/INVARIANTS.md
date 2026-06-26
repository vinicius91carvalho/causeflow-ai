# INVARIANTS — Onboarding Business Profile Form

Machine-verifiable contracts for every cross-cutting concept in this PRD.
The `check-invariants.sh` hook runs each `Verify` command after any file edit
under this PRD's scope.

---

## BusinessProfileFormSchema Dialect

- **Owner:** `contexts/onboarding/domain/business-profile-types.ts` (TypeScript types) + `contexts/onboarding/domain/business-profile-schema.ts` (runtime zod validator)
- **Preconditions (consumers):**
  - Any JSON file under `infrastructure/business-profile-schemas/` MUST parse via the zod validator.
  - Field `id` values MUST be unique within a single schema (including across steps).
  - `visibleWhen.fieldId` MUST reference an existing field id in the same schema.
  - Every `LocalizedString` in object form MUST contain both `en` and `pt-br` keys, both non-empty.
  - The top-level `supportedLocales` MUST be exactly `['en', 'pt-br']` (in any order) for v1.
- **Postconditions (owner):**
  - `loadSchema(version)` always returns a validated `BusinessProfileFormSchema` or throws.
  - Unknown field `type` values are rejected at load time.
  - `resolveLocalizedSchema(schema, locale)` is total — it never throws on a valid schema regardless of `locale`.
- **Invariants:**
  - `v1.json` always exists and always parses cleanly.
  - `registry.ts` `ACTIVE_VERSION` always points at an existing JSON file.
  - v1.json is fully bilingual: every `label`, `title`, `description`, `help`, `placeholder`, and option `label` resolves cleanly to both EN and PT-BR.
- **Verify:**
  ```bash
  pnpm --filter dashboard exec vitest run \
    apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/registry.test.ts \
    apps/dashboard/src/contexts/onboarding/domain/business-profile-schema.test.ts \
    apps/dashboard/src/contexts/onboarding/application/resolve-localized-schema.test.ts
  ```
- **Fix:** Repair the offending JSON file or type definition; re-run.

---

## Bilingual v1.json Completeness

- **Owner:** `contexts/onboarding/infrastructure/business-profile-schemas/v1.json`
- **Preconditions:** N/A (always-on).
- **Postconditions:** Resolving v1.json with `locale='en'` and `locale='pt-br'` both succeed and produce entirely non-empty output — no field label, title, option, or help text falls back to the other locale in the shipped v1.
- **Invariants:**
  - Grep-enforced **structural** check: every `"label"`, `"title"`, `"description"`, `"help"`, `"placeholder"`, `"subtitle"`, `"submitLabel"`, `"skipLabel"`, `"heading"` inside v1.json is either a plain string OR an object containing both `"en"` and `"pt-br"` keys. (This is validated by the zod schema; any regression immediately fails `business-profile-schema.test.ts`.)
- **Verify:**
  ```bash
  pnpm --filter dashboard exec vitest run \
    apps/dashboard/src/contexts/onboarding/domain/business-profile-schema.test.ts \
    apps/dashboard/src/contexts/onboarding/application/business-profile-markdown.test.ts
  ```
- **Fix:** Add the missing translation to v1.json. A plain-string value also satisfies the dialect when a phrase does not need translation (e.g., proper nouns, numbers).

---

## BusinessProfile Entity Key Shape

- **Owner:** `contexts/onboarding/infrastructure/business-profile-repository.ts`
- **Preconditions:** Callers pass a non-empty `tenantId` derived from an authenticated session (never from request body).
- **Postconditions:** Every persisted record uses `PK = TENANT#<tenantId>` and `SK = BUSINESS_PROFILE` — enforcing one profile per tenant.
- **Invariants:**
  - No BFF route ever reads or writes `BusinessProfile` using a tenantId sourced from the request body or query string.
  - `withAuth` wraps every business-profile BFF handler.
- **Verify:**
  ```bash
  ! grep -rn "businessProfileRepository\|business-profile-repository" \
      apps/dashboard/src/contexts/onboarding/api/ \
    | grep -v "withAuth" \
    | grep -v "business-profile-repository.ts" \
    | grep -v ".test." \
    && echo "OK"
  ```
  (Script: every file in `onboarding/api/` that imports the repository must also import `withAuth`.)
- **Fix:** Wrap the handler in `withAuth`; derive tenantId from the session context only.

---

## ICoreApiClient.seedMemoryContext Contract

- **Owner:** `lib/api/core-api-client.ts` (interface) + `lib/api/http-api-client.ts` (HTTP impl) + `lib/api/mock-api-client.ts` (mock)
- **Preconditions:** `input.markdown` is non-empty, `input.source === 'business-profile'`, `input.schemaVersion` matches a loaded schema version.
- **Postconditions:** HTTP impl sends `POST /v1/memory/chat` with body `{ message: input.markdown, metadata: { source, schemaVersion } }` and an `Authorization: Bearer <jwt>` header.
- **Invariants:**
  - Both HTTP and mock implementations implement the full `ICoreApiClient` interface (TypeScript enforces this at compile time).
  - No BFF handler constructs a Core API request directly — they always go through `getApiClient()`.
  - A `TODO(core-api-seed-endpoint)` comment exists above the `seedMemoryContext` HTTP call site in `http-api-client.ts` — it is the grep anchor for the follow-up migration to `POST /v1/memory/seed`. Removing it accidentally would orphan the follow-up work.
- **Verify:**
  ```bash
  pnpm --filter dashboard exec tsc --noEmit \
    && grep -q "TODO(core-api-seed-endpoint)" apps/dashboard/src/lib/api/http-api-client.ts \
    && echo "OK"
  ```
- **Fix:** Add the missing method to the mock or HTTP impl; ensure BFF handlers use `getApiClient()`; restore the `TODO(core-api-seed-endpoint)` comment if it was removed without also swapping the endpoint URL.

---

## Markdown Transformer Determinism & Safety

- **Owner:** `contexts/onboarding/application/business-profile-markdown.ts`
- **Preconditions:** Receives a validated `BusinessProfileFormSchema` and an `answers` record whose shape is compatible with the schema.
- **Postconditions:**
  - Output is deterministic for a given (schema, answers, meta) tuple — same input → byte-identical output.
  - Backticks, `<|`, `|>`, `role:`, `system:`, `assistant:` in free-text answers are escaped or fenced.
  - Optional unanswered fields are omitted entirely.
- **Invariants:**
  - Snapshot test `business-profile-markdown.test.ts` must pass for every change to the transformer or v1.json.
  - Adversarial-input test (answer containing `` ` `` and `system:`) must assert escaping.
- **Verify:**
  ```bash
  pnpm --filter dashboard exec vitest run \
    apps/dashboard/src/contexts/onboarding/application/business-profile-markdown.test.ts
  ```
- **Fix:** Update the snapshot only if the change is intentional and the adversarial test still passes.

---

## Middleware Guard Ordering

- **Owner:** `src/middleware.ts`
- **Preconditions:** Runs on every request. Pipeline order: staging auth → public routes → session → complete-profile → **business-profile** → locale.
- **Postconditions:**
  - A tenant without `submittedAt` or `skippedAt` on their `BusinessProfile` and with a paid/trial subscription is redirected from any `/dashboard/*` route to `/onboarding/business-profile`.
  - The business-profile page itself is NEVER redirected by this guard (would cause infinite loop).
  - `?edit=1` bypasses the already-submitted redirect.
- **Invariants:**
  - `middleware.test.ts` covers: fresh tenant → redirected; submitted tenant → not redirected; skipped tenant → not redirected; business-profile page → not redirected; `edit=1` → bypass.
- **Verify:**
  ```bash
  pnpm --filter dashboard exec vitest run apps/dashboard/src/middleware.test.ts
  ```
- **Fix:** Reorder or repair the guard; re-run the middleware test.

---

## No Sensitive Answer Logging

- **Owner:** All files under `contexts/onboarding/api/` and `contexts/onboarding/infrastructure/business-profile-repository.ts`
- **Preconditions:** N/A (always-on).
- **Postconditions:** No `console.log`, `console.error`, or logger call includes the `answers` or `markdown` fields of a BusinessProfile.
- **Invariants:**
  - Grep-enforced: the strings `answers` and `markdown` never appear inside a console/log call argument in these files.
- **Verify:**
  ```bash
  ! grep -rnE 'console\.(log|error|warn|info|debug)\([^)]*\b(answers|markdown)\b' \
      apps/dashboard/src/contexts/onboarding/api/ \
      apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-repository.ts \
    && echo "OK"
  ```
- **Fix:** Remove or redact the offending log; log only `{ tenantId, schemaVersion, submittedAt, hindsightStatus }`.
