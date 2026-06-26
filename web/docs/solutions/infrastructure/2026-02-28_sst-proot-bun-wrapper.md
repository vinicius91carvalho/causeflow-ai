---
title: SST bun wrapper for PRoot — copyfile backend
date: 2026-02-28
category: infrastructure
tags: [sst, bun, proot, arm64, deployment, eacces]
app: website, dashboard
severity: high
---

# SST bun wrapper for PRoot — copyfile backend

## Problem

SST v3's bundled `bun` binary fails with `EACCES` (permission denied) when running inside a PRoot container. This blocks all local `sst deploy` commands.

## Root Cause

PRoot emulates root-level access but some syscalls (especially those that set file permissions or use `reflink` copy operations) are not fully supported. Bun's default file copy backend uses `reflink` which fails in PRoot.

## Solution

Create a wrapper script at `~/.config/sst/bin/bun` that delegates to `bun-real` using the `--backend=copyfile` flag, which avoids `reflink`:

```bash
# ~/.config/sst/bin/bun
#!/bin/bash
exec ~/.bun/bin/bun-real --backend=copyfile "$@"
```

Also run `npm install --legacy-peer-deps` inside `.sst/platform/` if the platform dependencies are stale.

Check the wrapper is in place before any local deploy:

```bash
cat ~/.config/sst/bin/bun
# Should show: exec ... --backend=copyfile ...
```

## Prevention

- If `sst deploy` fails with `EACCES` or `bun` errors, the wrapper is the first thing to check.
- Rule added to `MEMORY.md`: "PRoot bun workaround: Wrapper at `~/.config/sst/bin/bun` delegates to `bun-real` with `--backend=copyfile`."

## Related

- [SST v3 Installation](https://sst.dev/docs)
- [`docs/deployment/dashboard-deploy.md`](../../deployment/dashboard-deploy.md)
