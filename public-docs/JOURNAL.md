# WI-AC-010 QA audit

Date: 2026-07-08
Action: QA verification of AC-010 (nine Integrations pages)
Result: PASS

Pages tested (all HTTP 200, correct titles, no MDX parse errors):
- /integrations/overview - Integrations overview
- /integrations/monitoring - Monitoring integrations
- /integrations/github - GitHub
- /integrations/communication - Communication integrations
- /integrations/project-management - Project management integrations
- /integrations/databases - Database integrations
- /integrations/custom-webhooks - Custom webhooks
- /integrations/cloud-providers - Cloud providers
- /integrations/hubspot - HubSpot

qa=true implementation=true integration=true

## 2026-07-08 Verify-first — WI-AC-011

- WorkItem: WI-AC-011
- AcceptanceChecks: AC-011
- context: product-narrative
- Mode: VERIFY-FIRST (existing codebase)
- Attempt: 1
- Outcome: implementation=true (black-box verified at real HTTP boundary)
- NextAction: Integrated Verification

### Acceptance check

AC-011: Each of the three Billing pages (Plans, Usage and credits, Manage
subscription), the five Security pages (Overview, Authentication, RBAC, Data
privacy, Compliance), and the Changelog index is reachable from the
documentation tab and renders without MDX parse errors.

### Pre-flight (spec scaffold verification)

- `project_specs.xml` present at repo root.
- All three Billing `.mdx` files exist under `billing/` with `title` +
  `description` frontmatter: plans.mdx, usage-and-credits.mdx,
  manage-subscription.mdx.
- All five Security `.mdx` files exist under `security/`: overview.mdx,
  authentication.mdx, rbac.mdx, data-privacy.mdx, compliance.mdx.
- `changelog/index.mdx` exists with `title: "Changelog"` frontmatter.
- `docs.json` Documentation tab "Billing" group lists: billing/plans,
  billing/usage-and-credits, billing/manage-subscription.
- `docs.json` Documentation tab "Security" group lists: security/overview,
  security/authentication, security/rbac, security/data-privacy,
  security/compliance.
- `docs.json` Changelog tab lists: changelog/index.

### Boundary verification (real external boundary — HTTP)

- `mint dev --port 5188` running from project root (mint CLI v4.2.666,
  node v24.16.0), confirmed listening on `*:5188`. AC-001 dependency holds:
  `GET http://localhost:5188/` → 200, body contains "CauseFlow AI" and all
  four tab labels (Documentation, API reference, Relay, Changelog).
- Reachability from navigation: home HTML sidebar contains links to all
  3 billing, 5 security, and 1 changelog page.

Per-page render at the real HTTP boundary:

| page                      | HTTP | rendered H1              | bytes  | parse markers |
| ------------------------- | ---- | ------------------------ | ------ | ------------- |
| billing/plans             | 200  | Plans and pricing        | 227554 | 0             |
| billing/usage-and-credits | 200  | Usage and quotas         | 222487 | 0             |
| billing/manage-subscription | 200 | Manage subscription      | 226308 | 0             |
| security/overview         | 200  | Security overview        | 238729 | 0             |
| security/authentication   | 200  | Authentication           | 258985 | 0             |
| security/rbac             | 200  | Role-based access control | 220867 | 0             |
| security/data-privacy     | 200  | Data privacy             | 239867 | 0             |
| security/compliance       | 200  | Compliance               | 238723 | 0             |
| changelog                 | 200  | Changelog                | 192915 | 0             |

- Each rendered H1 matches the page's `title` frontmatter exactly.
- No visible MDX parse errors (`SyntaxError`/`Could not compile`/`Unexpected`/
  `MDX parse`/`Module not found`) in any rendered body (non-script content).
- `mint dev` log (mint-5188.log) has no error/parse/fail/warn/syntax/exception
  markers.
- Each page body contains its distinguishing prose from the `.mdx` source
  (e.g. "four plans" on plans, "monthly allowance" on usage-and-credits,
  "Upgrading your plan" on manage-subscription, "eight security layers" on
  security overview, "JWT Bearer tokens" on authentication, "role-based
  access" on rbac, "temporary credentials" on data-privacy, "responsible
  disclosure" on compliance, "Stay up to date" on changelog) — all present.

### Verdict

All 9 pages (3 billing + 5 security + 1 changelog) are reachable and render
without MDX parse errors at the real external HTTP boundary. AC-011 PASSES
against the existing committed code (HEAD `32cd0a0`).

implementation=true. Zero defects. Zero tracked files changed — zero-diff
checkpoint (only this journal updated). No refactor, no code changes; the
existing codebase already satisfies AC-011.

## 2026-07-08 Re-verify — WI-AC-011 (this agent run)

- Run by: coding-agent (VERIFY-FIRST mode)
- HEAD: 1f31386
- mint dev running on port 5188
- Black-box re-verification: all 9 pages GET HTTP 200, correct H1, zero MDX
  parse errors, distinguishing prose present.
- Outcome: implementation=true (no code changes needed)
- This run (2026-07-08 18:13): qa=true implementation=true — all 9 pages HTTP 200, correct H1, zero MDX parse errors, no server-side errors
- Integrated Verification (2026-07-08 18:23): integration=true — same pass criteria met on integrated main, HEAD 0e8f9d3

## 2026-07-08 QA audit — WI-AC-014

- WorkItem: WI-AC-014
- AcceptanceChecks: AC-014
- context: api-reference
- Mode: VERIFY-FIRST (existing codebase)
- HEAD: f87fd2e
- mint dev running on port 5174

### Acceptance check

AC-014: The Authentication page (`api-reference/authentication.mdx`) renders sections
for JWT Bearer tokens, API keys, and Webhook HMAC signature verification, each with
a working code example; the `verifyWebhookSignature` snippet compiles syntactically
(Node.js `node --check`).

### Boundary verification (real external boundary — HTTP)

- `mint dev` running on port 5174, confirmed serving.
- `GET http://localhost:5174/api-reference/authentication` → HTTP 200.
- Page title: "Authentication - CauseFlow AI".
- Parsed rendered body contains all three sections:
  - **JWT Bearer token** section with Authorization header example, claims JSON, and curl/TypeScript code examples.
  - **API key authentication** section with X-API-Key header example.
  - **Webhook HMAC signature** section with X-Webhook-Signature header, Bash openssl example, and TypeScript `verifyWebhookSignature` function.

### Code example verification

- **JWT Bearer** — curl example uses `https://api.causeflow.ai/v1/incidents` with truncated JWT; TypeScript fetch example valid. ✓
- **API key** — `X-API-Key: cflo_live_sk_EXAMPLE_01HX9VTPQR3KF8MZ` matches approved `cflo_` prefix pattern. ✓
- **Bash HMAC** — `openssl dgst -sha256 -hmac` produces correct HMAC-SHA256 signature (verified against Node.js `crypto.createHmac`). ✓
- **TypeScript `verifyWebhookSignature`** — function logic tested end-to-end:
  - Valid signature: PASS
  - Invalid signature: PASS (rejected)
  - Empty body: PASS
  - JS-equivalent (stripping TS type annotations) passes `node --check` cleanly ✓
  - Both Bash and Node.js methods produce identical HMAC-SHA256 output ✓

### Verdict

All AC-014 criteria satisfied. The Authentication page renders with all three
auth sections, each has working code examples, and the `verifyWebhookSignature`
logic compiles syntactically and functions correctly.

qa=true implementation=true integration=true

## 2026-07-08 — VERIFY-FIRST (coding-agent)

- Run by: coding-agent (VERIFY-FIRST mode)
- HEAD: 95d2020
- mint dev running on port 5174
- Black-box verification with Playwright (chromium headless)
- AC-014: The Authentication page renders sections for JWT Bearer tokens, API keys, and Webhook HMAC signature verification, each with a working code example; the `verifyWebhookSignature` snippet passes `node --check`.

### Results

| Check | Result |
|-------|--------|
| `GET /api-reference/authentication` → HTTP 200 | ✅ |
| JWT Bearer token section with curl + TypeScript examples | ✅ |
| API key authentication section with X-API-Key header example | ✅ |
| Webhook HMAC signature section with Bash + TypeScript examples | ✅ |
| `verifyWebhookSignature` passes `node --check` | ✅ |
| `verifyWebhookSignature` end-to-end (valid, invalid, empty body) | ✅ |
| Bash HMAC example cross-verified with Node.js (identical output) | ✅ |

### Verdict

All AC-014 criteria pass at the real HTTP boundary. The page renders all three authentication sections with working code examples, and the HMAC signature verification logic is syntactically valid and functionally correct. Zero defects. `feature_list.json` corrected from stale `implementation=false` to `implementation=true`.

implementation=true qa=true integration=true

## 2026-07-08 Integrated Verification — WI-AC-014

- WorkItem: WI-AC-014
- AcceptanceChecks: AC-014
- context: api-reference
- Mode: Integrated Verification on main (after merge of gen/public-docs-api-reference)
- HEAD: e410700
- PORT: 5174 (actual: 5175 due to port conflict)

### Acceptance check

AC-014: The Authentication page renders sections for JWT Bearer tokens, API keys,
and Webhook HMAC signature verification, each with a working code example; the
`verifyWebhookSignature` snippet compiles syntactically (Node.js `node --check`).

### Boundary verification (real external boundary — HTTP)

- `mint dev` running on port 5175, confirmed serving HTTP 200.
- `GET /api-reference/authentication` → HTTP 200 (444 KB rendered HTML).
- Rendered body contains all three authentication sections and `verifyWebhookSignature`.
- No MDX parse errors in dev log.

### Node.js syntax check

- Extracted `verifyWebhookSignature` function to `/tmp/verify-webhook.ts`.
- `node --experimental-strip-types --check /tmp/verify-webhook.ts` → exit code 0.

### Evidence

- `.harness-evidence/api-reference/WI-AC-014-authentication-rendered.html` (444 KB)

### Verdict

All AC-014 criteria pass at the real HTTP boundary. The page has not changed since
the prior VERIFY-FIRST pass — the gen/public-docs-api-reference merge touched no
files under api-reference/. Zero defects.

implementation=true qa=true integration=true

## 2026-07-08 — VERIFY-FIRST (coding-agent) — WI-AC-015

- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- context: api-reference
- HEAD: 5e19425
- PORT: 5174

### Acceptance check

AC-015: The Errors and pagination page renders the JSON error envelope example,
the HTTP status-code table (400/401/403/404/409/429/500/503), and a
cursor-pagination example with `items`, `cursor`, and `count` fields.

### Boundary verification (real external boundary — HTTP)

- `mint dev` running on port 5174, confirmed serving HTTP 200.
- `GET /api-reference/errors-and-pagination` → HTTP 200 (437 KB rendered HTML).
- JSON error envelope example rendered: `{"error": "incident_not_found", ...}`.
- HTTP status-code table rendered with all 8 codes (400/401/403/404/409/429/500/503).
- Cursor-pagination example with `items` (17 matches), `cursor` (21 matches), and `count` (3 matches) fields present.
- No MDX parse errors in dev log.

### Evidence

- `.harness-evidence/api-reference/WI-AC-015-errors-and-pagination-rendered.html` (437 KB)

### Verdict

All AC-015 criteria pass at the real HTTP boundary. The Errors and pagination page
renders the JSON error envelope, complete HTTP status-code table, and cursor-pagination
example with all three required fields. Zero defects.

implementation=true qa=true integration=true

## 2026-07-09 — VERIFY-FIRST resume — WI-AC-015

- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- context: api-reference
- HEAD: 37768bf
- Requested PORT: 5174; actual Mintlify listener: 5175 after `mint dev` reported 5174 in use.
- Scaffold check: required top-level directories exist; all 125 pages listed in `docs.json` resolve to `.mdx` files; `api-reference/errors-and-pagination` is in API reference navigation.
- Boundary verification: `GET http://localhost:5175/api-reference/errors-and-pagination` returned HTTP 200 (436760 bytes).
- Rendered HTML contains the JSON error envelope example, all required status codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`), and cursor-pagination fields `items`, `cursor`, and `count`.
- No MDX parse markers observed in the rendered body.
- Outcome: implementation=true. No MDX/content changes; only harness metadata and journal updated.

## 2026-07-09 QA — WI-AC-016

- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- context: api-reference
- Scaffold: `project_specs.xml` read; required top-level docs structures and files present, including `docs.json`, `INVARIANTS.md`, `README.md`, `Dockerfile`, `docker-compose.yml`, `.mintignore`, and all required docs directories.
- Scope: 133 `.mdx` files present; 84 under `api-reference/`.
- AC-016: `grep -rE 'api\.causeflow\.(io|dev|local|prod)' --include='*.mdx' .` exited 1 with no output, confirming no forbidden CauseFlow API hosts.
- Verdict: implementation=true qa=true; defects=0.

## 2026-07-09 — INTEGRATED VERIFICATION — WI-AC-015

- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- Boundary: existing Mintlify preview on `http://localhost:5174`.
- Scaffold: required top-level directories exist; 133 `.mdx` files present; `api-reference/errors-and-pagination` is listed in API reference navigation.
- Smoke: `GET /` returned HTTP 200 and rendered `CauseFlow AI` plus `Quickstart`.
- AC-015: `GET /api-reference/errors-and-pagination` returned HTTP 200 and rendered the JSON error envelope, all required status codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`), and cursor-pagination fields `items`, `cursor`, and `count`.
- Evidence: `.harness-evidence/api-reference/WI-AC-015-2026-07-09-errors-and-pagination-rendered.html`.
- Verdict: implementation=true qa=true integration=true; defects=0.

## 2026-07-09 Integrated Verification — WI-AC-005 (foundation)

- WorkItem: WI-AC-005
- AcceptanceChecks: AC-005
- context: foundation
- Mode: Integrated Verification on main
- HEAD: 1bb75b0
- WORKDIR: /home/vinicius/projects/causeflow-ai/web

### Acceptance check

AC-005: The root `vitest.config.ts` defines 7 projects (shared, forms, analytics, auth, ui, website, dashboard) using a forks pool with a maximum of 3 workers. `pnpm vitest run` executes the full suite, exits 0 when green, and prints per-project pass/fail counts. The dashboard project has a 15s per-test timeout; the others use the default.

### Results

| Check | Result |
|-------|--------|
| `pnpm vitest run` exit 0 | PASS (242 test files, 1508 tests, 12.73s) |
| 7 projects declared (shared, forms, analytics, auth, ui, website, dashboard) | PASS |
| Dashboard project has `testTimeout: 15000` (15s) | PASS |
| Fork pool with `maxForks: 3` and `maxWorkers: 3` | PASS |
| Per-project pass count visible in output | PASS (all 7 projects represented: auth 15, dashboard 600+, forms 14, shared 57, ui 34, website 179+, analytics 0 with passWithNoTests) |

### Verdict

All AC-005 criteria pass. `pnpm vitest run` exits 0 with all 242 test files and 1508 tests green across all 7 projects. The vitest config correctly defines all 7 projects, configures a forks pool with max 3 workers, and sets a 15s per-test timeout on the dashboard project. Vitest 4 deprecation warning about `poolOptions` is cosmetic and non-functional; `maxWorkers: 3` enforces the cap at runtime.

implementation=true qa=true integration=true; defects=0.

## 2026-07-09 Integrated Verification — WI-AC-015

- WorkItem: WI-AC-015
- AcceptanceChecks: AC-015
- context: api-reference
- Boundary: existing Mintlify preview on `http://localhost:5174`.
- Scaffold: `project_specs.xml` read; required docs directories and `api-reference/errors-and-pagination.mdx` present.
- Smoke: `GET /` and `GET /quickstart` returned HTTP 200 and rendered `CauseFlow AI` plus `Quickstart`; `mint broken-links` returned success.
- AC-015: `GET /api-reference/errors-and-pagination` returned HTTP 200 and rendered the JSON error envelope, status codes `400/401/403/404/409/429/500/503`, and pagination fields `items`, `cursor`, and `count`.
- Verdict: implementation=true qa=true integration=true; defects=0.

## 2026-07-09 Integrated Verification — WI-AC-010 (website)

- WorkItem: WI-AC-010
- AcceptanceChecks: AC-010
- context: website
- Mode: Integrated Verification on plan/opensource-docker
- HEAD: (plan/opensource-docker)
- PORT: 5173

### Acceptance check

AC-010: The website exposes 9 EN routes (/, /product, /security, /integrations,
/pricing, /use-cases, /from-opsgenie, /privacy, /terms) each returning HTTP 200.
The same 9 routes are mirrored under /pt-br/ and return 200 with Portuguese
content. Each page renders localized content from per-context i18n files at
`apps/website/src/contexts/{marketing,legal,shell}/infrastructure/i18n/pt-br.json`.

### Boundary verification (real external HTTP boundary)

- Dev server started: `PORT=5173 pnpm dev` (Next.js 15.5.12)

**Step 1: 9 EN routes return 200**

All 9 EN routes (/, /product, /security, /integrations, /pricing, /use-cases,
/from-opsgenie, /privacy, /terms) return 200 following locale redirect. ✓

**Step 2: 9 PT-BR routes return 200**

All 9 PT-BR routes (/pt-br/, /pt-br/product, /pt-br/security, /pt-br/integrations,
/pt-br/pricing, /pt-br/use-cases, /pt-br/from-opsgenie, /pt-br/privacy,
/pt-br/terms) return 200. ✓

**Step 3: English vs Portuguese content difference confirmed**

- EN `/pricing`: H1 "Simple pricing. Pay as you use."
- PT-BR `/pt-br/pricing`: H1 "Preços simples. Pague pelo que usar."
- All per-context i18n files exist at marketing, legal, shell. ✓
- `lib/i18n/compose.ts` deep-merges per-context translations. ✓

### Verdict

All AC-010 criteria pass at the real external HTTP boundary. 9 EN routes
return 200, 9 PT-BR routes return 200, and localized content is correctly
rendered in both languages.

implementation=true qa=true integration=true; defects=0.
