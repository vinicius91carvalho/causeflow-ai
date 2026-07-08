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
