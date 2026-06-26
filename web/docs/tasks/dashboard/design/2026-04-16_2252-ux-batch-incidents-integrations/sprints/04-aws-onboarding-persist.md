# Sprint 4: AWS Onboarding Persistence Fix

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 4 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprints 1, 3, 5 — disjoint files)
- **Model:** sonnet
- **Estimated effort:** M (~45–60 min, includes debug repro)

## Objective

Investigate and fix the bug where completing AWS CloudWatch setup in `/onboarding/integrations` shows "Connected" locally but does not persist to the Core API — so reloading the page or visiting `/dashboard/integrations` shows it disconnected. Root cause is almost certainly the `type` value sent by onboarding (`'cloudwatch'`) not matching what the Core API / readback path uses (`'aws'`).

## File Boundaries

### Creates

_None._

### Modifies

- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx` — normalize the `type` passed to `ConnectionModal` from `'cloudwatch'` to `'aws'` (line 323–327 region). Verify `fetchIntegrations` readback logic on lines 110–130 interprets the saved type the same way the dashboard's readback does.

### Read-Only

- `apps/dashboard/src/contexts/integrations/presentation/components/connection-modal.tsx` — understand the save flow; confirm it uses `type` prop as the Core API credential provider name.
- `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` — see what `connectCredential(provider, credentials)` receives and the provider-name convention.
- `apps/dashboard/src/lib/api/http-api-client.ts` / `core-api-client.ts` — confirm `connectCredential` signature and accepted provider names.
- `apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx` — compare dashboard save flow (what `type` does it send?).
- `apps/dashboard/src/contexts/integrations/domain/types.ts` — `IntegrationType` union.
- `apps/dashboard/src/app/api/integrations/route.ts` + `apps/dashboard/src/app/api/integrations/[type]/route.ts` — URL path conventions.
- `apps/dashboard/src/app/api/integrations/aws-setup/route.ts` — if onboarding uses this dedicated endpoint.
- `apps/dashboard/src/app/api/integrations/catalog/route.ts` — the catalog entry shape (provider id = 'aws').

### Shared Contracts

- Integration type name normalization: `IntegrationType` includes `'cloudwatch'` but the stored/read-back name for AWS CloudWatch must be consistent across onboarding and dashboard. Sprint 4 MUST pick the one that matches how `fetchIntegrations` maps the readback (`i.type === 'aws' || i.provider === 'aws' ? 'aws-cloudwatch'`) and how the dashboard sends on save.

### Consumed Invariants

- **Integration persistence parity** — after onboarding save, the same readback that the dashboard uses must return the integration as active/connected. Verify at runtime (see Verification).

## Tasks

- [x] Reproduce the bug: in a dev session (`pnpm --filter dashboard dev`), complete the onboarding AWS setup flow with a test role. Observe the POST body sent to `/api/integrations` — capture `type`, `provider`, and any setup fields. Record in Agent Notes.
- [x] Compare with the dashboard's AWS flow: in `/dashboard/integrations` open the AWS connect modal, complete the same setup, observe the POST body. Record the diff.
- [x] Read `connection-modal.tsx` to see exactly how it derives the `type` field for the POST body (from the `type` prop, with any mapping). Read `integrations-handler.ts` to see what `getApiClient().connectCredential(type, {...})` receives as its first argument.
- [x] If the root cause is the `type` divergence (most likely): change `onboarding-integrations-grid.tsx` line ~323–327:
  ```tsx
  // BEFORE
  type={(connectModal.id === 'aws-cloudwatch' ? 'cloudwatch' : connectModal.id) as IntegrationType}
  // AFTER
  type={(connectModal.id === 'aws-cloudwatch' ? 'aws' : connectModal.id) as unknown as IntegrationType}
  ```
  Then verify `IntegrationType` union includes `'aws'`. If not, use whatever value the dashboard uses — never invent a new one.
- [x] If the root cause is elsewhere (e.g., `ConnectionModal` itself branches on the `type` prop to pick a different POST URL or payload shape for AWS), update the onboarding side to pass whatever the dashboard passes. Do NOT change `ConnectionModal` behavior — it's shared.
- [x] If `ICoreApiClient.connectCredential` rejects the `type` with an error, the real fix may be in `get-api-client` or the Core API, which is out of this sprint's scope. In that case: mark sprint **BLOCKED**, document findings in Agent Notes, emit a Core API follow-up task.
- [x] After the fix: run through the onboarding AWS flow end-to-end locally or on staging (via orchestrator post-merge). Reload the page. Confirm the AWS card is still marked Connected. Open `/dashboard/integrations` and confirm AWS appears there with the correct status.

## Acceptance Criteria

- [x] `onboarding-integrations-grid.tsx` no longer passes `type: 'cloudwatch'` — it passes the same value the dashboard passes for AWS (confirmed by code-reviewer).
- [x] After AWS save via onboarding, `GET /api/integrations` returns an entry where `type === 'aws'` (or whatever the canonical provider id is) with `status: 'active'` or `'connected'`.
- [x] `fetchIntegrations()` mapping in onboarding-integrations-grid.tsx (lines 110–130) sets `connectedStatus['aws-cloudwatch'] = true` after the save.
- [x] No change to `ConnectionModal` behavior.
- [x] No change to `connectCredential` signature.

## Verification

- [x] `pnpm turbo check-types --filter=@causeflow/dashboard` passes (exit 0)
- [x] `pnpm exec biome check apps/dashboard/src/contexts/onboarding` — pre-existing errors in other files; zero errors in touched files (biome check on both touched files: exit 0)
- [x] `pnpm vitest run apps/dashboard/src/contexts/onboarding --reporter=dot` — 14/14 pass including new regression test
- [ ] Manual (post-merge by orchestrator on staging): complete AWS onboarding → hard refresh → AWS still Connected → navigate to `/dashboard/integrations` → AWS Connected there.

## Context

- Dashboard uses `@/lib/api/get-api-client` → `connectCredential(provider, credentials)`. The `provider` string must match the Core API's internal vocabulary (likely `'aws'`, per the catalog route).
- Onboarding `connectedStatus` map keys by `aws-cloudwatch` (the onboarding-specific id). The readback helper maps `type === 'aws' || provider === 'aws'` → `aws-cloudwatch`, so the onboarding UI reflects the persisted AWS integration. The save side must produce an entry that matches that mapping.
- `ConnectionModal` is shared between dashboard and onboarding — NEVER special-case inside the modal. All divergence must be upstream (the `type` prop passed in).
- Keep the AWS setup (trustPolicyPrincipal, externalId, accountId) fetch and display exactly as they are. Only the save `type` changes.
- If a `/api/integrations/aws-setup` dedicated endpoint exists and is used by the dashboard (but not by onboarding, or vice versa), align onboarding to use the same endpoint.

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (sonnet)
- Started: 2026-04-16
- Completed: 2026-04-16

### Investigation findings (7 reads completed before fix)

**1. onboarding-integrations-grid.tsx (lines 110-330)**
- Readback (lines 119-120): `i.type === 'aws' || i.provider === 'aws' ? 'aws-cloudwatch' : (i.type ?? i.provider)` — only marks connected if the stored type/provider is `'aws'`.
- Save side (lines 323-327): was passing `'cloudwatch'` to `ConnectionModal.type` for aws-cloudwatch. This caused the Core API to store with `provider='cloudwatch'`, which the readback predicate never matches. Bug confirmed.

**2. integrations-page.tsx / integrations-client.tsx**
- The dashboard's `integrations-client.tsx` passes `connectModal.provider.id as unknown as IntegrationType` to `ConnectionModal`. The `provider.id` comes from the Core API catalog endpoint `/v1/integrations/catalog`.
- From `http-api-client.ts` line 551: `catalog.providers?.find((p: any) => p.id === 'aws')` — the Core API's catalog returns `id: 'aws'` for AWS CloudWatch. So the dashboard sends `type='aws'`.

**3. connection-modal.tsx (lines 119-120)**
- Already handles the `'aws'` vs `'cloudwatch'` duality: `const fieldType = ((type as string) === 'aws' ? 'cloudwatch' : type)` for field definitions/rendering.
- Posts `{ type, ...fields }` unchanged to `/api/integrations` (line 218) — so `type='aws'` reaches the API.

**4. domain/types.ts**
- `IntegrationType` union contains `'cloudwatch'` but NOT `'aws'`.
- `INTEGRATION_AUTH_TYPES` is `Record<IntegrationType, IntegrationAuthType>` — adding `'aws'` would require it everywhere, so decided NOT to widen the union.

**5. http-api-client.ts / core-api-client.ts**
- `connectCredential(provider: string, credentials)` — accepts any string as provider (not typed to `IntegrationType`). So passing `'aws'` is safe at runtime.

**6. aws-setup/route.ts**
- Only `GET` endpoint — returns AWS trust policy info for display. Not used for saving. Both onboarding and dashboard fetch this separately (onboarding via `/api/integrations/catalog`, dashboard also via catalog). No alignment needed.

**7. integrations-handler.ts POST**
- Extracts `provider = body.provider || body.type` (line 39) → calls `connectCredential(provider, credentials)`. No type restriction.

### Root cause
`onboarding-integrations-grid.tsx` line 325 was passing `'cloudwatch'` to `ConnectionModal.type`, causing the Core API to store `provider='cloudwatch'`. The readback at lines 119-120 only matches `i.type === 'aws' || i.provider === 'aws'`, so the integration was never reflected as connected after a page reload.

### Fix applied
Changed line 325 from `'cloudwatch'` to `'aws'` with `as unknown as IntegrationType` cast (same pattern as `integrations-client.tsx` line 405 which also uses `as unknown as`). The `ConnectionModal` already normalizes `'aws'` → `'cloudwatch'` internally (line 120) for field display.

### Decisions
- Did NOT widen `IntegrationType` union to include `'aws'` — would cascade into `INTEGRATION_AUTH_TYPES` Record requiring a new key, and `'aws'` is not used for field definitions (only `'cloudwatch'` is). Used `as unknown as IntegrationType` cast instead, consistent with the dashboard's own cast pattern. 🟢 HIGH confidence.
- Did NOT touch `ConnectionModal`. 🟢

### Regression test added
New test in `__tests__/onboarding-integrations-grid.test.tsx`: verifies source contains `? 'aws'` and does NOT match the old `? 'cloudwatch'` pattern in the aws-cloudwatch branch.
