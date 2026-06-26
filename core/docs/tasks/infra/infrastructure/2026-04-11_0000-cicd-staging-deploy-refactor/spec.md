# PRD — CI/CD Staging Deploy Refactor

**Status:** Build Candidate — ready for execution
**Author:** Claude (via `/plan`)
**Date:** 2026-04-11
**Stakeholders:** Vinicius Carvalho (tech lead), Sérgio Mendes (dev)
**Target envs:** staging (us-east-2, account `409171461008`) + production (full bootstrap in Sprint 6 via AWS CLI + CDK; secrets seeded from staging)

---

## Context Loaded

Source plan: `/root/.claude/plans/ancient-purring-kettle.md` (770 lines, fully researched).

Key files referenced by the plan (loaded into executors' context via sprint specs):
- `.github/workflows/deploy.yml` — 182 lines, broken pipeline being rewritten
- `infra/cdk/lib/causeflow-stack.ts` — ~520 lines; Hindsight block commented at `:411-506`; taskSecrets map at `:203-230`; secret ARN context-injection at `:37-46`
- `src/app.ts:60-75` — `/health` handler
- `Dockerfile`, `Dockerfile.worker` — runtime stages need `ARG GIT_SHA` / `ENV APP_VERSION`
- `src/shared/infra/memory/hindsight-agent-memory.ts` — app-side Hindsight adapter with graceful fallback (commit `b00974b`)
- `docs/staging-deploy-guide.md` — to be updated / promoted to `deploy-guide.md`

AWS current state (verified live when plan was written):
- `causeflow-staging` stuck in `UPDATE_ROLLBACK_FAILED`
- `causeflow-production` does not exist
- Only orphan secret `causeflow-prod/vapid-keys` with inconsistent naming (must migrate to `causeflow-production/vapid-keys`)
- ECR repos, DynamoDB tables, Secrets Manager entries for production must be bootstrapped via AWS CLI

---

## Problem

The pipeline `.github/workflows/deploy.yml` is broken in production (run `24285460374`). Three independent failures compound:

1. **Stuck CloudFormation state.** `causeflow-staging` is in `UPDATE_ROLLBACK_FAILED`. The cleanup step (`deploy.yml:89-100`) only handles `ROLLBACK_COMPLETE | DELETE_FAILED | REVIEW_IN_PROGRESS` — it ignores `UPDATE_ROLLBACK_FAILED`. Every `cdk deploy` is guaranteed to fail.
2. **Broken workaround.** Because CDK is expected to fail, the workflow masks it with `continue-on-error: true` (line 129) and falls back to a manual hack (`deploy.yml:138-172`): `aws ecs describe-task-definition | sed -e s|partial|full|g | jq | aws ecs register-task-definition`. The `sed` uses `|` as delimiter but substituted values contain `|` — result: `line 18: causeflow-staging/stripe-secrets|arn:...: No such file or directory` and `sed: -e expression #1, char 1: unterminated 's' command`. The final JSON is invalid.
3. **Static AWS credentials.** `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` live in GitHub Secrets. No OIDC, no automatic rotation — contrary to the pattern already adopted in `causeflow-web` (dashboard).

Additional structural issues:
- ~300 lines of inline bash/python in YAML, impossible to test.
- No post-deploy verification — no way to confirm which SHA is actually serving traffic.
- Third container `causeflow-{stage}-hindsight` (3rd party, `ghcr.io/vectorize-io/hindsight`) not in pipeline (commented out at `causeflow-stack.ts:411-506`). App already has client adapter and env var plumbing with graceful fallback.
- Production does NOT exist in AWS. Sprint 6 bootstraps everything from scratch via AWS CLI + CDK, with secret seed values copied 1-to-1 from staging except for third-party test/dev keys (Stripe, Clerk, Langfuse) where manual review is required.

## Desired Outcome

Robust pipeline using OIDC, CDK as source-of-truth, logic in testable TypeScript, with post-deploy verification that confirms via `/health.commit` which SHA is serving traffic. Hindsight enabled as a 3rd ECS service via CDK (uncomment of existing block) in **both staging and production** — the block is parameterized by `stage`, so the same CDK diff covers both environments. Production bootstrapped from scratch via AWS CLI (ECR, DynamoDB, Secrets Manager) + `cdk deploy causeflow-production`, using staging values as seed.

---

## Correctness Discovery (6 questions, PRD+Sprint mode)

1. **Audience:** Platform engineers (Vinicius, Sérgio) deploying code to staging and production. Secondary audience: oncall responders who need to know "is the current deploy actually running". Tertiary: auditors who want proof that no static AWS credentials touch CI.
2. **Verification:** `git push origin main` triggers full pipeline; after < 15 minutes `curl https://api-staging.causeflow.ai/health | jq .commit` returns the pushed SHA; approval gates to production; after approval the same validation runs against `api.causeflow.ai`. Automated checks (`INVARIANTS.md` + `check-invariants.ts`) block reintroduction of static creds, sed hacks, or `prod` naming.
3. **Failure definition:** Any of these is a failure — (a) workflow passes but wrong SHA is serving, (b) `continue-on-error` reappears in deploy workflow, (c) a GetSecretValue permission leaks to the OIDC role, (d) static AWS credentials reintroduced, (e) deploy takes > 15 min due to untuned timeouts, (f) Hindsight task loses memory bank data across restarts (EFS not persisting), (g) production bootstrap copies a Stripe test key as a live key.
4. **Danger definition:** Catastrophic — (a) OIDC role grants `secretsmanager:GetSecretValue` (full secret exfiltration from a compromised GitHub token), (b) delete-stack destroys non-recreatable data (mitigated: ECR/Secrets/DynamoDB are not stack-owned), (c) production secrets cross-pollinated with staging test credentials on first deploy, (d) Hindsight EFS One Zone chosen for production (data loss on AZ failure).
5. **Uncertainty policy:** Each high-risk decision (D1-D5) has a documented winner with justification. Unknowns tracked in "Risks & Unknowns" (R1-R7, U1-U3). Sprint executors must stop and escalate if an unknown blocks progress rather than guessing.
6. **Risk tolerance:** Zero tolerance on security (OIDC scope, no GetSecretValue, no static creds reintroduced, no test keys in production). Medium tolerance on cost (~$115-125/mo production baseline is acceptable but must be confirmed with user before Sprint 6 deploy). Low tolerance on downtime — staging downtime is authorized for Sprint 2; production has no downtime budget (gated by manual approval).

---

## Architectural Debate (stochastic analysis)

### D1 — Where task definitions live
- **Option A (Winner):** CDK is source-of-truth. Delete all `sed` hacks; let `cdk deploy` generate new revisions via `imageTag` context change. Net diff: negative (~117 lines inline removed, ~12 CDK lines simplified).
- Option B: Keep hack, fix sed delimiter. Rejected — doesn't address root cause.

**Winner: A.**

### D2 — OIDC role location
- Option A: Inline in `causeflow-staging` stack. Rejected — app-level churn could lock out auth.
- **Option B (Winner):** Separate bootstrap stack `causeflow-bootstrap` with only `OpenIdConnectProvider` + `Role`. Deployed once manually from laptop with admin creds. Control plane isolated from data plane.

**Winner: B.** Industry standard.

### D3 — TypeScript script organization
- Option A: One big `deploy-helpers.ts` file. Rejected — untestable in isolation.
- **Option B (Winner):** Individual scripts per workflow step + `infra/scripts/lib/` for shared code. Each testable with vitest.

**Winner: B.**

### D4 — How to unlock `causeflow-staging`
- **Option A (Winner):** Delete the stack and recreate manually from laptop with admin creds. User authorized staging downtime. ECR/Secrets/DynamoDB survive because they're not stack-owned.
- Option B: Manually clean stuck resources via console. Rejected — slower, riskier, not reproducible.

**Winner: A.**

### D5 — Post-deploy verification strategy
- Option A: `services-stable` only. Rejected — doesn't prove correct SHA is running.
- Option B: `/health` commit check only. Rejected — doesn't cover worker (no HTTP surface).
- **Option C (Winner):** Both, layered. API: `services-stable` → poll `/health` with commit check. Worker: `services-stable` → describe service → assert `rolloutState === "COMPLETED"` and `taskDefinition` matches.

**Winner: C.** ~40 lines of TS, covers different failure modes.

---

## Final Architecture

### IAM — Bootstrap OIDC role

**New file:** `infra/cdk/lib/bootstrap-stack.ts` + `infra/cdk/bin/bootstrap.ts` (separate entry point).

**Trust policy scoped to repo + environments:**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::409171461008:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": [
          "repo:causeflow/core:ref:refs/heads/main",
          "repo:causeflow/core:environment:staging",
          "repo:causeflow/core:environment:production"
        ]
      }
    }
  }]
}
```

**Minimum permissions** (inline policy on role `causeflow-github-deploy`):
- `ecr:GetAuthorizationToken` on `*`
- `ecr:{PutImage, GetDownloadUrlForLayer, BatchCheckLayerAvailability, BatchGetImage, InitiateLayerUpload, UploadLayerPart, CompleteLayerUpload}` on `arn:aws:ecr:us-east-2:409171461008:repository/causeflow-*`
- `cloudformation:{CreateStack,UpdateStack,DeleteStack,DescribeStacks,DescribeStackEvents,DescribeStackResources,CreateChangeSet,DeleteChangeSet,DescribeChangeSet,ExecuteChangeSet,GetTemplate}` on `causeflow-*`
- `ecs:{DescribeServices,DescribeTaskDefinition,DescribeTasks,ListTasks,UpdateService}`
- `secretsmanager:{ListSecrets,DescribeSecret}` — **NEVER** `GetSecretValue`. The ECS task execution role is what fetches values.
- `iam:PassRole` on `arn:aws:iam::409171461008:role/causeflow-*-ecs-{execution,task}` with condition `iam:PassedToService=ecs-tasks.amazonaws.com`
- `sts:AssumeRole` on CDK bootstrap roles (`cdk-hnb659fds-*`)
- `s3:{GetObject,PutObject}` on `arn:aws:s3:::cdk-hnb659fds-assets-*`
- `logs:{DescribeLogGroups,DescribeLogStreams,GetLogEvents}` on `/ecs/causeflow-*`

**Blast radius of a compromised OIDC token:** redeploy of pre-existing image in ECS. Attacker **cannot** exfiltrate secrets because the OIDC role has no `GetSecretValue`.

### Secret & Environment Variable Management

Three distinct categories, each with a different home. **Nothing goes into GitHub Environment secrets/variables except the minimum config the workflow needs to invoke `cdk deploy`.**

**Category 1 — Secrets (sensitive values):** `JWT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, `RESEND_API_KEY`, `LANGFUSE_SECRET_KEY`, `HINDSIGHT_API_KEY`, all 25 entries of staging-deploy-guide.

- Live in AWS Secrets Manager at `causeflow-${stage}/${name}` (unchanged).
- CDK injects via `ecs.Secret.fromSecretsManager(secret, 'FIELD_NAME')`.
- ARN resolved inside CDK by `Secret.fromSecretNameV2('causeflow-${stage}/${name}')` during `cdk synth`. **Eliminates** the `Resolve secret ARNs` step in the workflow and the `-c 'secretArns=...'` context injection.
- Only the ECS task execution role sees values. GitHub Actions never sees any secret value.
- Rotation: edit in Secrets Manager → next task rollout picks it up. No code change.

**Category 2 — Non-secret env vars (runtime config):** `NODE_ENV`, `STAGE`, `AWS_REGION`, `PORT`, `REDIS_URL`, `DYNAMODB_TABLE_NAME`, `SQS_*_URL`, `ECS_CLUSTER`, `ECS_*`, `HINDSIGHT_BASE_URL`, `INVESTIGATION_RELAY_URL`, feature flags, `APP_VERSION` (commit SHA baked).

- Live in CDK code (`causeflow-stack.ts`), parameterized by `stage`.
- Most are derived from stack resources (queue URLs from the queue construct, cluster name from cluster, etc.).
- Pure literals (`NODE_ENV=production`, `PORT=3000`, feature flags) hardcoded — versioned, code-reviewable via PR.
- Stage-varying values (`INVESTIGATION_RELAY_URL=wss://api-staging...` vs `wss://api...`) in a small `stage` switch inside the stack.
- **NOT** in GitHub Environment variables — would add indirection without security benefit.
- `APP_VERSION` is the only build-time env var (via `--build-arg GIT_SHA` in Dockerfile) — ties image to commit.

**Category 3 — Workflow config (what CI itself needs):** account ID, region, ECR registry URL, deploy role ARN.

- Live in GitHub repository **variables** (not secrets — none of these values is sensitive).
- Complete list:
  - `vars.AWS_ACCOUNT_ID = 409171461008`
  - `vars.AWS_REGION = us-east-2`
  - `vars.ECR_REGISTRY = 409171461008.dkr.ecr.us-east-2.amazonaws.com`
  - `vars.DEPLOY_ROLE_ARN = arn:aws:iam::409171461008:role/causeflow-github-deploy`
- To delete from repo: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID` (now a variable), `SECRET_ARNS_STAGING`.

**Summary:** Secrets → Secrets Manager. Runtime env vars → CDK code. Workflow config → GitHub repo variables. GitHub Environment (staging/production) serves ONLY as an approval gate, stores nothing.

### File Layout — `infra/scripts/`

```
infra/scripts/
  lib/
    aws-clients.ts        # typed factory for ECS/ECR/SecretsManager/CloudFormation clients
    logger.ts             # structured JSON, honors GITHUB_ACTIONS env for ::group::/::endgroup::
    types.ts              # DeployConfig, VerifyResult, ServiceState, StageName union
    config.ts             # parse --stage, resolve env vars, validate StageName
    errors.ts             # DeployError, VerifyError, TimeoutError (with .exitCode)
  verify-deploy.ts        # orchestrator: services-stable + /health poll for each service
  wait-services-stable.ts # wrapper around ecs:DescribeServices polling with timeout
  check-health.ts         # HTTPS poll, asserts commit field
  resolve-image-tag.ts    # computes ECR image URIs from a git SHA (pure)
  cleanup-stack.ts        # handles all recoverable CFN states (one-time tool)
  check-invariants.ts     # enforces INVARIANTS.md rules in CI
  __tests__/
    verify-deploy.test.ts
    check-health.test.ts
    resolve-image-tag.test.ts
    wait-services-stable.test.ts
```

**Testing:** vitest + `aws-sdk-client-mock`. Zero real AWS calls in tests.

### Workflow Structure

Single workflow `.github/workflows/deploy.yml`. Job graph:

```
test (PR + push)
  └→ build-and-push (main + workflow_dispatch)
       └→ deploy-staging (auto)
            └→ verify-staging
                 └→ deploy-production (environment: production — required reviewer)
                      └→ verify-production
```

**Why a single workflow:** the job graph enforces the promotion invariant (production only after verified staging). Two separate workflows would lose the SHA-to-SHA link between staging and production.

| Job | Permissions | Trigger | Runs |
|-----|-------------|---------|------|
| `test` | `contents: read` | PR + push | `pnpm typecheck && pnpm test:run && pnpm lint-invariants` |
| `build-and-push` | `id-token: write, contents: read` | push main / manual | `configure-aws-credentials` via OIDC + `docker buildx build --build-arg GIT_SHA=${{ github.sha }}` for Dockerfile and Dockerfile.worker |
| `deploy-staging` | `id-token: write` | after build | `cd infra/cdk && npx cdk deploy causeflow-staging -c imageTag=${{ github.sha }} --require-approval never` |
| `verify-staging` | `id-token: write` | after deploy-staging | `tsx infra/scripts/verify-deploy.ts --stage staging --expected-sha ${{ github.sha }} --services api,worker` |
| `deploy-production` | `id-token: write` | after verify-staging **+ env approval** | `cdk deploy causeflow-production -c imageTag=${{ github.sha }}` |
| `verify-production` | `id-token: write` | after deploy-production | `verify-deploy.ts --stage production ...` |

**Environment protection (GitHub UI, not YAML):** `production` with required reviewers = [Vinicius, Sérgio], deployment branches = `main` only.

### Dockerfile Changes

Add at the end of the **runtime stage** (not the builder — preserves pnpm install cache):

```dockerfile
ARG GIT_SHA=unknown
ENV APP_VERSION=${GIT_SHA}
```

Applies to both `Dockerfile` and `Dockerfile.worker`. Worker also receives the ARG even without `/health` — zero cost, and worker stdout logs will include the commit.

**Do NOT** add `ARG BUILD_TIME` — would bust cache on every build with zero value that `git log -1 $SHA` doesn't provide.

### `/health` changes

File: `src/app.ts:63-72`.

**Before:**
```json
{ "status": "ok", "service": "causeflow", "version": "0.1.0", "timestamp": "..." }
```

**After:**
```json
{ "status": "ok", "service": "causeflow", "version": "0.1.0", "commit": "f5ab53b", "timestamp": "..." }
```

`commit` reads from `process.env['APP_VERSION'] ?? 'unknown'`. Field name is `commit` (semantically correct). `version` is untouched (semver from `package.json` — conflating would break any future consumer).

Developer-facing use: `curl https://api-staging.causeflow.ai/health | jq .commit` returns the 7-char SHA of the running image. This is also what `verify-deploy.ts` asserts.

### Hindsight (Sprint 5)

3rd ECS service (`causeflow-${stage}-hindsight`) via CDK uncomment of existing block at `causeflow-stack.ts:411-506`. Image `ghcr.io/vectorize-io/hindsight:latest` pulled from public GHCR. Service discovery via Cloud Map private DNS `${prefix}.local` → `hindsight.causeflow-${stage}.local:8888`. Secret `causeflow-${stage}/hindsight-secrets` already shaped correctly.

**Persistence via EFS (stage-parameterized):**
- **Staging:** EFS One Zone (`oneZone: true`) — reduced durability, ~50% cheaper (~$0.80/mo, 5 GB). Memory bank is recreatable by backend.
- **Production:** EFS Standard (regional, multi-AZ) — max durability. ~$6/mo, 20 GB.
- **Throughput:** Bursting mode (free) in both.
- **Encryption:** `encrypted: true`.
- **Mount target:** one ENI per AZ in `PRIVATE_WITH_EGRESS`.
- **Security group:** EFS SG ingress NFS (2049) only from `hindsightSg`.
- **Removal policy:** `DESTROY` in staging, `RETAIN` in production.
- **Access point:** `/data` scoped to Hindsight container uid/gid (confirm via `docker run ... id`). Without access point the NFS mount can fail with permission denied.

---

## Sprint Decomposition Overview

Five sprints. Each independently verifiable. Later sprints assume earlier ones merged. Full specs live in `sprints/NN-*.md` — executors load only their own sprint, not this PRD.

1. **Sprint 1 — OIDC bootstrap + remove static creds** (60 min, no dependencies)
2. **Sprint 2 — Fix stuck staging stack + simplify CDK** (90 min, depends on S1)
3. **Sprint 3 — TS scripts + Dockerfile args + /health commit + new workflow (staging)** (150 min, depends on S1, S2)
4. **Sprint 4 — Enable Hindsight container (stage-parameterized) + EFS persistence** (120 min, depends on S3)
5. **Sprint 5 — Production bootstrap (AWS CLI + CDK) + promotion gate + invariants** (120 min, depends on S3 and S4)

**Why 5 sprints and not the original 6:** The source plan proposed 6 sprints, but sprints 3 (TS scripts) and 4 (workflow rewrite) have strong coupling — the scripts only exist to power the workflow, and the workflow has nothing to test without the scripts. Merging them gives the execution sprint real end-to-end validation while respecting the 5-sprint cap. The remaining numbering shifts down one.

---

## INVARIANTS Summary

Full machine-verifiable contracts in `INVARIANTS.md`. Enforced by `infra/scripts/check-invariants.ts` in the `test` job:

- **I1** — No static AWS credentials in workflows
- **I2** — All AWS auth uses `role-to-assume`
- **I3** — `continue-on-error` banned in deploy workflows
- **I4** — Task definitions registered only by CDK
- **I5** — `/health` response includes `commit`
- **I6** — No inline `run: |` blocks with > 20 lines in workflows
- **I7** — Naming standardized: only `staging` and `production` (never `prod`)

---

## Risks & Unknowns

### High-impact

- **R1 — Delete-stack may hang on stuck ENIs.** CFN often stalls in VPCs because AWS doesn't clean ECS task ENIs in time. Mitigation: runbook in `infra/cdk/README.md` with `aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=<vpc-id>` + manual detach. 20 min budget.
- **R2 — Route53 A record `api-staging.causeflow.ai` may not be in CDK.** `causeflow-stack.ts:86-94` imports the HostedZone but doesn't create the A record. Risk: after delete+recreate, ALB DNS changes but A record still points at old ALB — `/health` returns 200 from the OLD ALB serving the OLD image, and `verify-deploy.ts` thinks success. Mitigation: Sprint 2 MUST verify how `api-staging.causeflow.ai` resolves before deleting. **Better:** add `ARecord` to CDK during Sprint 2 (5 lines).
- **R3 — ECR lifecycle not in CDK.** Not blocking but noted; images accumulate.
- **R4 — `fromSecretNameV2` generates `??????` ARN suffix which IAM may not match.** De-risk in Sprint 2: after deploying simplified stack, start a task manually and check CloudWatch logs for `ResourceInitializationError: unable to pull secrets`. If it fails, fallback: use `AwsCustomResource` inside CDK for ARN resolution.
- **R5 — Production does not exist.** Sprint 6 now incorporates full AWS CLI bootstrap (estimate up from 60 → 120 min). De-risk: confirm monthly cost (~$115-125 baseline including EFS) with user before Sprint 6; confirm Stripe/Clerk/Langfuse production credentials are available.

### Medium

- **R6 — GitHub environment approval + workflow re-runs.** Re-run triggers new approval. Document in workflow comments.
- **R7 — `services-stable` timeout too short.** ECS can take 4+ min cold start. Start with 600s, tune after monitoring.

### Unknowns

- **U1:** How does `api-staging.causeflow.ai` resolve today? (R2)
- **U2:** Does any IAM resource in `causeflow-staging` conflict with the bootstrap stack? (shouldn't — new role, new name)
- **U3:** Which `imageTag` produced the last known-good staging deploy? Record from ECR console before deleting the stack.

---

## Out of Scope

- **Relay service** (`relay/Dockerfile`): exists but not in pipeline — future initiative.
- **ECR lifecycle rules** (R3): noted but not blocking.
- **Pipeline observability** (deploy frequency, lead time, change failure rate): future initiative.
- **AWS Backup for Hindsight EFS:** not enabled in Sprint 5. For production, consider adding a backup plan in a separate initiative if memory bank becomes investigation-critical.

---

## Verification (end-to-end)

1. **Sprint 1 — OIDC works:** `test-oidc.yml` runs, shows `arn:aws:sts::409171461008:assumed-role/causeflow-github-deploy/...` in logs. `gh secret list` no longer shows AWS keys.
2. **Sprint 2 — Stack clean:** `aws cloudformation describe-stacks --stack-name causeflow-staging --query 'Stacks[0].StackStatus'` returns `UPDATE_COMPLETE`. `curl -s https://api-staging.causeflow.ai/health | jq .status` returns `"ok"`.
3. **Sprint 3 — TS scripts + new workflow:** `pnpm test:run` passes. `docker build --build-arg GIT_SHA=test -t local . && docker run -p 3000:3000 local` + `curl localhost:3000/health` shows `"commit": "test"`. `git push origin main` → GitHub Actions shows 4 green jobs (test, build-and-push, deploy-staging, verify-staging). Time < 15 min. `curl https://api-staging.causeflow.ai/health | jq .commit` == pushed SHA.
4. **Sprint 4 — Hindsight persistence:** `aws servicediscovery list-services` shows `hindsight` in `causeflow-staging.local`. Create memory bank → force-new-deployment → bank survives restart.
5. **Sprint 5 — Production gated:** push to main → staging deploys auto → verify passes → GitHub shows "Review pending deployment" on `deploy-production` → approve via UI → production deploys → `curl https://api.causeflow.ai/health | jq .commit` == correct SHA. Invariants (`check-invariants.ts`) pass on a PR attempting to reintroduce static creds / sed hack / `prod` naming.

---

## Appendix — Negative diff (what gets deleted)

- `deploy.yml`: 182 → ~130 lines (−52 net; 90% of the 130 new lines are `uses:` references)
- Inline bash in workflow: ~90 lines → 0
- Inline python in workflow: ~15 lines → 0
- `causeflow-stack.ts` context-injection: ~12 lines → 1 line
