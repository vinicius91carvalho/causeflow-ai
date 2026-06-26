# Sprint 1 — OIDC Bootstrap + Remove Static Credentials

**PRD:** `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md`
**Sprint:** 1 of 6
**Estimated work:** 60 minutes
**Dependencies:** none
**Isolation:** worktree

---

## Goal

GitHub Actions authenticates to AWS via OIDC using a dedicated bootstrap stack `causeflow-bootstrap`. Static AWS credentials are ready to be deleted from the repository.

## Why this is a standalone sprint

The OIDC trust relationship is control-plane. If we entangle it with the app stack (`causeflow-staging`), a single `cdk deploy` failure could lock out all future deploys. Industry pattern: `OpenIdConnectProvider` + deploy role in their own stack, deployed once manually from the laptop with admin credentials, then left alone. Subsequent sprints can assume `vars.DEPLOY_ROLE_ARN` is already set and working.

## Files to create

- `infra/cdk/lib/bootstrap-stack.ts` — CDK construct for `OpenIdConnectProvider` + `Role` (`causeflow-github-deploy`)
- `infra/cdk/bin/bootstrap.ts` — separate CDK app entry point for the bootstrap stack
- `infra/cdk/README.md` — one-time bootstrap instructions for tech lead
- `.github/workflows/test-oidc.yml` — temporary test workflow (deleted at end of sprint)

## Files to modify

- `infra/cdk/cdk.json` — document dual-app or add bootstrap app entry
- `infra/cdk/package.json` — only if a new dependency is required (should not be — `aws-cdk-lib` already has everything needed)

## Files read-only (reference only)

- `infra/cdk/lib/causeflow-stack.ts:155-197` — existing IAM role patterns to mirror style
- `infra/cdk/bin/*.ts` — existing entry point (to reuse env/account handling)
- `.github/workflows/deploy.yml` — to identify which secrets need to be deleted afterwards

## Shared contracts

- Role name MUST be exactly `causeflow-github-deploy` (will be hardcoded in `vars.DEPLOY_ROLE_ARN` and subsequent sprints assume this).
- Role ARN format: `arn:aws:iam::409171461008:role/causeflow-github-deploy`
- Trust policy `sub` claim entries MUST be exactly the three listed below — Sprint 4 workflow relies on these.

## Implementation details

### Trust policy

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

### Inline policy (minimum permissions)

- `ecr:GetAuthorizationToken` on `*` (required by `aws-actions/amazon-ecr-login`)
- `ecr:{PutImage, GetDownloadUrlForLayer, BatchCheckLayerAvailability, BatchGetImage, InitiateLayerUpload, UploadLayerPart, CompleteLayerUpload}` on `arn:aws:ecr:us-east-2:409171461008:repository/causeflow-*`
- `cloudformation:{CreateStack,UpdateStack,DeleteStack,DescribeStacks,DescribeStackEvents,DescribeStackResources,CreateChangeSet,DeleteChangeSet,DescribeChangeSet,ExecuteChangeSet,GetTemplate}` on `arn:aws:cloudformation:us-east-2:409171461008:stack/causeflow-*`
- `ecs:{DescribeServices,DescribeTaskDefinition,DescribeTasks,ListTasks,UpdateService}` (scoped to the cluster via condition)
- `secretsmanager:{ListSecrets,DescribeSecret}` — **NEVER** `GetSecretValue` (blast radius limit)
- `iam:PassRole` on `arn:aws:iam::409171461008:role/causeflow-*-ecs-{execution,task}` with `iam:PassedToService=ecs-tasks.amazonaws.com`
- `sts:AssumeRole` on CDK bootstrap roles `arn:aws:iam::409171461008:role/cdk-hnb659fds-*`
- `s3:{GetObject,PutObject}` on `arn:aws:s3:::cdk-hnb659fds-assets-*/*`
- `logs:{DescribeLogGroups,DescribeLogStreams,GetLogEvents}` on `arn:aws:logs:us-east-2:409171461008:log-group:/ecs/causeflow-*:*`

## Acceptance criteria

- [x] `infra/cdk/lib/bootstrap-stack.ts` exists with `OpenIdConnectProvider` + `Role` with the trust policy above
- [x] `infra/cdk/bin/bootstrap.ts` is a separate entry point
- [x] `infra/cdk/README.md` documents the one-time `cdk deploy causeflow-bootstrap` manual procedure
- [x] Temporary workflow `.github/workflows/test-oidc.yml` runs `aws sts get-caller-identity` via OIDC and prints the assumed role ARN
- [ ] Test workflow passes on a test branch (verified manually by Vinicius) — **BLOCKED: waiting on manual admin `cdk deploy causeflow-bootstrap`**
- [ ] Repo variables set: `AWS_ACCOUNT_ID`, `AWS_REGION`, `ECR_REGISTRY`, `DEPLOY_ROLE_ARN` — **BLOCKED: waiting on human**
- [ ] Repo secrets deleted: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`, `SECRET_ARNS_STAGING` — **BLOCKED: waiting on OIDC validation**
- [ ] Test workflow removed after validation — **BLOCKED: waiting on OIDC validation**

## Agent Notes (Sprint 1 implementation — 2026-04-11)

**Code-level deliverables: DONE.** All 4 source artifacts written, 11 unit tests pass, `pnpm bootstrap:synth` produces valid CloudFormation (verified: `causeflow-github-deploy` role + OIDC custom resource + 5 CfnOutputs + 11 policy statements).

**Files created:**
- `infra/cdk/lib/bootstrap-stack.ts` — `BootstrapStack` class with OIDC provider + deploy role + 11 scoped policy statements
- `infra/cdk/test/bootstrap-stack.test.ts` — 11 unit tests (TDD red-green-refactor) asserting role name, trust policy subjects, per-SID scoping, absence of `GetSecretValue`, and all 5 expected outputs
- `infra/cdk/bin/bootstrap.ts` — separate CDK app entry point, parameterized by context (`awsAccountId`, `awsRegion`, `githubOrg`, `githubRepo`) with CauseFlow defaults
- `infra/cdk/README.md` — one-time bootstrap procedure + post-deploy checklist (set 4 repo variables, validate via `test-oidc.yml`, delete 4 legacy secrets)
- `.github/workflows/test-oidc.yml` — temporary `workflow_dispatch`-only smoke test, uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.DEPLOY_ROLE_ARN }}`; asserts assumed role ARN in the logs

**Files modified:**
- `infra/cdk/cdk.json` — documented dual-app setup in `_comment`
- `infra/cdk/package.json` — added `bootstrap:synth`, `bootstrap:diff`, `bootstrap:deploy` scripts

**Verification run locally:**
- `pnpm exec jest test/bootstrap-stack.test.ts` → 11/11 pass
- `pnpm test` → 27/27 pass (no regression in existing `causeflow-stack.test.ts`)
- `pnpm exec tsc --noEmit` → clean
- `pnpm bootstrap:synth` → valid CloudFormation template, 5 outputs emitted
- Repo-wide `pnpm typecheck` → clean

**Manual steps still pending (Sprint 1 must be human-finished):**
1. On admin laptop: `cd infra/cdk && pnpm install && pnpm bootstrap:deploy`
2. Copy CfnOutputs into GitHub repo **Variables** (not Secrets):
   - `AWS_ACCOUNT_ID=409171461008`
   - `AWS_REGION=us-east-2`
   - `ECR_REGISTRY=409171461008.dkr.ecr.us-east-2.amazonaws.com`
   - `DEPLOY_ROLE_ARN=arn:aws:iam::409171461008:role/causeflow-github-deploy`
3. Push this branch, run `gh workflow run test-oidc.yml --ref feat/sprint-01-oidc-bootstrap`, confirm assumed role ARN in logs
4. `gh secret delete AWS_ACCESS_KEY_ID && gh secret delete AWS_SECRET_ACCESS_KEY && gh secret delete AWS_ACCOUNT_ID && gh secret delete SECRET_ARNS_STAGING`
5. Delete `.github/workflows/test-oidc.yml` and commit

Until step 1 runs, Sprint 2 (`causeflow-staging` unstick) is blocked — it assumes `vars.DEPLOY_ROLE_ARN` is live.

**IAM policy shape (reference for Sprint 3 workflow refactor):** 11 statements, one per SID:
`EcrAuthToken`, `EcrPushPull`, `CloudFormationDeploy`, `EcsReadAndUpdate` (ecs:cluster condition), `EcsDescribeUnscoped`, `SecretsManagerListDescribe`, `SecretsManagerDescribe`, `PassEcsTaskRoles` (PassedToService=ecs-tasks.amazonaws.com), `CdkBootstrapAssume`, `CdkAssetBucketRw`, `LogsRead`. Explicitly does NOT grant `secretsmanager:GetSecretValue` (test enforces this).

## Manual steps (human — Vinicius)

1. On the laptop with admin credentials: `cd infra/cdk && npx cdk deploy causeflow-bootstrap --require-approval never`
2. In GitHub UI (Settings → Secrets and variables → Actions → Variables tab): set the four repo variables
3. Create test branch, push, run `test-oidc.yml`, confirm assumed role ARN appears in logs
4. In GitHub UI: delete the four repo secrets listed above
5. Delete `test-oidc.yml` and push

## Verification

```bash
# From an authenticated test-branch run of test-oidc.yml:
aws sts get-caller-identity
# Expected: Arn contains "assumed-role/causeflow-github-deploy/"

# From the laptop:
gh secret list
# Expected: no AWS_* entries
gh variable list
# Expected: AWS_ACCOUNT_ID, AWS_REGION, ECR_REGISTRY, DEPLOY_ROLE_ARN
```

## Return format

Report:
- Bootstrap stack deploy status (CREATE_COMPLETE)
- Role ARN assumed in test-oidc run
- Repo variables and remaining secrets list
- Confirmation that test workflow was deleted
- Any unexpected IAM issues encountered
