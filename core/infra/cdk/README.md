# CauseFlow CDK

This directory owns two CDK apps:

| Entry point          | Stack(s)                          | When to deploy                                                              |
| -------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `bin/bootstrap.ts`   | `causeflow-bootstrap`             | **Once, manually** with admin credentials. Creates OIDC provider + role.    |
| `bin/causeflow.ts`   | `causeflow-staging`, `causeflow-production` | Every build, via GitHub Actions, using the OIDC role created by bootstrap.  |

The two apps are separated intentionally: the bootstrap stack is control-plane
(it creates the very role that deploys everything else). If we entangled it with
the app stack, one failed `cdk deploy` could lock out all future deploys.

---

## One-time bootstrap (tech lead / Vinicius only)

**Prerequisite:** local AWS credentials with admin permissions for account
`409171461008`. Use `aws sts get-caller-identity` to confirm before proceeding.

```bash
cd infra/cdk
pnpm install

# 1. Review the diff first
pnpm bootstrap:synth
pnpm bootstrap:diff   # expect "no stacks found" on the first run — that's fine

# 2. Deploy the bootstrap stack
pnpm bootstrap:deploy
# Or explicitly:
#   npx cdk --app 'npx ts-node --prefer-ts-exts bin/bootstrap.ts' \
#     deploy causeflow-bootstrap --require-approval never
```

CloudFormation will print 5 outputs. Copy them into GitHub:

> Repository → Settings → Secrets and variables → Actions → **Variables tab**

| Variable          | Value (example)                                                            |
| ----------------- | -------------------------------------------------------------------------- |
| `AWS_ACCOUNT_ID`  | `409171461008`                                                             |
| `AWS_REGION`      | `us-east-2`                                                                |
| `ECR_REGISTRY`    | `409171461008.dkr.ecr.us-east-2.amazonaws.com`                             |
| `DEPLOY_ROLE_ARN` | `arn:aws:iam::409171461008:role/causeflow-github-deploy`                   |

### Validate OIDC works from GitHub Actions

1. Check out a test branch: `git checkout -b test/oidc`
2. Push the temporary workflow `.github/workflows/test-oidc.yml` (it is included in Sprint 1 and deleted afterwards)
3. Trigger it via `gh workflow run test-oidc.yml --ref test/oidc`
4. Confirm the run logs `Arn: arn:aws:sts::409171461008:assumed-role/causeflow-github-deploy/...`

### Delete legacy static credentials (only after OIDC is confirmed working)

```bash
gh secret delete AWS_ACCESS_KEY_ID
gh secret delete AWS_SECRET_ACCESS_KEY
gh secret delete AWS_ACCOUNT_ID          # redeclared as a variable above
gh secret delete SECRET_ARNS_STAGING     # no longer needed — resolved at runtime
```

Then delete the temporary test workflow:

```bash
git rm .github/workflows/test-oidc.yml
git commit -m "chore(ci): remove test-oidc workflow after OIDC validation"
git push
```

---

## Day-to-day app deploys

GitHub Actions handles these automatically on push to `main`. The workflow
assumes `vars.DEPLOY_ROLE_ARN` via `aws-actions/configure-aws-credentials@v4`
with `role-to-assume` — no static keys live in the repo.

Manual synth/diff from your laptop (read-only, safe):

```bash
pnpm synth    # causeflow.ts → causeflow-staging
pnpm diff
```

---

## Re-deploying the bootstrap stack

Only needed if:

- You rotate the list of allowed GitHub subjects (trust policy)
- You add a new IAM permission to the deploy role
- You change the region or account ID

Each of these is a control-plane change. Run `pnpm bootstrap:diff` first,
review the plan carefully, then `pnpm bootstrap:deploy`.

**Never** put bootstrap deploys into a workflow — the deploy role is the
chicken-and-egg dependency that makes every other workflow work.
