# Workflow Journal

## WI-AC-045 — `.env.example` cleanup for open-source-local-runtime

**State:** `implementation=true`

**Summary:**
- Removed `NEXT_PUBLIC_DASHBOARD_URL` from `apps/website/.env.example` — the AC specifies only the two analytics keys (`NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID`) should ship in the website example file.
- Verified `apps/dashboard/.env.example` already ships with only `CORE_API_URL`, `JWT_SECRET`, and optional `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_ID`.
- Verified no `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST-injected vars in either file (AC-045 Step 1 pass).
- Verified docker-compose.yml mounts the same `JWT_SECRET` default for both `causeflow-api` (line 98) and `causeflow-dashboard` (line 171) — `oss-dev-jwt-secret-change-me` matches the .env.example default (AC-045 Step 3 pass).
- Both apps build successfully after the change.

**Previous blocks:** All prior blocks were caused by the pi adapter's credential configuration (nvidia-nim provider key not recognized), not by code defects. With the correct native provider keys in `auth.json`, the implementation completes cleanly.

---

## QA Verification (WI-AC-045)

**Run by:** qa-agent on 2026-07-08

**Verdict:** `implementation=true, qa=true`

**Checks performed:**

1. **apps/website/.env.example** — PASS
   - Contains exactly `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and `NEXT_PUBLIC_CLARITY_ID` (both blank = optional no-op)
   - No `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST vars
   - `LOOPS_API_KEY` is absent (removed per AC)

2. **apps/dashboard/.env.example** — PASS
   - Contains `CORE_API_URL`, `JWT_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID`
   - `CORE_API_URL=http://causeflow-api:5171` matches docker-compose.yml internal network URL
   - `JWT_SECRET=oss-dev-jwt-secret-change-me` matches docker-compose.yml default for both `causeflow-api` and `causeflow-dashboard`
   - No `CLERK_*`, `STRIPE_*`, `AWS_*`, `SENTRY_*`, `LOOPS_*`, or SST vars

3. **Git tracking** — PASS — Both files tracked and committed as part of WI-AC-045

**Observation (non-blocking):** The project_specs.xml AC-045 description states CORE_API_URL default should be `http://core-api:3099`. The actual docker-compose.yml service is named `causeflow-api` (not `core-api`) and listens on port `5171` internally (port `3099` is the external host binding). The .env.example correctly uses `http://causeflow-api:5171`. This is a spec-text inaccuracy, not a functional defect — the implementation is internally consistent and correct.

---

## WI-AC-004 — Biome 2.4.4 lint+format check exits 0

**State:** `implementation=true`

**Summary:**
- Removed 4 unused `// biome-ignore lint/suspicious/noConsole` suppression comments from test files that had no effect since `suspicious/noConsole` is not enabled in `biome.json`.
- Ran `pnpm exec biome check --write .` to auto-format `feature_list.json` (the single formatting error causing non-zero exit).
- `pnpm exec biome check .` now exits 0 with only warnings (76 remaining, all at `warn` severity from rules deliberately set to warn in `biome.json`).
- `pnpm exec biome check --write .` also exits 0.
- Verified no ESLint/Prettier config files exist anywhere in the repo (AC-004 Step 3 pass).
- `pnpm turbo lint` exits 0 with all 7 tasks successful.

**Changes:**
- `tests/e2e/review/pd-auth-setup.ts` — removed unused suppression comment
- `tests/dashboard/auth-setup.ts` — removed unused suppression comment
- `tests/dashboard/language-selector.spec.ts` — removed unused suppression comment
- `tests/dashboard/theme-language-race.spec.ts` — removed unused suppression comment
- `feature_list.json` — auto-formatted by biome
