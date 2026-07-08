# CauseFlow AI Documentation

Public documentation for [CauseFlow AI](https://causeflow.ai) — AI-powered incident investigation for Engineering and Support teams.

**Live site:** [docs.causeflow.ai](https://docs.causeflow.ai)

## Structure

```
├── getting-started/     # Quickstart, key concepts, how it works
├── dashboard/           # Dashboard pages and features
├── integrations/        # Monitoring, GitHub, Slack, Jira, databases, etc.
├── billing/             # Plans, usage, subscription management
├── security/            # Auth, RBAC, data privacy, compliance
├── api-reference/       # REST API endpoint documentation
├── relay/               # CauseFlow Relay (privacy-preserving database access)
├── changelog/           # Release notes
├── snippets/            # Reusable MDX snippets
├── docs.json            # Mintlify navigation and site configuration
└── index.mdx            # Homepage
```

## Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) to preview locally:

```bash
npm i -g mint
```

Run at the root of the documentation (where `docs.json` lives):

```bash
mint dev
```

Preview at `http://localhost:3000`.

## Check for broken links

```bash
mint broken-links
```

## Local runtime (Docker)

The canonical way to run the docs site is the open-source local runtime — a
multi-stage Docker image that builds the MDX site with the Mintlify CLI and
serves the static export from a minimal container, with no dependency on the
Mintlify hosting SaaS and no account credentials:

```bash
docker compose up -d
```

The `causeflow-docs` service comes up on `http://localhost:3000` (override the
host port in `docker-compose.yml` if needed). The container carries no `.env`,
no `MINTLIFY_*` env vars, and no deploy token — the only runtime env var is
`PORT` (default `3000`).

To build the image directly:

```bash
docker build . -t causeflow-docs:local
```
