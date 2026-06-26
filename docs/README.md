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

## Publishing

Changes pushed to the default branch are deployed automatically via the Mintlify GitHub integration.
