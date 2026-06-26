# Sprint 4 — Enable Hindsight Container (Stage-Parameterized) + EFS Persistence

**PRD:** `docs/tasks/infra/infrastructure/2026-04-11_0000-cicd-staging-deploy-refactor/spec.md`
**Sprint:** 4 of 5
**Estimated work:** 120 minutes
**Dependencies:** Sprint 3 (new workflow must be green — this sprint validates the 3rd service deploys through the pipeline)
**Isolation:** worktree

---

## Goal

`causeflow-staging-hindsight` runs as a 3rd ECS service in staging. The app (API + worker) talks to Hindsight over internal Cloud Map DNS. The memory engine is operational with persistence via EFS. **All CDK code is parameterized by `stage` through the existing `prefix = causeflow-${stage}` convention, so the same diff enables production automatically when Sprint 5 runs `cdk deploy causeflow-production`. Nothing to duplicate.**

## Why this is a standalone sprint

The CDK block for Hindsight exists but is commented out. Uncommenting it is one atomic change. Adding EFS persistence in the same sprint is mandatory — without it, the memory bank is lost on every task restart, making the feature useless. Production is explicitly out of scope here; Sprint 5 handles the production bootstrap.

## Technical context

- **Image:** `ghcr.io/vectorize-io/hindsight:latest` (public GHCR pull, no build step needed)
- **CDK block location:** `causeflow-stack.ts:411-506` (commented). 1024 CPU / 2048 MB. Ports 8888 (API) and 9999 (UI). Already uses `${prefix}` in all names and the Cloud Map namespace.
- **Service discovery:** Cloud Map private DNS namespace `${prefix}.local` → `hindsight.causeflow-staging.local:8888`
- **Secret:** `causeflow-staging/hindsight-secrets` already exists. Shape verified: `HINDSIGHT_API_LLM_API_KEY` (Anthropic key used internally by Hindsight) + `HINDSIGHT_API_KEY` (client→Hindsight auth token). Production will have the same shape seeded in Sprint 5.
- **App adapter:** `src/shared/infra/memory/hindsight-agent-memory.ts` — already exists, already graceful-fallbacks on IAM/network errors (commit `b00974b`)
- **App env var:** `HINDSIGHT_BASE_URL` — **already injected** in `sharedEnv` at `causeflow-stack.ts:243`, pointing at `http://hindsight.${prefix}.local:8888`. Nothing to change on the app side.

## Files to modify

- `infra/cdk/lib/causeflow-stack.ts`:
  - Uncomment the Hindsight block (`:411-506`)
  - Add EFS file system + security group + access point + mount point (see sketch below)
  - Uncomment `HINDSIGHT_API_KEY` in the `taskSecrets` map (`:228-229` currently commented)
  - Verify all names still use `${prefix}` (no accidental hardcoded `staging`)
- `docs/staging-deploy-guide.md` — add diagram of the 3 ECS services, EFS layout, Hindsight runbook (restart / backup)
- `infra/cdk/package.json` — only if `aws-cdk-lib/aws-efs` isn't already imported (should be — it's a submodule of the main lib)

## Files read-only (reference only)

- `infra/cdk/lib/causeflow-stack.ts:411-506` — existing commented block
- `infra/cdk/lib/causeflow-stack.ts:203-230` — `taskSecrets` map (to wire `HINDSIGHT_API_KEY`)
- `infra/cdk/lib/causeflow-stack.ts:243` — `sharedEnv` where `HINDSIGHT_BASE_URL` already lives
- `src/shared/infra/memory/hindsight-agent-memory.ts` — adapter (to confirm URL shape)
- `docs/staging-deploy-guide.md` — current env var list (to update)

## Shared contracts

- Service name (Cloud Map): `hindsight` in namespace `causeflow-${stage}.local`
- API + worker consume `HINDSIGHT_BASE_URL = http://hindsight.causeflow-${stage}.local:8888`
- `HINDSIGHT_API_KEY` injected into API and worker task defs via `taskSecrets`
- `HINDSIGHT_API_LLM_API_KEY` injected into the Hindsight task def from the same secret
- EFS file system name: `causeflow-${stage}-hindsight-fs`
- Stage-differentiated settings (single ternary expressions — no stage-specific code paths):
  - `oneZone: stage === 'staging'`
  - `removalPolicy: stage === 'production' ? RETAIN : DESTROY`

## EFS persistence design

Hindsight writes its embedded PostgreSQL to `/home/hindsight/.pg0`. Without a volume, all state is lost on task restart.

- **Staging:** EFS One Zone (`oneZone: true`) — single AZ, reduced durability, ~50% cheaper (~$0.80/mo at 5 GB). Memory bank is recreatable by the backend.
- **Production:** EFS Standard (regional, multi-AZ) — max durability. ~$6/mo at 20 GB.
- **Throughput:** Bursting mode (free default) in both. Hindsight writes are sporadic (reflections, observations), no need for paid Elastic.
- **Encryption:** `encrypted: true` in both.
- **Mount target:** one ENI per AZ in `PRIVATE_WITH_EGRESS`. Free.
- **EFS security group:** ingress NFS (2049) only from `hindsightSg`.
- **Access point:** `/data` mapped to the user/group the Hindsight container runs as. **Must confirm uid/gid before setting** via `docker run --rm --entrypoint sh ghcr.io/vectorize-io/hindsight:latest -c 'id; ls -la /home/hindsight'`. Placeholder uses `uid: '1000', gid: '1000'` — adjust if different.

### CDK sketch (inside the uncommented Hindsight block, right after `hindsightSg`)

```typescript
const hindsightFs = new efs.FileSystem(this, 'HindsightFs', {
  vpc,
  encrypted: true,
  performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
  throughputMode: efs.ThroughputMode.BURSTING,
  oneZone: stage === 'staging',
  removalPolicy: stage === 'production'
    ? cdk.RemovalPolicy.RETAIN
    : cdk.RemovalPolicy.DESTROY,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroup: new ec2.SecurityGroup(this, 'HindsightFsSg', {
    vpc,
    description: `EFS SG for ${prefix}-hindsight`,
    allowAllOutbound: false,
  }),
});
hindsightFs.connections.allowDefaultPortFrom(hindsightSg, 'Allow Hindsight task to mount EFS');

const hindsightAp = hindsightFs.addAccessPoint('HindsightAp', {
  path: '/data',
  createAcl: { ownerUid: '1000', ownerGid: '1000', permissions: '755' },
  posixUser: { uid: '1000', gid: '1000' },
});

hindsightTaskDef.addVolume({
  name: 'hindsight-data',
  efsVolumeConfiguration: {
    fileSystemId: hindsightFs.fileSystemId,
    transitEncryption: 'ENABLED',
    authorizationConfig: { accessPointId: hindsightAp.accessPointId, iam: 'ENABLED' },
  },
});

hindsightTaskDef.findContainer('hindsight')?.addMountPoints({
  containerPath: '/home/hindsight/.pg0',
  sourceVolume: 'hindsight-data',
  readOnly: false,
});

hindsightFs.grant(executionRole, 'elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite');
```

## Pre-sprint de-risk checklist (MUST run before editing CDK)

1. `docker run --rm --entrypoint sh ghcr.io/vectorize-io/hindsight:latest -c 'which curl wget python3; id; ls -la /home/hindsight'`
   - If `curl` absent → replace health check with `wget -qO-` or container-level TCP check
   - Record actual `uid`/`gid` for the EFS access point
2. `docker run --rm -p 8888:8888 ghcr.io/vectorize-io/hindsight:latest` → `curl localhost:8888/health`
   - Confirms the health check endpoint still exists in the current image
3. Review the GHCR README for breaking API changes since the CDK block was written

If any of the three fails, **stop and escalate** — this sprint becomes blocked and Hindsight stays as TODO.

## Acceptance criteria

- [ ] Pre-sprint de-risk checklist completed; findings recorded
- [ ] Block at `causeflow-stack.ts:411-506` uncommented; confirmed all internal names use `${prefix}` (they do — plan verified)
- [ ] `HINDSIGHT_API_KEY` added to the API `taskSecrets` map via `ecs.Secret.fromSecretsManager(hindsightSecrets, 'HINDSIGHT_API_KEY')`
- [ ] Same secret wired into the worker task def (via shared `taskSecrets` map — already the case)
- [ ] `HINDSIGHT_BASE_URL` in `sharedEnv` (`:243`) verified still correct after uncomment
- [ ] Cloud Map private namespace `${prefix}.local` created (will be `causeflow-staging.local`, and later `causeflow-production.local` with zero code change)
- [ ] Hindsight task def health check validated. Current block uses `curl -f http://localhost:8888/health || exit 1`. If `curl` is absent, replaced with `wget -qO-` or TCP health check
- [ ] Security group permits inbound 8888/9999 from API/worker task SGs; outbound `allowAllOutbound: true`
- [ ] EFS file system `causeflow-staging-hindsight-fs` created with `oneZone: true` + `removalPolicy: DESTROY`
- [ ] EFS access point `/data` with uid/gid from the de-risk step
- [ ] EFS security group accepts NFS (2049) only from `hindsightSg`
- [ ] Volume + mount point wired on `hindsightTaskDef` at `/home/hindsight/.pg0`
- [ ] Execution role granted `elasticfilesystem:ClientMount` + `ClientWrite`
- [ ] `cdk deploy causeflow-staging -c imageTag=<sha>` succeeds via the Sprint 4 workflow; `causeflow-staging-hindsight` task reaches `RUNNING`; Cloud Map registers the service
- [ ] **Persistence validated:** create a memory bank via API → `aws ecs update-service --force-new-deployment` → after new task starts, bank still exists
- [ ] API `/health` returns 200 after Hindsight is up; graceful fallback from commit `b00976b` protects against Hindsight unavailability during rollout
- [ ] Manual worker test: trigger an investigation → confirm worker logs show either Hindsight memory usage or explicit fallback
- [ ] `aws servicediscovery list-services --region us-east-2` shows `hindsight` in `causeflow-staging.local`
- [ ] `docs/staging-deploy-guide.md` updated with 3-service diagram, EFS layout, runbook
- [ ] **Stage-agnostic check:** `grep -n '"staging"' infra/cdk/lib/causeflow-stack.ts` returns ONLY the `stage === 'staging'` ternary for EFS (no other hardcode)

## Risks specific to this sprint

- **H1 — `ghcr.io/vectorize-io/hindsight` API drift.** The image may have changed since the block was written. De-risk: pre-sprint checklist step 3. Escalation: block sprint, revert to TODO.
- **H2 — Cloud Map DNS fails to resolve from worker task.** Unlikely: both services land in the same VPC `PRIVATE_WITH_EGRESS`. Confirm during first deploy.
- **H3 — App expects an HTTPS public URL for `HINDSIGHT_BASE_URL`.** De-risk by reading `hindsight-agent-memory.ts` adapter before editing. If it uses a plain HTTP client (axios/fetch), an internal HTTP URL is fine.
- **H4 — Health check endpoint missing.** If `/health` is missing from the current image, the task crash-loops. Pre-sprint checklist step 2 catches this.
- **H5 — EFS permission denied (uid/gid mismatch).** Pre-sprint checklist step 1 captures the real uid/gid. If it's root (uid 0), set `posixUser: { uid: '0', gid: '0' }` and `createAcl: { ownerUid: '0', ownerGid: '0', permissions: '755' }`.
- **H6 — One Zone data loss in staging.** Accepted per instructions (memory bank recreatable). Must be documented in `docs/staging-deploy-guide.md`.
- **H7 — EFS mount adds 5-10s to cold start.** If crash loop on first deploy, raise `healthCheckGracePeriod` from 120s → 180s.

## Return format

Report:
- Pre-sprint de-risk findings: uid/gid, `curl`/`wget` availability, API drift yes/no
- CDK deploy outcome and time
- All three ECS services' `runningCount` / `desiredCount` / `rolloutState`
- Memory bank persistence test result (bank name + "survived restart" yes/no)
- Stage-agnostic grep output (should be one line only)
- Any health check grace period adjustments made
- Blockers encountered; escalation recommendations if any
