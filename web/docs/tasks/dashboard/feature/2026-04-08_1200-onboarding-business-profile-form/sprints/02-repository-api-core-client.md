# Sprint 2 — Repository, BFF API Routes, Core API Client Extension

**PRD:** `../spec.md`
**Batch:** 1 (parallel with Sprint 1)
**Depends on:** —
**Model:** sonnet

## Objective

Persist `BusinessProfile` in DynamoDB, expose BFF routes under `/api/onboarding/business-profile/*`, and extend `ICoreApiClient` with `seedMemoryContext`. Sprint 1's domain types are NOT imported yet (to keep the sprints parallel-safe) — this sprint uses minimal local interface shims that Sprint 3/4 will reconcile.

> **Parallel-safety trick:** instead of importing types from Sprint 1, declare local structural interfaces for `answers: Record<string, unknown>`, `schemaVersion: string`, etc. Sprint 4 wires the shared types together.

## Tasks

1. Create `contexts/onboarding/infrastructure/business-profile-repository.ts`:
   - `getBusinessProfile(tenantId): Promise<BusinessProfileRecord | null>`
   - `saveBusinessProfile(tenantId, input): Promise<BusinessProfileRecord>`
   - `markSkipped(tenantId, userId): Promise<BusinessProfileRecord>`
   - `updateHindsightStatus(tenantId, status, error?): Promise<void>`
   - Uses `lib/db/client.ts` + `lib/db/base-repository.ts`
   - PK: `TENANT#<id>`, SK: `BUSINESS_PROFILE`
2. Extend `ICoreApiClient` (`lib/api/core-api-client.ts`):
   ```ts
   seedMemoryContext(input: {
     source: 'business-profile';
     schemaVersion: string;
     markdown: string;
   }): Promise<{ memoryId?: string }>;
   ```
3. Implement in `lib/api/http-api-client.ts`: POST `/v1/memory/chat` with `{ message: input.markdown, metadata: { source: input.source, schemaVersion: input.schemaVersion } }`.
   - **MUST add a `TODO(core-api-seed-endpoint)` comment directly above the fetch call** with the exact text:
     ```ts
     // TODO(core-api-seed-endpoint): Swap to POST /v1/memory/seed once the dedicated
     // seeding endpoint ships on CORE-API. Tracked in PRD §6.3 / §12 Q1. The
     // ICoreApiClient.seedMemoryContext interface will not change — only the URL
     // and request body shape here.
     ```
   - The comment is both documentation for future maintainers AND a grep anchor so we can find the call site once the CORE-API endpoint is ready.
4. Implement in `lib/api/mock-api-client.ts`: return `{ memoryId: \`mock-${randomUUID()}\` }`.
5. Create `contexts/onboarding/api/business-profile-schema-handler.ts`:
   - `GET` → reads active schema via registry, returns `{ schema }`
   - Uses `withAuth`
6. Create `contexts/onboarding/api/business-profile-handler.ts`:
   - `GET` → returns current profile or null
   - `POST` → validates body with a local zod schema (`{ schemaVersion: string, answers: Record<string, unknown>, locale?: 'en' | 'pt-br' }`), checks max 20KB, persists via repository, triggers `seedMemoryContext` (non-blocking — `Promise.allSettled`), updates `hindsightStatus` on result, returns `{ profile }`.
   - **Locale handling:** `locale` in the request body is OPTIONAL. If omitted, fall back to reading the next-intl request locale (via `NextIntl` request cookie or `Accept-Language`), then fall back to the schema's `defaultLocale`. Persist the resolved locale on the `BusinessProfile` record (add a `locale: 'en' | 'pt-br'` column to the entity — **update PRD §5 data model in a follow-up note** or simply add it to the repository record interface). The locale is passed through to `generateBusinessProfileMarkdown(schema, answers, { submittedAt, locale })` so the Markdown sent to Hindsight is in the user's language.
   - **Structural shim note:** Since Sprint 2 runs in parallel with Sprint 1, this handler cannot import Sprint 1's domain types yet. Declare local structural interfaces for the request body. Sprint 4 reconciles the imports when wiring the page to the handler and imports `generateBusinessProfileMarkdown` + `resolveLocalizedSchema`. The parallel-safe compromise: in this sprint, the handler **does not yet call `generateBusinessProfileMarkdown`** — it stores `answers` and schedules the Hindsight call via a placeholder `buildMarkdownStub(answers)` that just JSON-stringifies the answers. Sprint 4 replaces the stub with the real transformer + locale resolution. Mark this clearly with `TODO(sprint-4): replace stub with generateBusinessProfileMarkdown from Sprint 1`.
7. Create `contexts/onboarding/api/business-profile-skip-handler.ts`:
   - `POST` → marks skipped
8. Create `contexts/onboarding/api/business-profile-resync-handler.ts`:
   - `POST` → reads existing profile, re-posts Markdown to Hindsight, updates status. Requires `MANAGE_SETTINGS`.
9. Create thin re-exports under `src/app/api/onboarding/business-profile/`:
   - `schema/route.ts` → re-exports GET from schema handler
   - `route.ts` → re-exports GET + POST
   - `skip/route.ts` → re-exports POST
   - `resync/route.ts` → re-exports POST

## Tests (Vitest)

- `business-profile-repository.test.ts`: CRUD roundtrip against in-memory DynamoDB mock; locale field persists and roundtrips.
- `business-profile-handler.test.ts`: 401 without session; 200 with valid body; 400 on oversized payload; 400 when `locale` is present but not `'en' | 'pt-br'`; `seedMemoryContext` called once per successful submit; when body omits `locale`, falls back to request locale.
- `http-api-client.test.ts` (extend existing if present, else create): `seedMemoryContext` hits `/v1/memory/chat` with the correct body shape (`{ message, metadata: { source, schemaVersion } }`); the `TODO(core-api-seed-endpoint)` comment is present in source (a simple grep test guarding against accidental removal).
- `mock-api-client.test.ts`: returns a mock memoryId.

## Acceptance

- All tests green.
- `pnpm exec biome check apps/dashboard/src/contexts/onboarding apps/dashboard/src/lib/api` clean.
- `pnpm turbo check-types --filter dashboard` clean.
- No changes to `presentation/` or `middleware.ts` in this sprint.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-repository.ts
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-repository.test.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-schema-handler.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-handler.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-handler.test.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-skip-handler.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-resync-handler.ts
  - apps/dashboard/src/app/api/onboarding/business-profile/route.ts
  - apps/dashboard/src/app/api/onboarding/business-profile/schema/route.ts
  - apps/dashboard/src/app/api/onboarding/business-profile/skip/route.ts
  - apps/dashboard/src/app/api/onboarding/business-profile/resync/route.ts

files_to_modify:
  - apps/dashboard/src/lib/api/core-api-client.ts
  - apps/dashboard/src/lib/api/http-api-client.ts
  - apps/dashboard/src/lib/api/mock-api-client.ts

files_read_only:
  - apps/dashboard/src/lib/db/client.ts
  - apps/dashboard/src/lib/db/base-repository.ts
  - apps/dashboard/src/lib/api/with-auth.ts
  - apps/dashboard/src/lib/api/parse-body.ts
  - apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts
  - docs/tasks/dashboard/feature/2026-04-08_1200-onboarding-business-profile-form/spec.md

shared_contracts:
  - ICoreApiClient.seedMemoryContext (added here)
  - BusinessProfileRecord wire shape (PRD §5)
```
