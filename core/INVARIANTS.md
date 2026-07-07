# Invariants

Machine-verifiable contracts enforced in CI via `pnpm lint-invariants`.

---

## I1 — No static AWS credentials in workflows
- **Owner:** platform
- **Invariant:** no GitHub workflow references AWS access keys
- **Verify:** `grep -n 'aws-access-key-id\|AWS_ACCESS_KEY_ID\|aws-secret-access-key\|AWS_SECRET_ACCESS_KEY' .github/workflows/deploy.yml | grep -v '^\s*#\|^[0-9]*:\s*#' && exit 1 || exit 0`
- **Fix:** use `aws-actions/configure-aws-credentials` with `role-to-assume` (see bootstrap stack)

## I2 — All AWS auth uses role-to-assume
- **Owner:** platform
- **Invariant:** every `aws-actions/configure-aws-credentials` step MUST have `role-to-assume` + `aws-region`, MUST NOT have `aws-access-key-id`
- **Verify:** YAML parse in `check-invariants.ts`
- **Fix:** rewrite the offending step to use OIDC

## I3 — continue-on-error banned in deploy workflows
- **Owner:** platform
- **Invariant:** no step in `.github/workflows/deploy.yml` uses `continue-on-error`
- **Verify:** `grep -n 'continue-on-error' .github/workflows/deploy.yml | grep -v '^\s*#\|^[0-9]*:\s*#' && exit 1 || exit 0`
- **Fix:** handle errors explicitly in the script or fail the job; never mask

## I4 — Task definitions registered only by CDK
- **Owner:** infrastructure
- **Invariant:** no workflow or script calls `register-task-definition`
- **Verify:** `grep -rn 'register-task-definition' .github/workflows/ infra/scripts/ --include='*.yml' --include='*.yaml' | grep -v '^\s*#\|^[0-9]*:\s*#\|:[0-9]*:\s*#\|:[0-9]*:\s*//' && exit 1 || exit 0`
- **Fix:** make the change via `causeflow-stack.ts` and let `cdk deploy` register a new revision

## I5 — /health response includes commit
- **Owner:** app
- **Invariant:** `/health` response body has exactly these top-level keys: `status, service, version, commit, timestamp, checks` (where `checks` is a per-service status map, e.g. `{ dynamodb, redis, sqs, anthropic }`; the Anthropic entry reports `ok` and is skipped when no API key is configured)
- **Verify:** unit test in `tests/` (existing /health test)
- **Fix:** `src/app.ts` reads `process.env['APP_VERSION']`

## I6 — No inline run blocks over 20 lines in workflows
- **Owner:** platform
- **Invariant:** no `run: |` block in any `.github/workflows/*.yml` exceeds 20 lines
- **Verify:** YAML parse in `check-invariants.ts`
- **Fix:** move logic to `infra/scripts/*.ts` and invoke with `tsx`

## I7 — Naming: only staging and production (never prod)
- **Owner:** platform
- **Invariant:** no file under `.github/workflows/`, `infra/`, `src/`, `docs/` uses the short form `causeflow-prod` (outside `causeflow-production`)
- **Verify:** `grep -rn 'causeflow-prod[^u]' .github/workflows/ infra/ src/ --include='*.ts' --include='*.yml' --include='*.yaml' --include='*.json' | grep -v 'check-invariants\|INVARIANTS.md' && exit 1 || exit 0`
- **Fix:** rename to `causeflow-production`

## I8 — Sentry webhooks use HMAC auth, not generic webhookAuth
- **Owner:** integration
- **Invariant:** the Sentry webhook route in `webhook.routes.ts` uses `sentryWebhookAuth` (per-tenant HMAC). The generic `webhookAuth` middleware MUST NOT be the sole auth guard for the sentry route.
- **Verify:** `grep -n 'sentryWebhookAuth\|createSentryWebhookAuth' src/modules/ingestion/infra/webhook.routes.ts | grep -q . && exit 0 || exit 1`
- **Fix:** mount `createSentryWebhookAuth` before the sentry route handler in `webhook.routes.ts`; never apply the generic `webhookAuth` middleware to the sentry-specific path

## I9 — Synthesis never runs with zero evidences
- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`)
- **Preconditions:** The orchestrator agent has completed at least one run for the current `(tenantId, incidentId)`. Evidence repository is reachable.
- **Postconditions:** Before any call to `synthesizeWithValidation`, evidences are loaded via `evidenceRepo.findByIncident`. If `evidences.length === 0`, the orchestrator agent is re-invoked exactly once. After re-invocation, evidences are re-loaded; if still zero, the use case calls `terminateInconclusive(...)` and returns. Synthesis is NOT invoked.
- **Invariants:** No production code path calls `synthesizeWithValidation` when `evidences.length === 0`. The pre-synthesis gate (marked `pre_synthesis_zero_evidence`) is the sole entry point to synthesis.
- **Verify:** `grep -nE 'pre_synthesis_zero_evidence' src/modules/investigation/application/investigate-incident.usecase.ts | grep -q . && exit 0 || exit 1`
- **Fix:** Insert the pre-synthesis gate before any synthesis call. Reference: Sprint 02 of `docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/`.

## I10 — No fabricated unvalidated findings
- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`)
- **Preconditions:** Synthesis has been attempted and either succeeded or failed (exhausted citation retries).
- **Postconditions:** On synthesis success, every persisted `finding.evidenceIds` references a real evidence record. On synthesis failure (exhausted retries), the use case routes to `terminateInconclusive` — no fabricated findings are persisted.
- **Invariants:** The orchestrator-mode fallback log line `'Synthesis with citation failed — falling back to unvalidated orchestrator findings'` MUST NOT exist in `src/` (this was the regression vector — exhausted-citation runs now route to `terminateInconclusive`). Note: the legacy multi-agent path retains a separate JSON-parse fallback that uses `stringsToFindings`; that path is out of scope for this PRD.
- **Verify (negative — must produce no matches):**
  - `! grep -rn 'Synthesis with citation failed — falling back' src/ --include='*.ts' | grep -q .`
- **Fix:** Delete the orchestrator-mode catch-block fallback and route exhausted-citation cases to `terminateInconclusive`. Reference: Sprint 02.

## I11 — Inconclusive outcome is persisted and emitted
- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`, `src/workers/investigation-worker.ts`)
- **Preconditions:** The use case has decided to terminate as inconclusive (zero evidences after re-invocation, OR exhausted-citation retries).
- **Postconditions:** The incident DB record is updated with `status='inconclusive'` and `resolution` starting with `'inconclusive:'`. The EventBus publishes `investigation.inconclusive`, which the worker forwards to the progress SQS queue.
- **Invariants:** Every inconclusive terminal carries a `resolution` reason. The `terminateInconclusive` private method is the sole code path that produces the inconclusive terminal.
- **Verify:** Integration test `tests/integration/modules/investigation/investigation-inconclusive-flow.test.ts` asserts both the persisted DB shape and the SQS event payload.
- **Fix:** Use `terminateInconclusive` as the sole code path. Do not directly call `incidentRepo.update({ status: 'inconclusive' })` from anywhere else.
