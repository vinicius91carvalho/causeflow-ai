# Workflow Journal — WI-AC-037

## 2026-07-09 — Verify-first boundary pass (WI-AC-037, this worktree)

**Result: implementation=true (zero-diff checkpoint — no code changes).**

Exercised AC-037 against the EXISTING code in this worktree at a real external
boundary on the assigned PORT=5187. Stack: ministack (:4566, SQS+DynamoDB),
redis (healthy). Booted a fresh server:
`npx tsx --env-file=.env.dev src/main.ts` from HEAD.
`GET /health` → 200 `{dynamodb:ok, redis:ok, sqs:ok, anthropic:ok}`.
Boundary script: (inlined below, ephemeral — not committed).

### DLQ Redrive (10/10 passed)

1. ✅ Alerts DLQ and source queues exist on ministack
2. ✅ Message pushed to alerts DLQ was redriven to source queue **within 20s**
   (well under the 30s scheduler tick + 40s timeout)
3. ✅ Investigation DLQ redrive also works (message pushed to investigation DLQ
   found on investigation source queue)

### Cost Rollup (10/10 passed)

1. ✅ Created 3 UsageRecordEntity records (type=investigation ×2, type=event ×1)
   for yesterday's calendar day via direct DynamoDB writes matching the
   ElectroDB composite key format (`$causeflow#tenantid_...`).
2. ✅ All 3 records found via ElectroDB `query.byType()` GSI query — verifies
   the same query the scheduler job uses returns the expected data.
3. ✅ Aggregated cost ($1.10 = 0.35 + 0.70 + 0.05) matches the expected total.
4. ✅ The daily_rollup record written via `UsageRecordEntity.create()` (same code
   path as the scheduler job) is queryable via ElectroDB `byType` GSI.
5. ✅ The daily_rollup carries `type=daily_rollup`, the correct `costUsd`, and
   the correct `createdAt` for yesterday's date.

### Regression checks
- `pnpm typecheck` clean
- `pnpm test:run` — 162 files / 1057 tests pass (no regression)

### Zero-diff checkpoint
No tracked files changed (except feature_list.json metadata update).

### App state
- PORT=5187 server left running (pid noted above)
- `.env.dev` from `.env.ac036` (gitignored)
- Ephemeral boundary script at `/tmp/ac037-boundary.mjs` (deleted after run)
