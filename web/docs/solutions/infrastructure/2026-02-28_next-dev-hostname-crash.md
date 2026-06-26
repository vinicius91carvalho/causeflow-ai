---
title: next dev must use --hostname 127.0.0.1 in PRoot
date: 2026-02-28
category: infrastructure
tags: [next.js, dev-server, proot, arm64, hostname, crash]
app: website, dashboard
severity: high
---

# next dev must use --hostname 127.0.0.1 in PRoot

## Problem

Running `next dev` without specifying a hostname causes the Next.js dev server to crash in PRoot. The crash occurs during network interface enumeration.

## Root Cause

Next.js calls `os.networkInterfaces()` to determine which address to bind to when no hostname is provided. PRoot's virtual network layer does not return a well-formed result, causing Next.js to throw during startup.

## Solution

Always pass `--hostname 127.0.0.1` explicitly:

```bash
# Website dev server:
next dev --hostname 127.0.0.1
# or
next dev -H 127.0.0.1

# Dashboard dev server (different port):
next dev --hostname 127.0.0.1 --port 3001
```

Both `apps/website` and `apps/dashboard` have this flag in their `dev` scripts in `package.json`.

Turborepo commands work correctly:

```bash
pnpm turbo dev  # uses the per-app package.json script which already has the flag
```

## Prevention

- Rule in `MEMORY.md`: "Dev server: always use `next dev --hostname 127.0.0.1`."
- Never edit the `dev` script to remove the `--hostname` flag.
- Ports: website dev=3000, dashboard dev=3001.

## Related

- [`infrastructure/2026-02-28_proot-turbopack-workaround.md`](./2026-02-28_proot-turbopack-workaround.md)
- [`infrastructure/2026-02-28_next-start-cwd-requirement.md`](./2026-02-28_next-start-cwd-requirement.md)
