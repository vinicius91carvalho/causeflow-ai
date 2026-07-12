# CauseFlow Core Docs — Navigation Index

> Complete technical documentation for the CauseFlow platform — AI-powered investigation for Engineering and Customer Support teams.
> Each file covers one aspect of the system, from the simplest to the most complex.

## Recommended Reading Order

| # | File | What you will learn |
|---|------|---------------------|
| 1 | [01-overview.md](./01-overview.md) | What CauseFlow is, the problem it solves, how it makes money |
| 2 | [02-architecture.md](./02-architecture.md) | Clean Architecture, Modular Monolith, how the layers connect |
| 3 | [03-modules.md](./03-modules.md) | The 10 business modules — what each one does |
| 4 | [04-complete-flow.md](./04-complete-flow.md) | Step by step: from tenant registration to incident resolution |
| 5 | [05-data-model.md](./05-data-model.md) | All entities and persistence models |
| 6 | [06-api-endpoints.md](./06-api-endpoints.md) | All HTTP endpoints, authentication, request/response examples |
| 7 | [07-ai-system.md](./07-ai-system.md) | How AI agents work, models used, tools, costs |
| 8 | [08-security.md](./08-security.md) | JWT, RBAC, HMAC, encryption, STS cross-account, audit trail |
| 9 | [09-aws-infrastructure.md](./09-aws-infrastructure.md) | AWS services, CDK, SQS queues, deployment |
| 10 | [10-local-environment.md](./10-local-environment.md) | How to run locally with Docker OSS runtime |
| 11 | [11-testing.md](./11-testing.md) | 5 levels of testing, how to run them, what each level covers |
| 12 | [12-production-maintenance.md](./12-production-maintenance.md) | Maintenance guide: monitoring, troubleshooting, runbooks |
| 13 | [13-relay-integration.md](./13-relay-integration.md) | Secure database relay: architecture, protocol, agent integration |

## How to Use

- **First time in the project?** Read in order: 01 → 02 → 03 → 04 → 05
- **Need to understand a flow?** Go straight to 04 (complete step-by-step flow)
- **Going to work on a module?** Read 03 to understand the module, then 05 to understand the data
- **Going to debug a production issue?** Start with 12 (maintenance)
- **Want to run locally?** Go to 10 (local environment)
- **Need to understand the AI?** Read 07 (AI system)
- **Setting up for customer support?** Read 03 (modules — Ingestion + Knowledge) then 04 (complete flow)
- **Connecting customer databases?** Read 13 (relay integration)

## Conventions

- All code examples are from the real codebase (with file paths)
- Diagrams use Mermaid for visual rendering on GitHub and IDEs
- When a concept appears for the first time, it is explained right there
