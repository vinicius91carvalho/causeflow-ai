# Troubleshooting Guide

Common issues encountered in the PRoot/ARM64 development environment and their solutions.

---

## 1. Port Conflicts

**Symptom:** `Error: listen EADDRINUSE :::3000` when starting a dev or production server.

**Solution:** Kill the process holding the port before starting.

```bash
# Kill by port number
fuser -k 3000/tcp
fuser -k 3001/tcp

# Or kill all Next.js processes
pkill -f "next-server|next start|next dev"
```

---

## 2. Turbopack Crashes in PRoot

**Symptom:** Dev server exits immediately with "Invalid symlink" or similar error when using Turbopack.

**Solution:** Turbopack is incompatible with PRoot. All `pnpm dev` scripts already use Webpack by default. Never run `dev:turbopack` in this environment.

```bash
# Correct — uses Webpack
pnpm dev
pnpm --filter website dev

# Forbidden in PRoot
pnpm dev:turbopack
```

---

## 3. `next start` Serves Wrong or Stale Content

**Symptom:** Production server starts but serves wrong pages, missing assets, or content from a previous build.

**Cause:** `next start` was invoked from the project root instead of the app directory. Next.js picks up the nearest `.next` folder, which may not exist or be stale at the root.

**Solution:** Always run `next start` with CWD set to the app directory.

```bash
# Correct
(cd /root/projects/causeflow-ai/apps/website && pnpm exec next start -p 3000 -H 127.0.0.1)

# Also correct
(cd apps/website && exec pnpm exec next start -p 4000 -H 127.0.0.1) &

# Incorrect — wrong CWD
pnpm --filter website exec next start
```

Also check for a stale `.next` directory at the project root and delete it if found:

```bash
rm -rf /root/projects/causeflow-ai/.next
```

---

## 4. Playwright Downloads Conflicting Version

**Symptom:** `pnpm dlx playwright test` installs a new version of Playwright and ignores `playwright.config.ts`, or uses the wrong browser path.

**Solution:** Always use `pnpm exec playwright`, which runs the version installed in `node_modules`.

```bash
# Correct
pnpm exec playwright test
pnpm exec playwright test tests/audit.spec.ts

# Forbidden
pnpm dlx playwright test
npx playwright test
```

---

## 5. Wrong .env File Loaded

**Symptom:** Environment variables are missing or app behaves as if no env file is present.

**Cause:** Searching for or creating `.env.staging` or `.env.production`, which do not exist.

**Solution:** This project uses `.env.local` exclusively for local and manual
configuration. Hosted deployments inject stage-specific variables through CI.
There is no `.env.staging` or `.env.production`.

```bash
# Correct local env files
.env.local                        # Root — optional GA4, Clarity
apps/website/.env.local           # Website-specific vars
apps/dashboard/.env.local         # Dashboard-specific vars

# These do NOT exist — do not create them
.env.staging
.env.production
apps/website/.env.staging
```

---

## 6. SST / Bun Crashes in PRoot

**Symptom:** `sst deploy` exits with a bun-related error in the PRoot container.

**Cause:** Bun's default file backend is incompatible with PRoot's overlay filesystem.

**Solution:** A wrapper at `~/.config/sst/bin/bun` delegates to `bun-real` with the `--backend=copyfile` flag. If the wrapper is missing or corrupt, recreate it:

```bash
cat ~/.config/sst/bin/bun
# Should delegate to bun-real with --backend=copyfile
```

If the wrapper is missing, reinstall SST:

```bash
curl -fsSL https://sst.dev/install | bash
```

---

## 7. Biome "accessibility" Domain Error

**Symptom:** `biome.json` validation error referencing an unknown domain named `accessibility`.

**Cause:** `accessibility` is not a valid Biome domain name.

**Solution:** The valid domain names for Biome rules are: `react`, `test`, `solid`, `next`, `qwik`, `vue`, `project`, `tailwind`, `turborepo`, `playwright`, `types`. Use standard a11y rules directly without a domain prefix.

---

## 8. Stale `.next` Directory at Project Root

**Symptom:** Build artifacts exist at `/root/projects/causeflow-ai/.next` (project root level), causing `next start` to serve incorrect content.

**Solution:** Delete it. The `.next` directory should only exist inside `apps/website` or `apps/dashboard`.

```bash
rm -rf /root/projects/causeflow-ai/.next
```

---

## 9. Dashboard Vitest Timeout

**Symptom:** Dashboard unit tests hang or time out at default Vitest timeout settings.

**Cause:** AWS SDK imports in the dashboard project are heavy and take several seconds to initialize.

**Solution:** The `dashboard` project in `vitest.config.ts` already has a 15-second timeout. Do not reduce it. If tests still time out, check for network calls during import (mock AWS SDK calls in tests).

---

## 10. Git Worktree Issues

**Symptom:** Changes made inside a worktree are missing after merge, or worktree diverges unexpectedly from main.

**Rules for working inside worktrees:**

- Do not modify coordination files from within a worktree (`docs/memory/session-learnings.md`, `MEMORY.md`)
- Do not run `pnpm install` from inside a worktree — dependencies are shared from the main workspace
- Do not create new worktrees from inside an existing worktree
- After finishing work in a worktree, merge back to main with `git merge [branch] --no-edit`

---

## General Debugging Checklist

Before reporting an issue, run through this checklist:

1. Kill all existing Next.js and Playwright processes
2. Verify you are using `.env.local` (not `.env.staging` or `.env.production`)
3. Verify `next start` is running with CWD at `apps/website` or `apps/dashboard`
4. Verify you are using `pnpm exec playwright` (not `pnpm dlx`)
5. Check for a stale `.next` at the project root and delete it
6. Run `pnpm exec biome check .` to rule out lint/format errors
7. Run `pnpm turbo check-types` to rule out TypeScript errors
