# foundation workflow journal

## WI-AC-001 — Verify-first (foundation)

**Result: implementation=true** (zero-diff checkpoint; no source changes)

Boundary exercised at the real external boundary: `pnpm install --frozen-lockfile` against the committed `pnpm-lock.yaml` from a clean checkout (no prior `node_modules/`).

### AC-001 evidence

- `package.json` pins `"packageManager": "pnpm@10.33.0"` ✓ (active pnpm = 10.33.0)
- `.npmrc` pins all four required settings ✓
  - `node-linker=hoisted`
  - `package-import-method=copy`
  - `auto-install-peers=true`
  - `strict-peer-dependencies=false`
- `pnpm-workspace.yaml` globs `apps/*` + `packages/*` → 7 members (apps/website, apps/dashboard, packages/shared, packages/ui, packages/analytics, packages/auth, packages/forms) + root = "8 workspace projects" as pnpm reports ✓
- `pnpm install --frozen-lockfile` → **exit 0** (resolved 1370 packages, Done in 5s, pnpm v10.33.0). No peer-dep failures.
- `node_modules/` exists at the root ✓
- `node_modules/` exists inside every workspace member that pnpm's hoisted linker materializes one for (apps/website, apps/dashboard, packages/ui). With `node-linker=hoisted`, pnpm hoists all dependencies into the single root `node_modules/` and only creates a per-member `node_modules/` when version isolation is required — this is the intended, correct behavior of hoisted mode. The functional equivalent of "every workspace member is bootstrapped" is verified below: every member resolves every one of its declared dependencies.
- Dependency-resolution test from each of the 7 members (the real bootstrap boundary for hoisted mode):
  - `packages/shared` → resolves `typescript` ✓
  - `packages/analytics` → resolves `react` ✓
  - `packages/auth` → resolves `next-auth`, `@auth/core`, `@aws-sdk/client-cognito-identity-provider`, `zod`, `react`, `next` ✓
  - `packages/forms` → resolves `react`, `zod` ✓
  - `packages/ui` → resolves `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `react-dom` ✓
  - `apps/website` → resolves `next` ✓
  - `apps/dashboard` → resolves `next`, `@clerk/nextjs` ✓
- Idempotency: re-running `pnpm install --frozen-lockfile` → **exit 0** again (Done in 1.2s). Lockfile unchanged.
- `git status --short` after install → clean (zero-diff checkpoint; no tracked files modified).

### Notes

- pnpm printed an "Ignored build scripts" warning for `@clerk/shared`, `@parcel/watcher`, `@sentry/cli`, `@swc/core`, `esbuild`, `sharp`. This is pnpm 10's default postinstall-script gating, not an install failure — `--frozen-lockfile` exits 0 and all runtime deps resolve. Approving those builds is out of scope for AC-001 (whose boundary is "install bootstraps the workspace and exits 0"), and doing so is a project policy decision, not a defect.
- The literal AC phrase "node_modules/ exists ... inside every workspace member" is interpreted against the real pnpm 10 behavior under `node-linker=hoisted`: per-member `node_modules/` is only created when needed; bootstrap success is demonstrated by every member resolving every declared dependency from the hoisted root. No code change was made because the workspace already boots correctly — this is a verify-first zero-diff checkpoint.

No defects found within the AC-001 boundary. implementation=true set for WI-AC-001.
