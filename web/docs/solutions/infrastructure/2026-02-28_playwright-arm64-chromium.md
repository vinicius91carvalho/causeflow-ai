---
title: Playwright on ARM64 — Chromium only, pnpm exec not dlx
date: 2026-02-28
category: infrastructure
tags: [playwright, chromium, arm64, proot, pnpm, browser]
app: website, dashboard
severity: high
---

# Playwright on ARM64 — Chromium only, pnpm exec not dlx

## Problem

Two separate Playwright failures occur in the PRoot/ARM64 environment:

1. **Wrong browser**: Chrome is not available on ARM64; tests fail with "browser not found".
2. **Version mismatch**: `pnpm dlx playwright test` downloads a different Playwright version than what is installed, causing browser binary mismatches.

## Root Cause

1. Chrome is x86-only. Only Chromium has ARM64 binaries. The Playwright config must be set to `chromium` explicitly.
2. `pnpm dlx` runs a fresh package download each time. `pnpm exec` runs the locally installed version in `node_modules/.bin/`. Using `dlx` when a project dependency already exists creates version skew.

## Solution

Always run Playwright tests with the locally installed binary:

```bash
# Correct:
pnpm exec playwright test
pnpm exec playwright test tests/audit.spec.ts

# Wrong — downloads different version:
pnpm dlx playwright test
```

Playwright config (`playwright.config.ts`) must use Chromium:

```ts
// playwright.config.ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  // Never add 'firefox' or 'webkit' — not available on ARM64
],
```

Chromium binary is at `/usr/bin/chromium`.

## Prevention

- `CLAUDE.md` rule: "ALWAYS `pnpm exec playwright`, NEVER `pnpm dlx playwright`."
- Project `playwright.config.ts` is already set to `chromium` only — do not add other browsers.

## Related

- [`infrastructure/2026-02-28_proot-turbopack-workaround.md`](./2026-02-28_proot-turbopack-workaround.md)
- [Playwright docs — ARM64](https://playwright.dev/docs/browsers)
