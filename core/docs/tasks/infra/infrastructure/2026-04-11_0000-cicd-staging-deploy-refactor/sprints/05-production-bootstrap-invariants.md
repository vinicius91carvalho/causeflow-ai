# Sprint 5 — Production Bootstrap (AWS CLI + CDK) + Promotion Gate + Invariants

**PRD:** `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md`
**Sprint:** 5 of 5
**Estimated work:** 120 minutes
**Dependencies:** Sprint 3 (new workflow green) + Sprint 4 (CDK stage-parameterized with Hindsight + EFS)
**Isolation:** worktree

---

## Goal

Production is bootstrapped from scratch via AWS CLI + CDK, with all secrets seeded from staging (except JWT and test/dev keys which require manual review). Push to main auto-deploys staging, pauses on approval, then deploys production. Invariants are codified in `INVARIANTS.md` and enforced in CI. Hindsight + EFS come free in production from the stage-parameterized work in Sprint 4 — no new CDK code, just the stack running with `stage='production'`.

## Why this is a standalone sprint

Production bootstrap is destructive and high-stakes. Doing it only after Sprint 4 has proved Hindsight works in staging gives maximum confidence. Bundling the invariants enforcement with this sprint ensures they land before production is live — the moment production exists is the moment the cost of a regression goes up dramatically.

## Bootstrap context (verified live at planning time)

- `aws cloudformation list-stacks` — only `causeflow-staging`. No `causeflow-production`.
- `aws ecs list-clusters` — only `causeflow-staging`.
- `aws secretsmanager list-secrets` — only `causeflow-staging/*`, plus one orphan `causeflow-prod/vapid-keys` with inconsistent naming (CDK uses `causeflow-${stage}` → should be `causeflow-production/`, never `-prod`).

**Naming standard:** use `staging` and `production` in 100% of locations (secret names, CDK stage prop, GitHub environments, Cloud Map namespaces, docs). Zero use of `prod`. Migration of the orphan `causeflow-prod/vapid-keys` → `causeflow-production/vapid-keys` is a required subtask.

## Pre-stack resources (created via AWS CLI before `cdk deploy`)

Imported by CDK via `fromXxxName`:
1. ECR repository `causeflow-production` (imported at `causeflow-stack.ts:33`)
2. DynamoDB table `causeflow-production` (imported at `causeflow-stack.ts:67`)
3. Secrets `causeflow-production/*` (imported via `fromSecretNameV2` helper)

## Stack-owned resources (created by `cdk deploy`, nothing manual)

VPC, subnets, NAT, ACM cert, ECS cluster + services, ALB + target group, SQS queues, CloudWatch log group, IAM roles, Route53 A record (if R2 resolved), Cloud Map namespace `causeflow-production.local` + Hindsight service (from Sprint 4 uncomment), EFS Standard for Hindsight.

## Files to create

- `INVARIANTS.md` — I1 through I7 entries with machine-verifiable contracts
- `infra/scripts/check-invariants.ts` — automation for I1, I3, I4, I6, I7 via `grep`; I2 via YAML parse; I5 via existing `/health` test

## Files to modify

- `.github/workflows/deploy.yml` — add `deploy-production` + `verify-production` jobs with `environment: production`
- `docs/staging-deploy-guide.md` → renamed `docs/deploy-guide.md` OR new `docs/production-deploy-guide.md`; document end-to-end pipeline (staging + production) with 3 ECS services including Hindsight + EFS
- `infra/cdk/lib/causeflow-stack.ts` — add a Route53 `ARecord` if still absent (R2 carry-over)

## Files read-only (reference only)

- `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md` (this PRD)
- Prior sprint outputs as merged to main

## Shared contracts

- GitHub environment `production` MUST have: required reviewers = [Vinicius, Sérgio]; deployment branches = `main` only
- Naming: only `staging` and `production` (enforced by I7)
- All `causeflow-production/*` secrets MUST match the shape of `causeflow-staging/*` — Sprint 4's Hindsight wiring + CDK `taskSecrets` expect identical field names

## Acceptance criteria

### Pre-stack bootstrap via AWS CLI

- [ ] ECR repository `causeflow-production` created (`aws ecr create-repository` with `scanOnPush=true`, `MUTABLE`)
- [ ] DynamoDB table `causeflow-production` created replicating schema from `causeflow-staging` (via `describe-table` → transform → `create-table`)
- [ ] 8 secrets created under `causeflow-production/*` with seed values copied from `causeflow-staging/*` or replaced with live keys where applicable:
  - `jwt-secret` — **new value** (`openssl rand -base64 64`). NEVER copy JWT from staging.
  - `anthropic-api-key` — copy from staging (or production-specific if available)
  - `clerk-secrets` — **review:** if staging uses a Clerk dev instance, create manually with production instance keys; otherwise copy
  - `stripe-secrets` — **review:** if staging uses `sk_test_*`, create manually with `sk_live_*`; otherwise copy
  - `resend-api-key` — copy from staging
  - `vapid-keys` — copy from `causeflow-staging/vapid-keys` (supersedes the orphan `causeflow-prod/vapid-keys`)
  - `langfuse-secrets` — **review:** if staging points at a dev Langfuse project, create with production credentials
  - `hindsight-secrets` — copy from staging (both `HINDSIGHT_API_LLM_API_KEY` + `HINDSIGHT_API_KEY` can be reused)
- [ ] Orphan `causeflow-prod/vapid-keys` deleted after `grep -rn 'causeflow-prod/' .` returns zero references in code

### Stack deployment

- [ ] `cdk deploy causeflow-production -c imageTag=<current-staging-sha>` executed from laptop with admin creds
- [ ] Stack `causeflow-production` reaches `CREATE_COMPLETE`
- [ ] Route53 A record `api.causeflow.ai` created (by CDK if R2 was resolved; otherwise manual via `aws route53 change-resource-record-sets`)
- [ ] All 3 ECS services stable: `causeflow-production` (API), `causeflow-production-worker`, `causeflow-production-hindsight`
- [ ] EFS `causeflow-production-hindsight-fs` mounted on the Hindsight task at `/home/hindsight/.pg0`; Standard mode (multi-AZ). Data persists after manual task restart.
- [ ] `aws servicediscovery list-services` shows `hindsight` in namespace `causeflow-production.local`
- [ ] `curl https://api.causeflow.ai/health` returns 200 with `commit` matching

### Workflow promotion gate

- [ ] GitHub environment `production` configured: required reviewers = [Vinicius, Sérgio], deployment branches = `main` only
- [ ] Workflow has `deploy-production` + `verify-production` jobs with `environment: production`
- [ ] Push to main: staging deploys → verify passes → pauses at approval → approving triggers production → verify passes

### Invariants

- [ ] `INVARIANTS.md` contains entries I1 through I7 (see PRD §"INVARIANTS Summary" and full definitions below)
- [ ] CI step `lint-invariants` runs inside the `test` job
- [ ] `infra/scripts/check-invariants.ts` implemented and tested

### INVARIANTS.md full entries

```markdown
## I1 — No static AWS credentials in workflows
- **Owner:** platform
- **Invariant:** no GitHub workflow references AWS access keys
- **Verify:** `grep -rn 'aws-access-key-id\|AWS_ACCESS_KEY_ID\|aws-secret-access-key\|AWS_SECRET_ACCESS_KEY' .github/workflows/ && exit 1 || exit 0`
- **Fix:** use `aws-actions/configure-aws-credentials` with `role-to-assume` (see Sprint 1 bootstrap stack)

## I2 — All AWS auth uses role-to-assume
- **Owner:** platform
- **Invariant:** every `aws-actions/configure-aws-credentials` step MUST have `role-to-assume` + `aws-region`, MUST NOT have `aws-access-key-id`
- **Verify:** YAML parse in `check-invariants.ts`
- **Fix:** rewrite the offending step to use OIDC

## I3 — continue-on-error banned in deploy workflows
- **Owner:** platform
- **Invariant:** no step in `.github/workflows/deploy.yml` uses `continue-on-error`
- **Verify:** `grep -rn 'continue-on-error' .github/workflows/deploy.yml && exit 1 || exit 0`
- **Fix:** handle errors explicitly in the script or fail the job; never mask
- **Why:** `continue-on-error` is what enabled the sed hack to exist. Close that door.

## I4 — Task definitions registered only by CDK
- **Owner:** infrastructure
- **Invariant:** no workflow or script calls `register-task-definition`
- **Verify:** `grep -rn 'register-task-definition' .github/workflows/ infra/scripts/ && exit 1 || exit 0`
- **Fix:** make the change via `causeflow-stack.ts` and let `cdk deploy` register a new revision

## I5 — /health response includes commit
- **Owner:** app
- **Invariant:** `/health` response body has exactly these keys: `status, service, version, commit, timestamp`
- **Verify:** unit test in `tests/app.test.ts` (or wherever the existing `/health` test lives)
- **Fix:** see Sprint 3 — `src/app.ts` reads `process.env['APP_VERSION']`

## I6 — No inline run blocks over 20 lines in workflows
- **Owner:** platform
- **Invariant:** no `run: |` block in any `.github/workflows/*.yml` exceeds 20 lines
- **Verify:** YAML parse in `check-invariants.ts`, count lines per `run` block
- **Fix:** move logic to `infra/scripts/*.ts` and invoke with `tsx`
- **Why:** prevents the next engineer from sneaking in a 35-line sed hack

## I7 — Naming: only staging and production (never prod)
- **Owner:** platform
- **Invariant:** no file under `.github/workflows/`, `infra/`, `src/`, `docs/` uses the short form `causeflow-prod` (outside `causeflow-production`)
- **Verify:** `grep -rn 'causeflow-prod[^u]' .github/workflows/ infra/ src/ docs/ --include='*.ts' --include='*.yml' --include='*.yaml' --include='*.json' --include='*.md' && exit 1 || exit 0`
- **Fix:** rename to `causeflow-production`
- **Why:** legacy orphan `causeflow-prod/vapid-keys` existed in Secrets Manager. Migrated in this sprint; invariant prevents re-introduction.
```

## Manual steps (human — Vinicius, from laptop with admin credentials)

### 1. ECR repository

```bash
aws ecr create-repository \
  --region us-east-2 \
  --repository-name causeflow-production \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability MUTABLE
```

### 2. DynamoDB table (replicate staging schema)

```bash
# 2a. Dump staging schema
aws dynamodb describe-table \
  --region us-east-2 \
  --table-name causeflow-staging \
  > /tmp/staging-describe.json

# 2b. Transform for create-table
jq '{TableName: "causeflow-production",
     AttributeDefinitions: .Table.AttributeDefinitions,
     KeySchema: .Table.KeySchema,
     GlobalSecondaryIndexes: (.Table.GlobalSecondaryIndexes // [] | map({IndexName, KeySchema, Projection})),
     BillingMode: (.Table.BillingModeSummary.BillingMode // "PAY_PER_REQUEST")}' \
  /tmp/staging-describe.json > /tmp/production-create.json

# 2c. Remove GlobalSecondaryIndexes if empty (create-table rejects empty array) then create
aws dynamodb create-table \
  --region us-east-2 \
  --cli-input-json file:///tmp/production-create.json

# 2d. Wait for ACTIVE
aws dynamodb wait table-exists \
  --region us-east-2 \
  --table-name causeflow-production
```

### 3. Secrets (seeded from staging with manual review)

```bash
# Helper — use individually, never in a blind loop
copy_secret() {
  local name=$1
  local value=$(aws secretsmanager get-secret-value \
    --region us-east-2 \
    --secret-id "causeflow-staging/${name}" \
    --query SecretString --output text)
  aws secretsmanager create-secret \
    --region us-east-2 \
    --name "causeflow-production/${name}" \
    --secret-string "$value"
}

# Safe copies (same values in staging/production per user instruction)
copy_secret anthropic-api-key
copy_secret resend-api-key
copy_secret vapid-keys
copy_secret hindsight-secrets

# JWT: DO NOT copy — generate new
aws secretsmanager create-secret \
  --region us-east-2 \
  --name causeflow-production/jwt-secret \
  --secret-string "$(openssl rand -base64 64)"

# Clerk, Stripe, Langfuse: REVIEW FIRST
# Read causeflow-staging/{clerk-secrets,stripe-secrets,langfuse-secrets}.
# If any is a test/dev credential, create manually with production credential.
# If production-capable, use copy_secret. DO NOT automate.
```

### 4. Delete orphan `causeflow-prod/vapid-keys`

```bash
# Confirm zero references to the legacy naming
grep -rn 'causeflow-prod/' . --include='*.ts' --include='*.json' --include='*.yml'

# If zero results, delete with recovery window
aws secretsmanager delete-secret \
  --region us-east-2 \
  --secret-id causeflow-prod/vapid-keys \
  --recovery-window-in-days 7
```

### 5. CDK deploy

```bash
cd infra/cdk
CURRENT_STAGING_SHA=$(curl -s https://api-staging.causeflow.ai/health | jq -r .commit)
npx cdk deploy causeflow-production -c imageTag=$CURRENT_STAGING_SHA --require-approval never
```

### 6. GitHub environment

In GitHub UI → Settings → Environments → New environment → `production`. Add required reviewers (Vinicius, Sérgio). Restrict deployment branches to `main`.

### 7. Smoke test

```bash
curl -s https://api.causeflow.ai/health | jq
# Expected: { status: "ok", service: "causeflow", commit: "<sha>", ... }

aws ecs describe-services \
  --region us-east-2 \
  --cluster causeflow-production \
  --services causeflow-production causeflow-production-worker causeflow-production-hindsight \
  --query 'services[].[serviceName,runningCount,desiredCount,deployments[0].rolloutState]' \
  --output table
# Expected: runningCount=1, desiredCount=1, rolloutState=COMPLETED for all three
```

## Risks specific to Sprint 5

- **S6-R1 — Secrets diverge between staging/production on third-party keys.** Stripe, Clerk, Langfuse typically have separate test/live keys. User has authorized temporary duplication where production credentials are not available, with disclosure.
- **S6-R2 — Orphan `causeflow-prod/vapid-keys` may have external references.** Mitigation: `grep` check before delete; 7-day recovery window.
- **S6-R3 — Cold start of first production task** is ~4-5 min (ECR pull + Fargate provision + health check grace period). `verify-production` timeout must be ≥ 600s.
- **S6-R4 — Cost.** Production bootstrap adds ~$115-125/mo baseline even without traffic: NAT Gateway ~$32, ALB ~$16, 3 Fargate services ~$60, DynamoDB on-demand nominal, EFS Standard ~$6. **Confirm with user before `cdk deploy`.** Staging adds ~$0.80/mo for EFS One Zone.
- **S6-R5 — Hindsight cold start in production.** First pull of `ghcr.io/vectorize-io/hindsight` is ~500 MB; first task may take 3-4 min beyond grace period plus 5-10s for EFS mount. If `startPeriod: 60s` on the health check is tight, raise to 120s before the production deploy.

## Return format

Report:
- Each manual step's outcome (ECR created, DynamoDB ACTIVE, which secrets copied vs. manual, orphan deleted yes/no)
- `cdk deploy causeflow-production` outcome and elapsed time
- Three services status (`runningCount`, `desiredCount`, `rolloutState`)
- `/health` commit value for production
- First end-to-end promotion run URL (staging auto → approval → production) and timing
- `lint-invariants` CI step result
- Any cost confirmations received from user
- Any manual secret reviews (which ones required live keys)
