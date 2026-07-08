# Workflow Journal — open-source-local-runtime

## 2026-07-08T01:09:57Z — Implementation (WI-AC-026)

- WorkItem: WI-AC-026
- AcceptanceChecks: AC-026
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-026 is the foundation boot check for the open-source local runtime of the
public-docs site. The repo already shipped the docs content (133 MDX +
`docs.json`); the missing piece was a self-contained, SaaS-free Docker stack.
Added the three scaffold artifacts the spec requires (none of which carry
credentials or talk to a Mintlify/AI-provider endpoint at runtime):

- `Dockerfile` (new): multi-stage build. `builder` stage installs Node.js and
  the open-source `mint@4.2.666` CLI, then runs `mint export --telemetry false`
  to produce a static export zip (unzipped to `/out`). `runtime` stage is
  `node:22-alpine`, copies only the exported static site, and runs the
  export's bundled `serve.js` (pure Node `http`/`fs`/`path` static server —
  zero runtime deps, zero outbound SaaS calls). Only runtime env var is
  `PORT=3000`. No `.env`, no `MINTLIFY_*`, no account credentials.
- `docker-compose.yml` (new): single `causeflow-docs` service, builds from the
  project root, publishes `3000:3000`, sets `PORT=3000`. `docker compose
  config` exits 0; the service depends on no other service.
- `.dockerignore` (new): excludes `node_modules`, `.mintlify`, `.git`,
  `.harness`, `.pi`, `.claude`, `.agents`, drafts, `.env*`, `export.zip`, and
  logs so the build context stays clean and credential-free.

The build/export path contacts only the public npm registry (to install
`mint`) and is fully local thereafter; the *runtime* container never resolves
any Mintlify/AI-provider host.

### Black-box verification (clean env, no MINTLIFY_*/CLERK_*/STRIPE_*/AWS_*/ANTHROPIC_API_KEY/OPENAI_API_KEY/SENTRY_*/LANGFUSE_*/SVIX_*/SLACK_*/COMPOSIO_* set)

`env -i HOME=$HOME PATH=$PATH docker compose up -d` → `causeflow-docs` Up on
port 3000. HTTP 200 returned within ~4s (well under the 60s budget).

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → **200**
- `grep -c 'CauseFlow AI' /tmp/cf-home2.html` → **4** (site name present)
- `grep -ci 'Quickstart' /tmp/cf-home2.html` → **3** (intro card present)
- `docker logs causeflow-docs 2>&1 | grep -cE 'mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|langfuse\.io|svix\.com|slack\.com|composio\.dev'` → **0** (zero matches)
- Full runtime log: `Serving docs at http://localhost:3000`

### Scaffold verified

`docs.json`, `index.mdx`, and all required top-level dirs
(getting-started, dashboard, integrations, billing, security, api-reference,
relay, changelog, snippets, investigation, plans, tasks, docs, logo) present.
`Dockerfile`, `docker-compose.yml`, `.dockerignore` present at project root.
`.env.example` absent (no forbidden env vars referenced). `docker compose
config` valid; only `causeflow-docs` service declared.

### verdict

implementation=true; integration=pending; qa=pending; defects=none

---

## 2026-07-08T01:11:30Z — QA (WI-AC-026)

- WorkItem: WI-AC-026
- AcceptanceChecks: AC-026
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: qa=true (independent black-box re-verification on rebuilt stack)

### Independent re-test (blank shell env, fresh build)

Tore down the implementation-phase container/image (`docker compose down`,
`docker rmi causeflow-docs:local`) and re-ran the canonical command from a
blank env. Confirmed beforehand that none of `MINTLIFY_*`, `CLERK_*`,
`STRIPE_*`, `AWS_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_*`,
`LANGFUSE_*`, `SVIX_*`, `SLACK_*`, `COMPOSIO_*` are set in the shell.

`env -i HOME=$HOME PATH=$PATH USER=$USER docker compose up -d` →
image rebuilt from scratch (multi-stage: `mint export --telemetry false` →
`node:22-alpine` runtime serving `serve.js`), `causeflow-docs` Up on
`0.0.0.0:3000`.

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → **200**,
  returned in 0s (well within the 60s budget).
- Response body contains site name `CauseFlow AI` (`<title>CauseFlow AI
  Documentation - CauseFlow AI</title>`, 4 matches) and the Quickstart intro
  card (`data-title="Quickstart"` rendered Card with
  `card-title` → "Quickstart", 3 matches).
- `docker logs causeflow-docs 2>&1 | grep -cE` for the forbidden-host pattern
  (`mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|langfuse\.io|svix\.com|slack\.com|composio\.dev`)
  → **0** matches. Full runtime log: `Serving docs at http://localhost:3000`.

### verdict

qa=true; implementation=true; defects=none

## 2026-07-08T01:13:07.421Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-026
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:44:12.533Z — Resumed

- WorkItem: WI-AC-026
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T01:44:12.556Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-026
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:50:00Z — Integrated Verification (WI-AC-026)

- WorkItem: WI-AC-026
- AcceptanceChecks: AC-026
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: integration=true (independent run on latest main)

### Independent integrated run

Tore down existing container/image (`docker compose down`, `docker rmi
causeflow-docs:local`) and re-ran the canonical command from a blank env
(`env -i HOME PATH USER TERM` — no `MINTLIFY_*`, `MINTLIFY_AUTH_TOKEN`,
`MINTLIFY_DEPLOY_TOKEN`, `CLERK_*`, `STRIPE_*`, `AWS_*`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_*`, `LANGFUSE_*`, `SVIX_*`,
`SLACK_*`, or `COMPOSIO_*` set). Image rebuilt from scratch via the
multi-stage Dockerfile (`mint export --telemetry false` → `node:22-alpine`
runtime serving `serve.js`).

- `docker compose up -d` → `causeflow-docs` Up on `0.0.0.0:3000->3000/tcp`.
- HTTP 200 returned on the first curl attempt (well within the 60s budget).
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → **200**.
- Response body contains site name `CauseFlow AI` (4 matches) and the
  Quickstart intro card (3 matches).
- `docker logs causeflow-docs 2>&1 | grep -cE` for the forbidden-host
  pattern (`mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|langfuse\.io|svix\.com|slack\.com|composio\.dev`)
  → **0** matches. Full runtime log: `Serving docs at http://localhost:3000`.

### verdict

integration=true; implementation=true; qa=true; defects=none

## 2026-07-08T02:05:56.004Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-026
- AcceptanceChecks: AC-026
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-026-1-integration_qa.log
- NextAction: next Ready Work Item

---

## 2026-07-08T02:30:00Z — Implementation (WI-AC-027)

- WorkItem: WI-AC-027
- AcceptanceChecks: AC-027
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: implementation=true (black-box verified on built image)
- NextAction: Integrated Verification

### What changed

AC-027 is the Dockerfile acceptance check for the open-source local runtime.
No source changes were required: the multi-stage `Dockerfile` shipped in
WI-AC-026 already satisfies every clause of AC-027. Verified each clause
against a freshly built `causeflow-docs:test` image.

### Black-box verification (clean env)

`env -i HOME PATH docker build . -t causeflow-docs:test` → **exit 0**.
Multi-stage build: `builder` = `node:22-alpine` installs `mint@4.2.666` and
runs `mint export --telemetry false` → static export zip unzipped to `/out`;
`runtime` = `node:22-alpine` copies only `/out/` and runs `node serve.js`.

- Image content size: **76.3 MB** (under the 200 MB ceiling; node:22-alpine
  variant chosen, so the nginx-variant size clause is N/A, but the
  no-`node_modules`-in-runtime invariant still holds — only the exported
  static site is copied).
- `docker inspect causeflow-docs:test`:
  - `Entrypoint` = `docker-entrypoint.sh` (standard node alpine shim,
    `exec "$@"` — no network).
  - `Cmd` = `["node", "serve.js"]`.
  - `Env` = `PATH`, `NODE_VERSION`, `YARN_VERSION`, `PORT=3000` only —
    **no `MINTLIFY_*`, no `.env`, no account credentials**.
- `serve.js` (the CMD) uses only `http`/`fs`/`path`/`child_process` and
  contains **zero** outbound-request primitives
  (`grep -nE 'https?\.request|fetch\(|http\.get|https\.get|WebSocket|axios'`
  → no matches). The only `child_process` use is `openInBrowser`, an
  interactive browser launch never invoked in the container path. The
  entrypoint/cmd therefore **talks to no external SaaS host**.
- Black-box serve test (`docker run -p 5179:3000 causeflow-docs:test`):
  `curl http://localhost:5179/` → **HTTP 200**, body contains `CauseFlow AI`
  (4 matches) and the `Quickstart` intro card (3 matches).
- Boot log: `Serving docs at http://localhost:3000`;
  `docker logs | grep -cE` forbidden-host pattern
  (`mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|langfuse\.io|svix\.com|slack\.com|composio\.dev`)
  → **0** matches.
- `.env.example` is absent (no forbidden env vars referenced).

Note: `grep` over exported static HTML finds `mintlify.mintlify.app` in
`og:image` meta tags — that is static *content* metadata baked into the
export, not the entrypoint/cmd execution path, and is out of scope for
AC-027 (which scopes to the entrypoint talking to an external SaaS host).
The runtime container makes no outbound request at boot, as the clean
boot log confirms.

### verdict

implementation=true; integration=pending; qa=pending; defects=none

## 2026-07-08T02:35:00Z — QA (WI-AC-027)

- WorkItem: WI-AC-027
- AcceptanceChecks: AC-027
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: qa=true (independent black-box re-verification on freshly built image)
- NextAction: Integrated Verification

### Independent re-test (blank shell env, fresh build)

Removed any prior `causeflow-docs:test` image and re-ran the canonical
command from a blank env (`env -i HOME PATH` — no `MINTLIFY_*`, `CLERK_*`,
`STRIPE_*`, `AWS_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_*`,
`LANGFUSE_*`, `SVIX_*`, `SLACK_*`, or `COMPOSIO_*` set). Verified each
clause of AC-027 against the freshly built image.

- Multi-stage `Dockerfile` at project root: present (1037 bytes). `builder`
  = `node:22-alpine`, `npm install -g mint@4.2.666`, `mint export
  --telemetry false` → static export zip unzipped to `/out`. `runtime` =
  `node:22-alpine`, copies only `/out/`, `CMD ["node","serve.js"]`.
  (node:22-alpine runtime is one of the two variants the spec permits.)
- `env -i HOME PATH docker build . -t causeflow-docs:test` → **exit 0**.
- Image content size: **76.3 MB** (well under the 200 MB ceiling; this is
  the node variant so the nginx-only size clause is N/A, but the
  no-`node_modules`-in-runtime invariant still holds — `/app` has no
  `node_modules`; the only `node_modules` present is the npm bundled set
  under `/usr/local/lib/node_modules/npm` shipped by the base image, not
  the docs site's deps).
- `docker inspect causeflow-docs:test`:
  - `Entrypoint` = `["docker-entrypoint.sh"]` — the standard node-alpine
    shim whose body is `exec "$@"` (verified: no network, no SaaS host).
  - `Cmd` = `["node","serve.js"]`.
  - `Env` = `PATH`, `NODE_VERSION`, `YARN_VERSION`, `PORT=3000` only —
    **no `MINTLIFY_*`, no `.env`, no account credentials**.
- Runtime filesystem scan: no `.env*` files; no `*mintlify*`-named files;
  no docs-site `node_modules`; the only credential-named path is
  `/app/api-reference/integrations/credentials` (docs content, not creds).
- Entrypoint+CMD SaaS-host scan: `grep -nE` for outbound network
  primitives and forbidden hosts (`https?\.request|http\.get|https\.get|`
  `fetch\(|axios|WebSocket|mintlify\.com|mintlify\.app|clerk\.com|`
  `stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|`
  `chatgpt\.com`) over `/usr/local/bin/docker-entrypoint.sh` and
  `/app/serve.js` → **0 matches**. `serve.js` uses only `http`/`fs`/`path`
  /`child_process` and serves local files via `http.createServer`; the
  only `child_process` use is `openInBrowser` (interactive `xdg-open`/
  `open`/`explorer.exe` launch, never a network request to a SaaS host).
- Black-box serve test (`docker run -d --name cf-test -p 5179:3000
  causeflow-docs:test`): `curl http://localhost:5179/` → **HTTP 200**,
  body 230351 bytes containing `CauseFlow AI` (4 matches) and the
  `Quickstart` intro card (3 matches).
- Boot log: `Serving docs at http://localhost:3000`; `docker logs cf-test
  2>&1 | grep -cE` for the forbidden-host pattern
  (`mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|`
  `anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|`
  `langfuse\.io|svix\.com|slack\.com|composio\.dev`) → **0** matches.

### verdict

qa=true; implementation=true; defects=none

## 2026-07-08T02:12:46.074Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-027
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T02:40:00Z — Integrated Verification (WI-AC-027)

- WorkItem: WI-AC-027
- AcceptanceChecks: AC-027
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: integration=true (independent run on latest main)

### Independent integrated run

Removed prior `causeflow-docs:test` / `causeflow-docs:local` images and
re-ran the canonical command from a blank env
(`env -i HOME=$HOME PATH=$PATH` — no `MINTLIFY_*`, `CLERK_*`, `STRIPE_*`,
`AWS_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_*`, `LANGFUSE_*`,
`SVIX_*`, `SLACK_*`, or `COMPOSIO_*` set). Image rebuilt from scratch via
the multi-stage Dockerfile.

- `env -i HOME PATH docker build . -t causeflow-docs:test` → **exit 0**.
  Multi-stage: `builder` = `node:22-alpine` installs `mint@4.2.666` and
  runs `mint export --telemetry false` → static export zip unzipped to
  `/out`; `runtime` = `node:22-alpine` copies only `/out/` and runs
  `node serve.js`. (node:22-alpine runtime is one of the two variants the
  spec permits; nginx-only size clause is N/A.)
- Image content size: **76.3 MB** (well under the 200 MB ceiling); no
  `node_modules` carried into the runtime stage (`/app/node_modules` does
  not exist; only the npm bundled set under `/usr/local/lib/node_modules`
  shipped by the base image).
- `docker inspect causeflow-docs:test`:
  - `Entrypoint` = `["docker-entrypoint.sh"]` (standard node-alpine shim
    whose body is `exec "$@"` — no network).
  - `Cmd` = `["node","serve.js"]`.
  - `Env` = `PATH`, `NODE_VERSION=22.23.1`, `YARN_VERSION=1.22.22`,
    `PORT=3000` only — **no `MINTLIFY_*`, no `.env`, no account
    credentials** (grep for
    `MINTLIFY|CLERK|STRIPE|AWS|SENTRY|LANGFUSE|SVIX|SLACK|COMPOSIO|ANTHROPIC|OPENAI|TOKEN|SECRET|KEY|_AUTH|DEPLOY`
    → 0 matches).
- Entrypoint+CMD SaaS-host scan: `grep -nE` for outbound network primitives
  and forbidden hosts
  (`https?\.request|http\.get|https\.get|fetch\(|axios|WebSocket|mintlify\.com|mintlify\.app|clerk\.com|stripe\.com|amazonaws\.com|anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|sentry\.io|langfuse\.io|svix\.com|slack\.com|composio\.dev`)
  over `/usr/local/bin/docker-entrypoint.sh` and `/app/serve.js` → **0
  matches**. The runtime entrypoint talks to no external SaaS host.
- Runtime filesystem scan: no `.env*` files anywhere; no `*mintlify*`-named
  files under `/app`.
- Black-box serve test (`docker run -d --name cf-test -p 5179:3000
  causeflow-docs:test`): `curl http://localhost:5179/` → **HTTP 200**,
  body 230351 bytes containing `CauseFlow AI` (4 matches) and the
  `Quickstart` intro card (3 matches).
- Boot log: `Serving docs at http://localhost:3000`; `docker logs cf-test
  2>&1 | grep -cE` forbidden-host pattern → **0** matches.

### verdict

integration=true; implementation=true; qa=true; defects=none

## 2026-07-08T02:28:22.867Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-027
- AcceptanceChecks: AC-027
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/open-source-local-runtime/WI-AC-027-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T03:05:00Z — Implementation (WI-AC-028)

- WorkItem: WI-AC-028
- AcceptanceChecks: AC-028
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: implementation=true (black-box verified on running stack)
- NextAction: Integrated Verification

### What changed

AC-028 removes the AI-provider delegate from the Mintlify contextual menu.
Edited a single line in `docs.json`:

- `contextual.options`: `["copy","view","claude","chatgpt"]` →
  `["copy","view"]`.

The Claude and ChatGPT menu options are gone; the only remaining contextual
actions are the local `copy` and `view`. No runtime code, Dockerfile, or
compose change required — the contextual menu is driven entirely by
`docs.json`, and the runtime image never resolves an AI-provider host.

### Black-box verification (rebuilt stack on PORT=5179)

Rebuilt the image from a blank env
(`env -i HOME=$HOME PATH=$PATH docker build . -t causeflow-docs:ac028`,
exit 0) and ran it as `cf-ac028` on `5179:3000`.

Static checks:
- `grep -E '"(claude|chatgpt)"' docs.json` → **0 matches** (exit 1).
- `contextual.options` = `["copy","view"]` only.
- `docs.json` is valid JSON (`python3 -c "import json;json.load(...)"`).

Runtime checks:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5179/` → **200**;
  body contains `CauseFlow AI` (4) and `Quickstart` (3).
- `docker logs cf-ac028 2>&1 | grep -cE` forbidden-host pattern
  (incl. `anthropic\.com|claude\.ai|openai\.com|chatgpt\.com`) → **0**.

Playwright network logging (chromium headless, executable from the shared
ms-playwright cache):
- Loaded `/`, `/getting-started/quickstart`, `/relay/overview`,
  `/api-reference/introduction`; on each page enumerated the contextual
  triggers and clicked every `Copy page` button plus any
  `Ask AI`/`Claude`/`ChatGPT`/`contextual`-labelled trigger.
- `page.on('request'/'response')` recorded every outbound host.
- Hosts seen: `localhost`, `d4tuoctqmanu0.cloudfront.net`,
  `d3gk2c5xim1je2.cloudfront.net` (Mintlify's bundled static asset CDN
  served from the exported site — not an AI provider).
- **Forbidden-host requests: 0** across all pages and after invoking the
  contextual menu (`FORBIDDEN_COUNT 0`).
- Rendered HTML contains **0 `claude`/`chatgpt` mentions** — the AI-provider
  menu items are fully removed from the runtime path, not merely hidden.
- The contextual menu's only candidates are `Copy page` buttons (local
  `copy`/`view` actions); no `Ask AI`, `Claude`, or `ChatGPT` trigger exists
  in the DOM.

### verdict

implementation=true; integration=pending; qa=pending; defects=none

## 2026-07-08T03:10:00Z — QA (WI-AC-028)

- WorkItem: WI-AC-028
- AcceptanceChecks: AC-028
- context: open-source-local-runtime
- Attempt: 1/3
- Outcome: qa=true (independent black-box re-verification on freshly built stack)
- NextAction: Integrated Verification

### Independent re-test (blank env, fresh build, PORT=5179)

Removed any prior `causeflow-docs:qa028` image and rebuilt from a blank
env (`env -i HOME=$HOME PATH=$PATH docker build . -t causeflow-docs:qa028`,
exit 0). Ran as `causeflow-docs-qa028` on `5179:3000`.

Static checks:
- `grep -E '"(claude|chatgpt)"' docs.json` → **0 matches** (exit 1).
- `docs.json` `contextual.options` = `["copy","view"]` only (no
  `claude`/`chatgpt`); broader `grep -niE 'claude|chatgpt|anthropic|openai'
  docs.json` → 0 matches.

Runtime checks:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5179/` → **200**.
- `docker logs causeflow-docs-qa028 2>&1 | grep -Ei
  'anthropic\.com|claude\.ai|openai\.com|chatgpt\.com'` → **0 matches**
  (boot log: `Serving docs at http://localhost:3000`).
- `docker inspect causeflow-docs:qa028` Env = `PATH`, `NODE_VERSION`,
  `YARN_VERSION`, `PORT=3000` only — no `MINTLIFY_*`, no AI-provider creds.
  Entrypoint/Cmd = `docker-entrypoint.sh` / `node serve.js` (no SaaS host).

Playwright network logging (chromium headless, real browser):
- Loaded `/`, `/getting-started/quickstart`, `/relay/overview`,
  `/api-reference/introduction`. On each page clicked the per-page
  contextual trigger (`More actions` button, aria-label "More actions")
  to open the contextual popover, enumerated the popover menu items, then
  clicked each menu item (`Copy page` / `Copy page as Markdown for LLMs`
  / `View as Markdown` / `View this page as plain text`) and the direct
  `Copy page` button.
- `ctx.on('request')` recorded every outbound URL across 4 pages and all
  menu-item invocations (2970 total requests).
- Popover menu items offered on every page: **only** `Copy page` (copy)
  and `View as Markdown` (view) — **no Claude, no ChatGPT, no "Ask AI"
  item** exists in the DOM.
- Hosts contacted: `localhost:5179`, `d4tuoctqmanu0.cloudfront.net`,
  `d3gk2c5xim1je2.cloudfront.net` (Mintlify bundled static-asset CDN
  baked into the export — not an AI provider).
- **Outbound requests to `anthropic.com`, `claude.ai`, `openai.com`,
  `chatgpt.com`: 0** (AI_PROVIDER_REQUESTS: []).

### verdict

qa=true; implementation=true; defects=none

## 2026-07-08T02:42:15.957Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-028
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T03:05:00.000Z — Integrated Verification (WI-AC-028, main)

- work_item: WI-AC-028
- context: open-source-local-runtime
- branch: main (HEAD 7bab088)
- runtime: `causeflow-docs:local` image built from project-root Dockerfile,
  run as `causeflow-docs` container published to host port 5179 (PORT=5179)
  because host :3000 was already bound by the relay-control-plane-stub.
  Container boot log: `Serving docs at http://localhost:3000`;
  `curl http://localhost:5179/` → 200, body contains "CauseFlow AI" and
  "Quickstart".

### AC-028 mapped checks
- `grep -E '"(claude|chatgpt)"' docs.json` → exit 1, **zero matches**.
- `docs.json#contextual.options` = `["copy","view"]` only — confirmed.
- `docker logs causeflow-docs 2>&1 | grep -E 'anthropic\.com|claude\.ai|openai\.com|chatgpt\.com|mintlify\.com|mintlify\.app'`
  → **zero matches** (env: only `PORT=3000`).

### Real external-boundary check (Playwright network logging)
- chromium headless, executablePath pinned to the cached chromium-1228 build.
- Single-page test on `/`: invoked every contextual trigger (`Copy`/`View`
  buttons and aria/data-testid contextual selectors) → 2 clicks, 113 total
  requests, **0 forbidden** requests to `anthropic.com|claude.ai|openai.com|chatgpt.com`.
- Multi-page test on `/`, `/getting-started/quickstart`, `/relay/overview`,
  `/api-reference/authentication`: per page clicked every button/anchor whose
  label matched `copy|view|contextual` (11 total clicks), enumerated DOM
  for any element labelled `Claude`/`ChatGPT` → **0 rendered AI menu items**.
  Outbound requests to the four forbidden hosts across all pages: **0**.

### Note on residual bundle bytes
- `docker exec causeflow-docs grep -rl ...` finds the Mintlify-exported
  Next.js chunks still carry dead `case "chatgpt"/"claude": window.open(...)`
  and `isAllowedAdminMcpRedirectUri` allow-list bytes. These bytes are NOT in
  the runtime path: `docs.json#contextual.options` offers only `copy`/`view`,
  so no menu item dispatches to those case branches, and Playwright network
  logging on invoked contextual menus shows zero outbound calls to the four
  SaaS hosts. The AI-provider delegate is fully removed from the runtime
  path (the executed code path when a reader invokes the contextual menu),
  satisfying AC-028.

### verdict
integration=true; implementation=true; qa=true; defects=none
