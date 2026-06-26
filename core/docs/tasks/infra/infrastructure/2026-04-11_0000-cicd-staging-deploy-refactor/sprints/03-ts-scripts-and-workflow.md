# Sprint 3 — TypeScript Deploy Scripts + Dockerfile ARGs + /health Commit + New Workflow (Staging)

**PRD:** `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md`
**Sprint:** 3 of 5
**Estimated work:** 150 minutes (90 scripts + 60 workflow)
**Dependencies:** Sprint 1 (OIDC role), Sprint 2 (clean staging stack, simplified CDK)
**Isolation:** worktree

---

## Goal

All operational deploy logic lives in testable TypeScript scripts under `infra/scripts/`. Docker images have the commit SHA baked in via `ARG GIT_SHA` / `ENV APP_VERSION`. The `/health` endpoint exposes a `commit` field so the verifier can assert which SHA is actually serving traffic. `.github/workflows/deploy.yml` is rewritten to use OIDC + CDK + these scripts, with zero inline bash logic — staging pipeline runs end-to-end.

## Why these two phases are in the same sprint

The scripts exist to power the workflow. Splitting them into separate sprints created an artificial boundary that made the workflow sprint a YAML-only change with nothing to test in isolation. Keeping them together means the workflow rewrite immediately validates the scripts against the clean staging stack, giving real end-to-end confidence before Sprint 4 (Hindsight) starts layering new runtime components.

**Production jobs are NOT added in this sprint.** Sprint 5 adds them along with the production bootstrap and invariants enforcement.

## Files to create

```
infra/scripts/
  lib/
    aws-clients.ts
    logger.ts
    types.ts
    config.ts
    errors.ts
  verify-deploy.ts
  wait-services-stable.ts
  check-health.ts
  resolve-image-tag.ts
  cleanup-stack.ts
  __tests__/
    verify-deploy.test.ts
    check-health.test.ts
    resolve-image-tag.test.ts
    wait-services-stable.test.ts
```

## Files to modify

- `Dockerfile` — add `ARG GIT_SHA=unknown` + `ENV APP_VERSION=${GIT_SHA}` to the **runtime stage** (NOT the builder stage — that would bust the pnpm install cache)
- `Dockerfile.worker` — same additions in the runtime stage
- `src/app.ts` — `/health` handler: add `commit: process.env['APP_VERSION'] ?? 'unknown'` field
- `package.json` — add devDeps: `tsx`, `@aws-sdk/client-ecs`, `@aws-sdk/client-cloudformation`, `aws-sdk-client-mock` (verify none already present)
- `vitest.config.ts` — include `infra/scripts/__tests__` in the test pattern
- Existing `/health` unit test (in `tests/` or `src/`) — update to assert the new shape
- `.github/workflows/deploy.yml` — full rewrite (staging-only job graph: test → build-and-push → deploy-staging → verify-staging)

## Files read-only (reference only)

- `src/app.ts:60-75` — current `/health` handler shape
- `.github/workflows/deploy.yml` — old 182-line version, to know what to delete
- `infra/cdk/lib/causeflow-stack.ts:317-366` — ALB / target group / `/health` path / grace period (informs verifier timeouts)
- `infra/cdk/lib/causeflow-stack.ts:512-517` — `CfnOutput` for `AlbDnsName`

## Shared contracts

- `verify-deploy.ts` CLI: `tsx infra/scripts/verify-deploy.ts --stage <staging|production> --expected-sha <sha> --services api,worker`
  - Exit codes: 0 = success, 1 = verification failure, 2 = config error, 3 = timeout
- `/health` response shape:
  ```json
  { "status": "ok", "service": "causeflow", "version": "0.1.0", "commit": "<7-char-sha>", "timestamp": "<iso8601>" }
  ```
- Docker ARG name: `GIT_SHA`
- Container env var: `APP_VERSION`
- `/health` field name: `commit` (never `version`, never `sha`)
- Workflow job names: `test`, `build-and-push`, `deploy-staging`, `verify-staging` (Sprint 5 adds `deploy-production`, `verify-production` by appending — not renaming these)
- Workflow uses `vars.AWS_ACCOUNT_ID`, `vars.AWS_REGION`, `vars.ECR_REGISTRY`, `vars.DEPLOY_ROLE_ARN` (from Sprint 1)

## Implementation details

### `/health` change

**Before:**
```json
{ "status": "ok", "service": "causeflow", "version": "0.1.0", "timestamp": "..." }
```

**After:**
```json
{ "status": "ok", "service": "causeflow", "version": "0.1.0", "commit": "f5ab53b", "timestamp": "..." }
```

`commit` reads from `process.env['APP_VERSION'] ?? 'unknown'`. The `version` field stays — semver from `package.json`. Conflating the two would break any future semver consumer.

### Dockerfile additions

At the end of the **runtime stage** in both `Dockerfile` and `Dockerfile.worker`:

```dockerfile
ARG GIT_SHA=unknown
ENV APP_VERSION=${GIT_SHA}
```

Do NOT add `ARG BUILD_TIME` — it would bust the cache on every build.

### `verify-deploy.ts` behavior

For each requested service:
1. Call `wait-services-stable.ts` against the ECS service (poll `DescribeServices` until `deployments[0].rolloutState === "COMPLETED"` or timeout)
2. For API: call `check-health.ts` to poll `https://api-${stage}.causeflow.ai/health` and assert `commit === expectedSha.slice(0, 7)`
3. For worker: assert `DescribeServices` shows a `taskDefinition` matching the expected revision

Default timeout: 600s (cold start budget).

### Testing

`vitest` + `aws-sdk-client-mock`. Every AWS call mocked. Zero real AWS calls.

### Workflow target structure

```
test (PR + push)
  └→ build-and-push (main + workflow_dispatch)
       └→ deploy-staging (auto)
            └→ verify-staging
```

| Job | Permissions | Runs |
|-----|-------------|------|
| `test` | `contents: read` | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:run && pnpm lint-invariants` |
| `build-and-push` | `id-token: write, contents: read` | `configure-aws-credentials` via OIDC + `docker buildx build --build-arg GIT_SHA=${{ github.sha }}` for both Dockerfile and Dockerfile.worker + push to ECR |
| `deploy-staging` | `id-token: write, contents: read` | `cd infra/cdk && npx cdk deploy causeflow-staging -c imageTag=${{ github.sha }} --require-approval never` |
| `verify-staging` | `id-token: write, contents: read` | `tsx infra/scripts/verify-deploy.ts --stage staging --expected-sha ${{ github.sha }} --services api,worker` |

**Note:** `pnpm lint-invariants` will fail until Sprint 5 ships `check-invariants.ts`. For this sprint, add a no-op placeholder script in `package.json` (`"lint-invariants": "echo 'lint-invariants placeholder — implemented in Sprint 5'"`) so the CI contract is already in place. Sprint 5 will replace the placeholder with the real script.

## Acceptance criteria

### Phase 1 — Scripts + Dockerfile + /health

- [ ] All files under `infra/scripts/` created per the list above
- [ ] `pnpm test:run` passes (including new tests under `infra/scripts/__tests__/`)
- [ ] `tsx infra/scripts/verify-deploy.ts --stage staging --expected-sha <current-staging-sha> --services api,worker` returns exit 0 when run locally
- [ ] `docker build --build-arg GIT_SHA=test123 -t local .` → `docker run -p 3000:3000 local` → `curl localhost:3000/health | jq .commit` returns `"test123"`
- [ ] `src/app.ts` returns the `commit` field
- [ ] `/health` unit test updated to assert full shape (`status, service, version, commit, timestamp`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `tsx` in devDependencies
- [ ] No real AWS SDK calls in any test (mocked via `aws-sdk-client-mock`)
- [ ] `pnpm lint-invariants` placeholder script added to `package.json`

### Phase 2 — Workflow rewrite

- [ ] `git push origin main` triggers: test → build-and-push → deploy-staging → verify-staging
- [ ] All four jobs pass
- [ ] `verify-staging` logs show `commit === <expected-sha>` for the API service
- [ ] `verify-staging` logs show worker task def revision match
- [ ] Total runtime < 15 minutes
- [ ] **Zero** `continue-on-error` anywhere in the workflow (I3 pre-enforcement)
- [ ] **Zero** static credentials referenced (I1 pre-enforcement)
- [ ] All `aws-actions/configure-aws-credentials` steps use `role-to-assume` (I2 pre-enforcement)
- [ ] Zero `register-task-definition` invocations (I4 pre-enforcement)
- [ ] No inline `run: |` block exceeds 20 lines (I6 pre-enforcement)
- [ ] The `Resolve secret ARNs` step (old `:106-124`) is gone
- [ ] The sed hack (old `:138-172`) is gone
- [ ] The stack-status cleanup step (old `:89-100`) is gone
- [ ] Workflow structure ready for Sprint 5 to append production jobs without restructuring

## Verification

```bash
cd /root/projects/causeflow/core
pnpm test:run
pnpm typecheck
pnpm lint

# Local docker sanity check
docker build --build-arg GIT_SHA=test123 -t causeflow-local .
docker run -d -p 3000:3000 --name cf-local causeflow-local
sleep 3
curl -s localhost:3000/health | jq .commit  # expect "test123"
docker stop cf-local && docker rm cf-local

# Live staging smoke
CURRENT_SHA=$(curl -s https://api-staging.causeflow.ai/health | jq -r .commit 2>/dev/null || git rev-parse HEAD)
tsx infra/scripts/verify-deploy.ts --stage staging --expected-sha $CURRENT_SHA --services api,worker
echo "exit: $?"
```

Then push to a test branch and merge to main:
```bash
git checkout -b test/new-deploy-workflow
git push origin test/new-deploy-workflow
# Observe test + build-and-push on the PR
# After merge: observe deploy-staging + verify-staging
curl -s https://api-staging.causeflow.ai/health | jq .commit
# Expected: the 7-char SHA of the most recent main commit
```

## Return format

Report:
- Test pass/fail counts
- Typecheck / lint pass/fail
- Docker local build `/health` commit value
- Live `verify-deploy.ts --stage staging` exit code
- Workflow run URL + total runtime
- Pass/fail per job (test, build-and-push, deploy-staging, verify-staging)
- `/health` commit value after the live deploy (should match pushed SHA)
- Final `deploy.yml` line count
- Any invariant pre-checks that failed on first run and needed fixes
