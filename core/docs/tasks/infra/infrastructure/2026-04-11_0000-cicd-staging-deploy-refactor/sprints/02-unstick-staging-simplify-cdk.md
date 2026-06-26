# Sprint 2 — Fix Stuck Staging Stack + Simplify CDK

**PRD:** `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md`
**Sprint:** 2 of 6
**Estimated work:** 90 minutes (most of which is waiting for CloudFormation delete + recreate)
**Dependencies:** Sprint 1 (bootstrap stack deployed, OIDC role available)
**Isolation:** worktree

---

## Goal

`causeflow-staging` is in a clean `UPDATE_COMPLETE` state. CDK is the single owner of task definitions. The context-injection of pre-resolved secret ARNs is removed — CDK resolves ARNs itself via `Secret.fromSecretNameV2`.

## Why this is a standalone sprint

The stack cannot be moved forward until it's unstuck. The context-injection removal is coupled because once we trust `fromSecretNameV2`, the workflow workaround that pre-computed ARNs becomes both unnecessary and confusing. Doing both in one sprint avoids leaving the stack in a half-state where some secrets are CDK-resolved and others are context-injected.

## Files to modify

- `infra/cdk/lib/causeflow-stack.ts`:
  - Remove `:37-46` context-injection block for `secretArns`
  - Simplify the `importSecret` helper to a single `fromSecretNameV2` call
  - (If R2 resolves favorably) add a Route53 `ARecord` for `api-staging.causeflow.ai` pointing at the ALB (~5 lines)

## Files read-only (reference only)

- `infra/cdk/lib/causeflow-stack.ts:33` — ECR `fromRepositoryName` import (confirms ECR survives delete)
- `infra/cdk/lib/causeflow-stack.ts:67` — DynamoDB `fromTableName` import (confirms DynamoDB survives delete)
- `infra/cdk/lib/causeflow-stack.ts:164` — comment flagging `fromSecretNameV2` suffix caveat
- `infra/cdk/lib/causeflow-stack.ts:165-170, 179-184` — existing explicit wildcard ARN grants (compensate for R4)
- `infra/cdk/lib/causeflow-stack.ts:203-230` — `taskSecrets` map (to confirm no behavior change needed)
- `infra/cdk/lib/causeflow-stack.ts:86-94` — HostedZone import (for R2 Route53 decision)
- `.github/workflows/deploy.yml:106-124` — ARN resolution step (to be deleted by Sprint 4, but noted here for R4 de-risk context)

## Shared contracts

- After this sprint the stack must still produce containers named `causeflow` (API) and `investigation-worker` (worker). These names are **load-bearing** — downstream scripts and dashboards reference them.
- After this sprint, no workflow file or script reads `SECRET_ARNS_STAGING` or accepts `-c secretArns=...`. The contract is: "CDK resolves its own secret ARNs."

## Acceptance criteria

- [ ] **U3 captured first:** record the `imageTag` of the last known-good deploy from ECR console *before* any destructive action
- [ ] **R2 resolved first:** verify how `api-staging.causeflow.ai` resolves today (`dig api-staging.causeflow.ai`). If it's a manual Route53 record, record the current ALB DNS and either (a) add a CDK `ARecord` in this sprint or (b) plan to recreate manually after the new ALB exists
- [ ] `aws cloudformation delete-stack --stack-name causeflow-staging` executed
- [ ] If delete hangs on ENIs: runbook from `infra/cdk/README.md` followed (`aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=<vpc-id>` + manual detach) — 20 min budget
- [ ] Stack reaches `DELETE_COMPLETE`
- [ ] `infra/cdk/lib/causeflow-stack.ts:37-46` context-injection block removed
- [ ] `importSecret` helper reduced to a single-line `fromSecretNameV2` call
- [ ] `cd infra/cdk && npx cdk diff causeflow-staging -c imageTag=<known-good-sha>` shows expected resources to create (basically the full stack since it was deleted)
- [ ] `npx cdk deploy causeflow-staging -c imageTag=<known-good-sha>` from laptop completes with `CREATE_COMPLETE`
- [ ] New task def revisions registered by CDK
- [ ] ECS services stabilize: API shows `runningCount=desiredCount`, worker has `rolloutState: COMPLETED`
- [ ] `curl https://api-staging.causeflow.ai/health` returns 200 (**note:** verify this hits the NEW ALB — check `dig api-staging.causeflow.ai` matches the new ALB DNS; R2 mitigation)
- [ ] **R4 de-risk:** CloudWatch logs for the new tasks show NO `ResourceInitializationError: unable to pull secrets`. If present, fallback to `AwsCustomResource` ARN resolution inside CDK.

## Manual steps (human — Vinicius)

1. From ECR console: note current image tag serving staging (for known-good redeploy)
2. `dig api-staging.causeflow.ai` — capture current ALB target
3. `aws cloudformation delete-stack --region us-east-2 --stack-name causeflow-staging`
4. Monitor: `aws cloudformation describe-stack-events --region us-east-2 --stack-name causeflow-staging` (expect ~10-15 min)
5. If stuck on ENIs: `aws ec2 describe-network-interfaces --region us-east-2 --filters Name=vpc-id,Values=<vpc-id> Name=status,Values=available` → detach any stale
6. After `DELETE_COMPLETE`: `cd infra/cdk && npx cdk deploy causeflow-staging -c imageTag=<known-good-sha>`
7. `curl https://api-staging.causeflow.ai/health` + verify DNS alignment
8. Check CloudWatch logs for the two ECS services for ~5 minutes — confirm no secret pull errors

## Risks addressed in this sprint

- **R1** — ENI stall on delete-stack: runbook budget included
- **R2** — Route53 A record unmanaged: resolved before any destructive action
- **R4** — `fromSecretNameV2` ARN suffix quirk: explicitly de-risked by reading CloudWatch after first task start

## Return format

Report:
- Pre-delete state: known-good `imageTag`, `dig` output for `api-staging.causeflow.ai`
- Delete-stack outcome and elapsed time
- Deploy outcome (stack status, task def revision numbers)
- `/health` verification result
- R4 check: any `ResourceInitializationError` in CloudWatch? Yes/No
- R2 decision: was the Route53 A record added to CDK or recreated manually?
- Net diff size on `causeflow-stack.ts`
