---
title: Turbopack crashes in PRoot — use Webpack
date: 2026-02-28
category: infrastructure
tags: [proot, turbopack, webpack, next.js, arm64, dev-server]
app: website, dashboard
severity: high
---

# Turbopack crashes in PRoot — use Webpack

## Problem

Running `next dev --turbopack` in a PRoot/ARM64 container crashes immediately with an "Invalid symlink" error. The dev server fails to start and cannot be recovered by restarting.

## Root Cause

Turbopack resolves symlinks during its file-system crawl. PRoot emulates a Linux environment using bind mounts and synthetic symlinks that do not behave identically to real filesystem symlinks. Turbopack's symlink resolution hits an invalid path and hard-crashes.

## Solution

Use Webpack bundler (the default) instead of Turbopack:

```bash
# This crashes in PRoot:
next dev --turbopack

# This works:
next dev
next dev --hostname 127.0.0.1
```

The `dev:turbopack` script exists in `package.json` for native Linux/macOS systems only. Never use it inside PRoot.

## Prevention

- `CLAUDE.md` rule: "NEVER use Turbopack in PRoot/arm64 container."
- The `next dev` command (no flag) is the safe default.
- If you see "Invalid symlink" on startup, this is the cause.

## Related

- [`infrastructure/2026-02-28_next-dev-hostname-crash.md`](./2026-02-28_next-dev-hostname-crash.md) — companion issue: dev server also requires `--hostname 127.0.0.1`
