# testing_and_observability workflow journal

## WI-AC-039 — Verify-first (testing_and_observability)

**Result: implementation=true** (3-file minimal diff; root-cause fixes only)

Boundary exercised at the real external boundary: `pnpm vitest run` (vitest 4.0.18) against the committed root `vitest.config.ts` + `apps/dashboard/package.json`. AC-039 is a test-runner config AC; its real boundary is the vitest invocation (not an HTTP/browser boundary), so the dev server on port 5175 is not relevant to this AC.

### AC-039 evidence (after fix)

- **Clause 1 — 7 projects:** `vitest.config.ts` `projects:` defines exactly `shared`, `forms`, `analytics`, `auth`, `ui`, `website`, `dashboard` (grep `name:` → 7). ✓
- **Clause 2 — `pool: 'forks'` + `poolOptions: { forks: { maxForks: 3 } }`:** both set at the top-level `test:` block (L73 `pool: 'forks'`, L78 `poolOptions: { forks: { maxForks: 3 } }`). ✓
- **Clause 3 — dashboard `testTimeout: 15000`, others default:** only one `testTimeout` key exists in the file (L69), inside the `dashboard` project block = `15000`. The other 6 projects set no `testTimeout` (inherit the default). ✓
- **Clause 6 — `pnpm vitest run` runs all 7 + per-project pass/fail summary:** `pnpm vitest run` → **exit 0**; `Test Files 242 passed (242)`, `Tests 1510 passed (1510)`, Duration ~11s. The default reporter emits a per-project pass/fail grouping — every test-file line is prefixed with its project name (`✓ shared …`, `✓ forms …`, `✓ auth …`, `✓ ui …`, `✓ website …`, `✓ dashboard …`). `analytics` has 0 test files but is a recognized project (`pnpm vitest run --project analytics` → exit 0 via `passWithNoTests: true`), so all 7 projects run. ✓
- **Clause 7 — `apps/dashboard/package.json` lists `vitest` as a dev dependency:** added `"vitest": "^4.0.18"` to `devDependencies` (matches the root's pinned `vitest@^4.0.18`, resolves to the already-hoisted 4.0.18). `pnpm install --frozen-lockfile` → exit 0 (lockfile consistent). ✓

### Defects found in the existing code (root-cause fixes)

1. `poolOptions: { forks: { maxForks: 3 } }` was absent — the config used `maxWorkers: 3` only. AC-039 step 2 explicitly requires the `poolOptions: { forks: { maxForks: 3 } }` key. Fixed by adding it.
2. The dashboard project set `testTimeout: 60000`; AC-039 requires `15000`. Changed to `15000`. Verified safe: the slowest dashboard test (`checkout-complete-handler.test.ts`) runs in ~5.5s, well under 15s; the full suite still passes 1510/1510.
3. `apps/dashboard/package.json` did not list `vitest` as a dev dependency. Added `"vitest": "^4.0.18"`.

### Known spec inconsistency (documented, not "fixed" away)

Vitest 4.0.18 (the version pinned in the spec's tech stack and lockfile) removed `test.poolOptions`; the AC's required `poolOptions: { forks: { maxForks: 3 } }` is vitest-3 syntax. Vitest 4 prints one `DEPRECATED` stderr line when the key is present and ignores it for enforcement, reading `maxWorkers` instead. To satisfy the literal AC text (step 2 is a config-text check) AND preserve the working max-3 cap at runtime, both keys are kept: `poolOptions` satisfies the AC text; `maxWorkers: 3` enforces the cap under vitest 4. The deprecation line does not fail any AC clause (the run exits 0 and emits the per-project summary). This is the smallest diff that satisfies the AC; diverging to `maxWorkers`-only would fail the literal step-2 text check.

### Notes

- `pnpm exec biome check vitest.config.ts` → clean (no fixes applied).
- `pnpm install --frozen-lockfile` → exit 0 (lockfile updated minimally: only the `apps/dashboard` importer section adds the `vitest` specifier resolving to the already-installed 4.0.18; no new packages downloaded).
- Diff: `vitest.config.ts` (+7/-4), `apps/dashboard/package.json` (+1 line), `pnpm-lock.yaml` (+3 lines). No refactor/rewrite of working test or app code.
- Evidence: `/home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/testing_and_observability/WI-AC-039-1-coding.log`.

implementation=true set for WI-AC-039.
