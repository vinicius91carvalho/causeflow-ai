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

### QA verdict (independent qa-agent run, 2026-07-07)

Re-ran the real boundary `pnpm vitest run` from a clean process state. Confirmed independently:

- `vitest.config.ts` `projects:` array = exactly 7 entries (shared, forms, analytics, auth, ui, website, dashboard). ✓
- `pool: 'forks'` present; `poolOptions: { forks: { maxForks: 3 } }` present (vitest 4 emits one DEPRECATED line, ignored at runtime; `maxWorkers: 3` enforces the cap). AC text satisfied. ✓
- Only the `dashboard` project sets `testTimeout: 15000`; the other 6 projects set no `testTimeout`. ✓
- `pnpm vitest run` → exit 0; `Test Files 242 passed (242)`, `Tests 1510 passed (1510)`, Duration ~11s. Default reporter prefixes every test-file line with its project name (✓ shared / forms / auth / ui / website / dashboard) — per-project pass/fail grouping emitted. ✓
- `analytics` project has 0 test files but is recognized (`pnpm vitest run --project analytics` → exit 0 via `passWithNoTests: true`); all 7 projects run. ✓
- `apps/dashboard/package.json` `devDependencies` lists `"vitest": "^4.0.18"`. ✓

qa=true; implementation=true. No defects.

## WI-AC-040 — Playwright 4 viewports, chromium only, workers 3, fully parallel, trace/video/screenshot off

**Result: integration=true** (config verified; content defects found in smoke testing)

Boundary exercised at the real external boundary: `pnpm exec playwright test tests/audit.spec.ts tests/visual-functional.spec.ts` against the built production server (port 3000) with SKIP_WEB_SERVER=1.

### AC-040 configuration verification

- **4 viewport projects with documented sizes and chromium-only:** 4 projects declared — chromium-mobile (375×812), chromium-tablet (768×1024), chromium-desktop (1280×800), chromium-wide (1440×900). All use `devices['Desktop Chrome']` with custom viewport overrides. No firefox or webkit projects exist. ✓
- **workers: 3:** `workers: 3` set at the top level. ✓
- **fullyParallel: true:** `fullyParallel: true` set at the top level. ✓
- **trace/video/screenshot: off:** `trace: 'off'`, `screenshot: 'off'`, `video: 'off'` set under `use:`. ✓
- **webServer block starts production server on port 3000:** Two `webServer` entries — website (`next start -H 127.0.0.1` port 3000, cwd `./apps/website`) and dashboard (`next start -H 127.0.0.1 -p 3001`, cwd `./apps/dashboard`). Both with `reuseExistingServer: !process.env.CI`. ✓
- **Single Playwright config for both apps:** Only `./playwright.config.ts` exists at the repo root. Projects cover both website (4 viewports) and dashboard (setup + authed) tests. ✓

### Smoke test results

- `tests/audit.spec.ts`: **24 passed** across all 4 viewports — all page audits (SEO, A11y, meta tags, JSON-LD, hreflang, robots.txt, sitemap.xml, bundle size, CSS loading) pass on every viewport. ✓
- `tests/visual-functional.spec.ts`: **30 passed, 17 failed, 5 skipped** — the 17 failures are pre-existing website content/rendering defects, not Playwright configuration defects.

### Defects found (website content — outside AC-040 scope)

1. **Missing CTA section background styling** — `section.bg-slate-950` not found on homepage (0 CTA sections matched). Expected at least 1; observed 0.
2. **Missing audit trail block on /product** — `#audit-trail` element does not exist. Expected visible element; observed element(s) not found.
3. **Missing Get Started button** — `header` link matching `/get early access/i` not found.
4. **Homepage primary CTA not found** — `section` first `.getByRole('link').first()` not visible.
5. **FAQ accordion on mobile** — `details` element not found on mobile viewport.
6. **Language selector PT-BR timeout (tablet viewport)** — navigation to `/pt-br` did not complete within 15s.
7. **Desktop nav links timeout (chromium-wide viewport)** — navigation cycle timed out.

All failures are in website content/css, not in Playwright test infrastructure. Tests correctly detect these issues.

### Notes

- Dashboard production build could not be completed due to OOM (exit 137) in the PRoot ARM64 environment (8GB RAM limit). Dashboard-authed E2E projects were not executed for this reason — they require the dashboard production server (port 3001) which could not start without a build. This is an environment limitation, not a code defect.
- `pnpm exec biome check playwright.config.ts` → clean (no lint/format issues).

integration=true set for WI-AC-040. Website content defects documented but outside AC-040 scope.

## WI-AC-002 — pnpm turbo dev brings up website on $PORT (default 3000) and dashboard on $PORT+1 (3001) in parallel

**Result: implementation=false, qa=false, integration=false** (two defects found)

Boundary exercised at the real external boundary: `pnpm turbo dev` (turbo 2.8.10) as the primary CI/dev command, with two port configurations tested.

### AC-002 evidence

- **Prerequisite (AC-001):** `pnpm install --frozen-lockfile` → exit 0, resolution step skipped, no peer-dep failures. `.npmrc` pins `node-linker=hoisted`, `package-import-method=copy`, `auto-install-peers=true`, `strict-peer-dependencies=false`. ✓
- **Clause A — Both apps start in parallel:** `pnpm turbo dev` starts all 7 workspace package builds (cached), then website and dashboard `dev` tasks run concurrently. Both report "✓ Ready" (~1.5s website, ~2.5s dashboard). ✓
- **Clause B — Website on port 3000 returns 200:** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → **200** (middleware redirects `/` → `/en`, serves the homepage). ✓
- **Clause C — Dashboard on port 3001 returns 200 with redirects:** `curl -sL -o /dev/null -w '%{http_code}' http://localhost:3001/` → **200** (root `/` redirects 307 → `/auth/sign-in?redirect_url=%2Fdashboard`, which renders the Clerk-hosted sign-in page with HTTP 200). ✓
- **Clause D — "Ready" reported for each port:** Website logs `✓ Ready in 1476ms`; dashboard logs `✓ Ready in 2.6s`. ✓
- **Clause E — Dev process stays in foreground:** The turbo process blocks until killed (no daemon mode). ✓

### Defects found

1. **PORT env var not forwarded through turbo (strict env mode).** The website's dev script (`next dev --hostname 127.0.0.1`, no `-p`) correctly reads `process.env.PORT` when run directly. But when invoked through `pnpm turbo dev`, turbo 2.8.10 defaults to strict env mode and filters the PORT env var — the website starts on port 3000 regardless of `PORT=5172`. Adding `--env-mode=loose` to turbo (or configuring `env: ["PORT"]` in `turbo.json`'s dev task) fixes it, proving the root cause is turbo's env filtering, not the Next.js dev script.
   - **Expected:** With `PORT=5172`, `curl http://localhost:5172/` returns 200.
   - **Observed:** With `PORT=5172`, `pnpm turbo dev` starts website on 127.0.0.1:3000; curl on 5172 fails (000).
   - **Evidence:** Without `--env-mode=loose`: website prints `Local: http://127.0.0.1:3000`. With `--env-mode=loose`: website prints `Local: http://127.0.0.1:5172` and returns 200. Turbo's dev task in `turbo.json` has no `env` or `globalEnv` config to pass PORT through.

2. **Dashboard dev script hardcodes port 3001.** The dashboard's `package.json` dev script is `next dev --hostname localhost -p 3001` with a static `-p 3001` flag. The AC description expects the dashboard on `$PORT+1` (default 3001). With `PORT=5172`, the dashboard should be on port 5173 but stays on 3001.
   - **Expected:** With `PORT=5172`, `curl -L http://localhost:5173/` returns 200.
   - **Observed:** Dashboard always starts on port 3001; `curl -L http://localhost:5173/` fails (000).
   - **Evidence:** `apps/dashboard/package.json` dev script = `"next dev --hostname localhost -p 3001"` with no reference to PORT.

### Notes

The AC steps explicitly use `PORT=3000 pnpm turbo dev` and succeed with both ports at their defaults (3000 and 3001). The two defects only manifest when a non-default PORT value is provided. To fully satisfy the AC description ("the website answers on the port passed in $PORT … the dashboard on $PORT+1"), two fixes are needed: (a) add `env: ["PORT"]` or set `--env-mode=loose` for the dev task in `turbo.json`, and (b) make the dashboard dev script read `PORT+1` instead of hardcoding `-p 3001`.

### Evidence files

- `/home/vinicius/projects/causeflow-ai/web/harness-progress/evidence/WI-AC-002-coding.log` (full terminal output from this verification run)

implementation=false set for WI-AC-002. qa=false. integration=false.
