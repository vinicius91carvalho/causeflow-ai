# INVARIANTS — CI/CD Staging Deploy Refactor

Machine-verifiable contracts for the cross-cutting concepts of this PRD. Enforced by
`infra/scripts/check-invariants.ts` (implemented in Sprint 5) and run as `pnpm lint-invariants`
in the `test` job of `.github/workflows/deploy.yml`.

All commands assume the repository root is the current working directory.

---

## I1 — No static AWS credentials in workflows

- **Owner:** platform (CI/CD workflows)
- **Preconditions:** every AWS-related step in a workflow MUST use OIDC via `aws-actions/configure-aws-credentials` with `role-to-assume`
- **Postconditions:** no workflow file references GitHub-stored AWS access keys
- **Invariants:** grep returns zero matches for access-key literals under `.github/workflows/`
- **Verify:** `grep -rn 'aws-access-key-id\|AWS_ACCESS_KEY_ID\|aws-secret-access-key\|AWS_SECRET_ACCESS_KEY' .github/workflows/ && exit 1 || exit 0`
- **Fix:** replace the credential block with `aws-actions/configure-aws-credentials` using the OIDC role deployed in Sprint 1 (`arn:aws:iam::409171461008:role/causeflow-github-deploy`)

---

## I2 — All AWS auth uses `role-to-assume`

- **Owner:** platform (CI/CD workflows)
- **Preconditions:** every `aws-actions/configure-aws-credentials` invocation MUST include `role-to-assume` AND `aws-region`
- **Postconditions:** no workflow file configures AWS credentials with static key inputs
- **Invariants:** YAML parse of each workflow file finds zero `aws-actions/configure-aws-credentials` steps missing `role-to-assume` or containing `aws-access-key-id`
- **Verify:** YAML parse check implemented in `infra/scripts/check-invariants.ts`; called via `pnpm lint-invariants`
- **Fix:** rewrite the offending step to use OIDC; if the workflow must run outside the repo context, document the exception and escalate

---

## I3 — `continue-on-error` banned in deploy workflows

- **Owner:** platform (CI/CD workflows)
- **Preconditions:** no step in `.github/workflows/deploy.yml` uses `continue-on-error`
- **Postconditions:** any deploy-step failure is surfaced as a job failure
- **Invariants:** grep for `continue-on-error` in `deploy.yml` returns zero matches
- **Verify:** `grep -rn 'continue-on-error' .github/workflows/deploy.yml && exit 1 || exit 0`
- **Fix:** handle errors explicitly in the script or fail the job. Never mask.
- **Rationale:** `continue-on-error` is what enabled the original sed hack to coexist with a failing `cdk deploy`. Closing that door permanently.

---

## I4 — Task definitions registered only by CDK

- **Owner:** infrastructure (CDK stack)
- **Preconditions:** changes to ECS task definitions happen only through `infra/cdk/lib/causeflow-stack.ts` edits + `cdk deploy`
- **Postconditions:** no out-of-band task def registrations exist
- **Invariants:** no file under `.github/workflows/` or `infra/scripts/` calls `register-task-definition`
- **Verify:** `grep -rn 'register-task-definition' .github/workflows/ infra/scripts/ && exit 1 || exit 0`
- **Fix:** make the change via `causeflow-stack.ts` and let `cdk deploy` generate a new revision on the next run

---

## I5 — `/health` response includes `commit`

- **Owner:** app (`src/app.ts`)
- **Preconditions:** app boots with `APP_VERSION` env var set (via Dockerfile `ARG GIT_SHA`)
- **Postconditions:** `GET /health` returns a JSON body containing exactly the keys `status, service, version, commit, timestamp`
- **Invariants:** unit test in `tests/app.test.ts` (or wherever the existing `/health` test lives) asserts the full shape; `commit` is a non-empty string
- **Verify:** `pnpm test:run --filter '/health'` exits 0 AND the assertion asserts the `commit` key
- **Fix:** see Sprint 3 — `commit: process.env['APP_VERSION'] ?? 'unknown'`

---

## I6 — No inline `run:` blocks over 20 lines in workflows

- **Owner:** platform (CI/CD workflows)
- **Preconditions:** complex logic lives in `infra/scripts/*.ts` invoked via `tsx`
- **Postconditions:** workflow YAML is glue-only; every `run: |` block fits in under 20 lines
- **Invariants:** YAML parse of each `.github/workflows/*.yml` finds zero `run` blocks with > 20 lines
- **Verify:** implemented in `infra/scripts/check-invariants.ts` (YAML parse + line count per block)
- **Fix:** extract the logic into a new `infra/scripts/*.ts` file; call it via `tsx infra/scripts/<script>.ts`
- **Rationale:** prevents any future engineer from sneaking in a 35-line sed hack again

---

## I7 — Naming: only `staging` and `production` (never `prod`)

- **Owner:** platform + infrastructure
- **Preconditions:** all stage identifiers across workflows, CDK, app code, and docs MUST use the full word `staging` or `production`
- **Postconditions:** no file uses the short form `causeflow-prod` (outside `causeflow-production`)
- **Invariants:** grep for `causeflow-prod[^u]` in `.github/workflows/`, `infra/`, `src/`, `docs/` returns zero matches
- **Verify:** `grep -rn 'causeflow-prod[^u]' .github/workflows/ infra/ src/ docs/ --include='*.ts' --include='*.yml' --include='*.yaml' --include='*.json' --include='*.md' && exit 1 || exit 0`
- **Fix:** rename to `causeflow-production`. If an AWS resource was already created with the legacy name, migrate via Sprint 5's runbook (create new, deprecate old, update consumers).
- **Rationale:** a legacy orphan `causeflow-prod/vapid-keys` existed in Secrets Manager with inconsistent naming. Sprint 5 migrates it; I7 prevents reintroduction.

---

## Cascading

No project-level `INVARIANTS.md` exists at the repo root today. At the end of Sprint 5, the
project-level `INVARIANTS.md` should either (a) adopt these entries directly, or (b) include
this PRD-level file by reference. Sprint 5 includes that decision as a task.
