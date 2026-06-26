# Sprint 4: SQS Operational Log Demotion

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 4 of 4
- **Depends on:** None
- **Batch:** 1 (parallel with Sprint 1)
- **Model:** sonnet
- **Estimated effort:** S

## Objective

Pass `logSuccessLevel: 'trace'` to all 3 SQS `instrumentedCall` invocations in `sqs-client.ts` so SQS operational logs (`sqs.receive ok`, `sqs.send ok`, `sqs.delete ok`) are suppressed at info level in staging.

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `core/src/shared/infra/queue/sqs-client.ts` — pass `logSuccessLevel: 'trace'` to all 3 instrumentedCall calls (lines 33, 39, 52)

### Read-Only (reference but do NOT modify)

- `core/src/shared/infra/observability/outbound.ts` — confirm `logSuccessLevel` parameter type accepts `'trace'` (it does — line 30 type union)
- `core/tests/unit/shared/infra/observability/outbound.test.ts` — confirm generic test remains unaffected (it tests the helper default, not sqs-client.ts callsites)
- `core/tests/unit/shared/queue/sqs-client.test.ts` — confirm no test asserts log level

### Shared Contracts

None

### Consumed Invariants

None

## Tasks

- [ ] Open `core/src/shared/infra/queue/sqs-client.ts`
- [ ] Locate the 3 `instrumentedCall(...)` invocations:
  - Line ~33: `send` operation
  - Line ~39: `receive` operation (note: this one may already use a dynamic `logSuccessLevel` based on message count — replace the dynamic with `'trace'` per user request for ALL sqs logs)
  - Line ~52: `delete` operation
- [ ] Add `logSuccessLevel: 'trace'` to each invocation:
  ```ts
  // send:
  instrumentedCall('sqs', 'send', sendFn, { logSuccessLevel: 'trace' })
  // receive:
  instrumentedCall('sqs', 'receive', receiveFn, { logSuccessLevel: 'trace' })
  // delete:
  instrumentedCall('sqs', 'delete', deleteFn, { logSuccessLevel: 'trace' })
  ```
  Check exact function signature in `outbound.ts` — the options object may be the 4th argument or inline options. Use the pattern already used if the receive op already passes `logSuccessLevel`.
- [ ] Verify `outbound.ts:30` — confirm `'trace'` is in the type union for `logSuccessLevel`. If the type is only `'info' | 'debug'`, extend it to include `'trace'` in `outbound.ts`.
- [ ] Confirm existing `outbound.test.ts` test still passes — it tests the helper default separately, not the callsite override.

## Acceptance Criteria

- [ ] All 3 SQS operations (`send`, `receive`, `delete`) log at `trace` level on success
- [ ] With `LOG_LEVEL=info` (staging default): no `sqs.receive ok`, `sqs.send ok`, or `sqs.delete ok` lines appear
- [ ] With `LOG_LEVEL=trace`: these lines appear as expected
- [ ] Non-SQS targets (`redis`, `dynamodb`, `anthropic`, `clerk`, `composio`) still log at `info` — unchanged
- [ ] `pnpm --filter core test` passes (no assertions broken)

## Verification

- [ ] `cd core && pnpm test -- shared/queue`
- [ ] `cd core && pnpm test -- shared/infra/observability`
- [ ] `cd core && pnpm typecheck`
- [ ] Manual: start core dev server locally with `LOG_LEVEL=info`, trigger a queue operation, confirm no `sqs.* ok` lines. Restart with `LOG_LEVEL=trace`, confirm lines appear.

## Context

### Helper Signature

`core/src/shared/infra/observability/outbound.ts:46`:
```ts
getLogger()[successLevel]({ target, op, durationMs, ok: true, ...safeAttrs }, `${target}.${op} ok`);
```
Where `successLevel` defaults to the `logSuccessLevel` parameter (line 45), itself defaulting to `'info'`.

The type at line 30 accepts multiple values. Confirm `'trace'` is in the union. If not, add it — this is a safe change in `outbound.ts` (additive to type union only).

### SQS receive special case

The receive operation at `sqs-client.ts:39` may already have dynamic logic:
```ts
logSuccessLevel: messagesReceived > 0 ? 'info' : 'trace'
```
Replace both branches with `'trace'` — all SQS receive logs go to trace regardless of message count.

### Why this is safe

Changing `logSuccessLevel` at the callsite does NOT change any error-level logs — those are hard-coded `getLogger().error(...)` in `outbound.ts:54`. Only the `ok` success path is affected.

No test in the suite asserts that `sqs.*` logs appear at info level. The generic `outbound.test.ts` tests use arbitrary (`'x', 'y'`) target/op strings, not `'sqs'`.

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:
