# Getting Started

This guide covers everything you need to get CauseFlow AI running locally.

## Prerequisites

- Node.js >= 24
- pnpm 10.30.1
- Git

## Clone and Install

```bash
git clone <repository-url> causeflow-ai
cd causeflow-ai
pnpm install
```

## Environment Setup

Copy the root example file and fill in your values:

```bash
cp .env.example .env.local
```

Required values in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Microsoft Clarity project ID |
| `LOOPS_API_KEY` | Loops.so API key (optional for local development) |

For the website app, also copy its env file:

```bash
cp apps/website/.env.example apps/website/.env.local
```

For the dashboard app:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

> **Important:** `.env.staging` and `.env.production` do not exist in this project. SST injects stage-specific environment variables at deploy time via `sst.config.ts`. Never search for or create these files.

## Starting Development Servers

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
│   ├── auth/                # Authentication: Auth.js v5, Cognito OIDC
│   └── forms/               # Form logic and validation
├── docs/                    # Project documentation
├── tests/                   # E2E Playwright test files
└── pnpm-workspace.yaml
```

## Next Steps

- See [commands.md](./commands.md) for all available CLI commands
- See [testing.md](./testing.md) for the testing workflow
- See [troubleshooting.md](./troubleshooting.md) for common issues
