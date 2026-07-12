# Getting Started

This guide covers everything you need to get CauseFlow AI running locally.

## Prerequisites

- Node.js >= 24
- pnpm 10.30.1
- Git
- Docker + Compose for the full OSS stack

## Clone and Install

```bash
git clone <repository-url> causeflow-ai
cd causeflow-ai
pnpm install
```

## Environment Setup

Copy the root example file:

```bash
cp .env.example .env.local
```

Optional root values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_CLARITY_ID` | Microsoft Clarity project ID |

For the website app, also copy its env file:

```bash
cp apps/website/.env.example apps/website/.env.local
```

For the dashboard app:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

> **Important:** `.env.staging` and `.env.production` do not exist in this
> project. Hosted deployments inject environment variables through CI; never
> search for or create those files.

The open-source runtime does not require Clerk, Stripe, AWS, Sentry, Loops.so,
or SST variables. The dashboard uses `JWT_SECRET` shared with Core and
`CAUSEFLOW_RUNTIME=oss`; `apps/dashboard/.env.example` contains the defaults.

## Full Docker Stack

From the web repo root:

```bash
docker compose up -d
```

This starts:

| Service | URL |
|---|---|
| Website | `http://127.0.0.1:3000` |
| Dashboard | `http://127.0.0.1:3001` |
| Core API | `http://127.0.0.1:3099` |
| Hindsight | `http://127.0.0.1:8888` |

Set `CORE_CONTEXT=/abs/path/to/core` if Core is not checked out at `../core`.

## Starting Development Servers Without Docker

Start the website only (port 3000):

```bash
pnpm --filter website dev
```

Start the dashboard only (port 3001):

```bash
pnpm --filter dashboard dev
```

Start both apps together:

```bash
pnpm dev
```

## Local URLs

| App | URL |
|---|---|
| Website | `http://127.0.0.1:3000` |
| Dashboard | `http://127.0.0.1:3001` |

## PRoot / ARM64 Container Notes

This project runs on a PRoot/ARM64 environment (Termux on Samsung S24 Ultra). Several constraints apply:

- **Turbopack is disabled.** It crashes in PRoot with "Invalid symlink". All `dev` scripts use Webpack (`next dev`) instead. The `dev:turbopack` script exists for native systems only — do not use it here.
- **Always bind to 127.0.0.1.** The dev server crashes on `os.networkInterfaces()` if the hostname is not explicitly set. All dev scripts already include `--hostname 127.0.0.1`.
- **Port conflicts are common.** If port 3000 is occupied, kill the process first: `fuser -k 3000/tcp` or `pkill -f next-server`.

## Project Structure

```
causeflow-ai/
├── apps/
│   ├── website/             # Next.js marketing site (SSG)
│   └── dashboard/           # Next.js product app (SSR)
├── packages/
│   ├── shared/              # Types, utils, constants, i18n keys
│   ├── ui/                  # Reusable UI components (design system)
│   ├── analytics/           # GA4, Microsoft Clarity, tracking events
│   ├── auth/                # Legacy Auth.js/Cognito helpers
│   └── forms/               # Form logic and validation
├── docs/                    # Project documentation
├── tests/                   # E2E Playwright test files
└── pnpm-workspace.yaml
```

## Next Steps

- See [commands.md](./commands.md) for all available CLI commands
- See [testing.md](./testing.md) for the testing workflow
- See [troubleshooting.md](./troubleshooting.md) for common issues
