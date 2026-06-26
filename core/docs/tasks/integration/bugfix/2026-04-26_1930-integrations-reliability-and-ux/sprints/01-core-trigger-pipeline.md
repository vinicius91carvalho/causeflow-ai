# Sprint 1: Core Trigger Pipeline Correctness

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 1 of 4
- **Depends on:** None
- **Batch:** 1 (parallel with Sprint 4)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Fix the broken Composio SDK call (wrong namespace `triggerInstances` → `client.triggers`), resolve v1/v3 slug mismatch, and add duplicate-trigger prevention (GSI + use-case check + 409 route mapping).

## File Boundaries

### Creates (new files)

- `core/src/modules/integration/domain/trigger.errors.ts` — new domain error `TriggerAlreadyExistsError`

### Modifies (can touch)

- `core/src/shared/infra/integrations/composio-trigger-service.ts` — fix SDK upsert call, align slug format
- `core/src/modules/integration/application/create-trigger.usecase.ts` — add duplicate check before create
- `core/src/modules/integration/domain/trigger.repository.ts` — add `findByTenantProviderSlug` to interface
- `core/src/shared/infra/db/entities/TriggerEntity.ts` — add GSI `byTenantProviderSlug`
- `core/src/modules/integration/infra/dynamo-trigger.repository.ts` — implement new repo method using new GSI
- `core/src/modules/integration/infra/trigger.routes.ts` — map `TriggerAlreadyExistsError` → 409

### Read-Only (reference but do NOT modify)

- `core/src/shared/infra/integrations/composio-client.ts` — inspect `Composio` class constructor + public surface
- `core/src/modules/integration/infra/trigger-event-mapper.ts` — incident-mapped slug set
- `core/src/bootstrap.ts` — confirm no re-wiring needed
- `core/src/app.ts` — confirm route mounting unchanged
- `node_modules/@composio/core/dist/index.cjs` — verify actual public API shape of `client.triggers`

### Shared Contracts (from PRD Section 12)

- `TriggerAlreadyExistsError` — new domain error, produced here, consumed by route layer
- Confirmed v3 slug format — output of this sprint, consumed by Sprint 2

### Consumed Invariants

- None (this sprint defines them)

## Tasks

- [ ] Read `node_modules/@composio/core/dist/index.cjs` or run `client.triggers.list(...)` to confirm:
  (a) `client.triggers` exists on the `Composio` instance
  (b) exact method signature: `client.triggers.upsert(slug, payload)` or similar
  (c) what slug format v3 accepts — is it `SENTRY_NEW_ISSUE` (uppercase) or `sentry.new_issue` (lowercase dotted)?
  Document the confirmed slug format in a comment at top of `composio-trigger-service.ts`.
- [ ] Replace the buggy SDK call in `composio-trigger-service.ts:144-158`:
  - Remove `(client as any).triggerInstances.upsert(...)` try/catch block
  - Call `client.triggers.upsert(triggerSlug, { connectedAccountId, triggerConfig })` (or equivalent SDK method — use what SDK actually exposes)
  - Keep HTTP fallback only for genuine network errors (non-TypeError failures), or remove entirely if SDK is reliable
- [ ] Update `TRIGGER_CATALOG` in `composio-trigger-service.ts:20-57`:
  - If v3 slugs differ from v1 (e.g., `sentry.new_issue` vs `SENTRY_NEW_ISSUE`), update the catalog keys to match v3 form
  - Add comment: `// slugs must match Composio v3 trigger_type slug format`
- [ ] Create `core/src/modules/integration/domain/trigger.errors.ts`:
  ```ts
  export class TriggerAlreadyExistsError extends Error {
    readonly code = 'TRIGGER_ALREADY_EXISTS';
    constructor(public readonly triggerSlug: string, public readonly tenantId: string) {
      super(`Trigger "${triggerSlug}" already exists for this tenant`);
      this.name = 'TriggerAlreadyExistsError';
    }
  }
  ```
- [ ] Add `byTenantProviderSlug` GSI to `TriggerEntity.ts`:
  - Add attribute `tenantProviderSlug: { type: 'string' }` (computed value: `${tenantId}#${provider}#${triggerSlug}`)
  - Add index: `byTenantProviderSlug: { index: 'gsi1pk-gsi1sk-index', pk: { field: 'gsi1pk', composite: ['tenantProviderSlug'] }, sk: { field: 'gsi1sk', composite: ['triggerId'] } }`
  - Check existing GSI index names in TriggerEntity — use the next available GSI number (e.g., gsi2 if gsi1 is taken by `byComposioTrigger`)
- [ ] Add `findByTenantProviderSlug(tenantId: string, provider: string, triggerSlug: string): Promise<Trigger | null>` to `trigger.repository.ts` interface
- [ ] Implement in `composio-trigger.repository.ts`: query the new GSI, return mapped `Trigger` or `null`
- [ ] Update `create-trigger.usecase.ts:26-54`:
  - Before `triggerRepo.create(...)`, call `triggerRepo.findByTenantProviderSlug(tenantId, provider, triggerSlug)`
  - If found: throw `TriggerAlreadyExistsError(triggerSlug, tenantId)`
- [ ] Update `trigger.routes.ts:51` POST handler:
  - Catch `TriggerAlreadyExistsError` → return `ctx.json({ error: 'TRIGGER_ALREADY_EXISTS', message: error.message }, 409)`
- [ ] Write/update unit tests:
  - `create-trigger.usecase.test.ts`: add test "throws TriggerAlreadyExistsError when findByTenantProviderSlug returns existing trigger"
  - `composio-trigger-service.test.ts`: add test "uses client.triggers.upsert (not HTTP fallback) on success"
- [ ] Verify admin role check still enforced: read `trigger.routes.ts` POST handler and confirm `requireRole('admin')` present; add test "POST without admin role returns 403" to `trigger.routes.test.ts`

## Acceptance Criteria

- [ ] POST `/v1/triggers` with `{ provider: "sentry", triggerSlug: "<correct-slug>" }` returns 200
- [ ] POST same slug+tenant twice: first returns 200, second returns 409 with body `{ error: "TRIGGER_ALREADY_EXISTS" }`
- [ ] No log line "Cannot read properties of undefined (reading 'upsert')" in test run
- [ ] No log line "Failed to create trigger: 404" in test run
- [ ] New unit tests pass

## Verification

- [ ] `cd core && pnpm test -- --reporter=verbose modules/integration`
- [ ] `cd core && pnpm typecheck`
- [ ] `cd core && pnpm lint`

## Context

### Root Cause — SDK Bug
File: `core/src/shared/infra/integrations/composio-trigger-service.ts:144-158`

The bug is a wrong property access:
```ts
// BROKEN — `triggerInstances` does not exist on public Composio surface
const triggerInstances = (client as any).triggerInstances;
const result = await triggerInstances.upsert(triggerSlug, { ... });
```

`@composio/core@0.6.8` exposes `client.triggers` (not `client.triggerInstances`). The inner SDK client has `triggerInstances` but it is not accessible on the public `Composio` instance. The try/catch swallows the TypeError and falls through to the HTTP fallback.

### Root Cause — Slug Format Mismatch
The HTTP fallback POSTs to `https://backend.composio.dev/api/v3/trigger_instances/{slug}/upsert`.
The catalog slugs come from `GET /api/v1/triggers?appNames=...` — e.g., `SENTRY_NEW_ISSUE`.
Composio v3 API returns 404 "Trigger type SENTRY_NEW_ISSUE not found" — v3 likely uses a different slug format.
**Sprint executor must probe the actual v3/SDK slug before hardcoding.** Use `client.triggers.list({ toolkits: ['sentry'] })` or equivalent and log the result to determine canonical form.

### ElectroDB GSI Note
Current `TriggerEntity.ts` has two indexes:
- `primary`: pk=`tenantId`, sk=`triggerId`
- `byComposioTrigger` (GSI1): pk=`composioTriggerId`, sk=`tenantId`

Add a new GSI (GSI2) for `byTenantProviderSlug`. ElectroDB syntax for a new GSI:
```ts
byTenantProviderSlug: {
  index: 'gsi2pk-gsi2sk-index', // use actual DynamoDB index name from CDK stack
  pk: {
    field: 'gsi2pk',
    composite: ['tenantProviderSlug'],
  },
  sk: {
    field: 'gsi2sk',
    composite: ['triggerId'],
  },
}
```
Check the CDK stack at `core/infra/` to find whether a GSI2 is already provisioned on the Triggers table. If not, the executor must note this as a BLOCKED state — CDK changes are out of this sprint's scope. If no GSI2 exists, implement `findByTenantProviderSlug` using a query + client-side filter as a fallback (less efficient, acceptable for current scale).

### Route Error Mapping
Current error mapping in `trigger.routes.ts` — look for the existing pattern used for 4xx errors (likely a similar catch block for other error types). Follow the same pattern for `TriggerAlreadyExistsError`.

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:
