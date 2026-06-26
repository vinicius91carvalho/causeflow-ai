---
title: next start must run with CWD at the app directory
date: 2026-02-28
category: infrastructure
tags: [next.js, production-server, cwd, next-start, stale-content]
app: website, dashboard
severity: medium
---

# next start must run with CWD at the app directory

## Problem

Running `next start` from the project root (or via `pnpm --filter <app> exec next start`) serves stale or incorrect content. The server starts successfully but responses come from a wrong or stale `.next` build directory.

## Root Cause

`next start` looks for the `.next/` output directory relative to its current working directory. When run from the project root, it finds (or fails to find) a `.next/` at the root level rather than inside `apps/website/` or `apps/dashboard/`. The `pnpm --filter` flag does not change the working directory for the spawned process.

## Solution

Always `cd` into the app directory before running `next start`:

```bash
# Website production server on port 4000:
(cd /root/projects/causeflow-ai/apps/website && exec pnpm exec next start -p 4000 -H 127.0.0.1) &

# Dashboard production server on port 3001:
(cd /root/projects/causeflow-ai/apps/dashboard && exec pnpm exec next start -p 3001 -H 127.0.0.1) &
```

The subshell `(...)` ensures the parent shell's directory is not changed. `exec` replaces the subshell process so signals propagate correctly.

If you find a stale `.next/` directory at the project root, delete it:

```bash
rm -rf /root/projects/causeflow-ai/.next
```

## Prevention

- Never use `pnpm --filter website exec next start` for production servers — use the explicit `cd` pattern above.
- Rule in `MEMORY.md`: "next start must run with CWD at `apps/website`, not project root."

## Related

- [`infrastructure/2026-02-28_next-dev-hostname-crash.md`](./2026-02-28_next-dev-hostname-crash.md)
