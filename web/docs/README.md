# CauseFlow AI Documentation

Living documentation for the CauseFlow AI monorepo — an AI-powered incident investigation platform.

## Quick Links

| Need | Go To |
|---|---|
| Get started developing | [Getting Started](development/getting-started.md) |
| Understand the architecture | [Architecture Overview](architecture/overview.md) |
| Work on the website | [Website README](apps/website/README.md) |
| Work on the dashboard | [Dashboard README](apps/dashboard/README.md) |
| Deploy to staging/production | [Deployment Overview](deployment/overview.md) |
| Run tests | [Testing Guide](development/testing.md) |
| Fix a common issue | [Troubleshooting](development/troubleshooting.md) |
| Understand the Core API | [Core API Reference](core/core-api.md) |

## Documentation Map

### Architecture
- [Overview](architecture/overview.md) — Monorepo structure, clean architecture, data flow
- [Tech Stack](architecture/tech-stack.md) — Every technology with versions and rationale
- [Bounded Contexts](architecture/bounded-contexts.md) — DDD pattern reference, directory structure, rules

### Apps
- **Website** (marketing site, SSG)
  - [README](apps/website/README.md) — Routes, features, middleware, SEO
  - [Components](apps/website/components.md) — Full component catalog
- **Dashboard** (product app, SSR)
  - [README](apps/dashboard/README.md) — Routes, features, Clerk auth, Stripe billing, 10 bounded contexts
  - [API Reference](apps/dashboard/api-reference.md) — All ~63 API endpoints
  - [Auth Flow](apps/dashboard/auth-flow.md) — Clerk authentication, middleware chain, RBAC
  - [Data Models](apps/dashboard/data-models.md) — Core API entities, domain types

### Core
- [Core API](core/core-api.md) — Backend API reference (incident pipeline, entities, endpoints)

### Packages
- [@causeflow/shared](packages/shared.md) — Types, constants, i18n, utilities
- [@causeflow/ui](packages/ui.md) — Design system, components, themes
- [@causeflow/analytics](packages/analytics.md) — GA4 + Clarity tracking
- [@causeflow/auth](packages/auth.md) — Auth.js v5 + Cognito (legacy — dashboard now uses Clerk directly)
- [@causeflow/forms](packages/forms.md) — Validation + Loops.so

### Deployment
- [Overview](deployment/overview.md) — SST, AWS, environments
- [Website Deploy](deployment/website-deploy.md) — Website CI/CD pipeline
- [Dashboard Deploy](deployment/dashboard-deploy.md) — Dashboard CI/CD pipeline

### Development
- [Getting Started](development/getting-started.md) — Prerequisites, setup, first run
- [Commands](development/commands.md) — All CLI commands
- [Testing](development/testing.md) — Vitest + Playwright
- [Troubleshooting](development/troubleshooting.md) — Common issues and fixes

### Solutions Library
- [Solutions Index](solutions/README.md) — Institutional knowledge base of solved problems
  - [Infrastructure](solutions/infrastructure/) — PRoot workarounds, Playwright ARM64, SST fixes
  - [Patterns](solutions/patterns/) — Auth, staging, bounded contexts, Stripe integration
  - [Bugfixes](solutions/bugfixes/) — Cognito, Playwright, SST, Tailwind fixes
  - [Security](solutions/security/) — CSP headers, security configuration

### Project Context (for AI Assistants)
- [Root CLAUDE.md](../CLAUDE.md) — Global rules, workflow, conventions
- [Website CLAUDE.md](../apps/website/CLAUDE.md) — Website-specific context
- [Dashboard CLAUDE.md](../apps/dashboard/CLAUDE.md) — Dashboard-specific context

### Specs & Plans
- [Website Blueprint](causeflowai-website-blueprint.md) — Marketing site content spec
- [Business Plan](CauseFlow_AI_Business_Plan_v2_2.md) — Business plan v2.2
