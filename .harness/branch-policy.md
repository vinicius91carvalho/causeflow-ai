# Branch policy — Causeflow open-source / Docker plan

Integration branch: `plan/opensource-docker` (also pinned in `.harness/integration-branch`).

## Rules

- Never commit, merge, push, or cherry-pick to `main` or `master` while this plan is in flight.
- Each harness context builds on an isolated `gen/<subproject>-<context>` branch.
- Integrated Verification merges only into `plan/opensource-docker`.
- Goal Review runs on `plan/opensource-docker` after every Work Item is integrated.
- When the plan is complete and Goal Review passes, open one PR from `plan/opensource-docker` → `main`.
