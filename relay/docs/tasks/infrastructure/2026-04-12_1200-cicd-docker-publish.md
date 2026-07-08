# CI/CD: Build & Publish CauseFlow Relay Docker Image

**Category:** infrastructure
**Created:** 2026-04-12
**Status:** done

---

## Summary

Create a CI/CD pipeline using GitHub Actions to automatically build, tag, and publish the CauseFlow Relay Docker image to DockerHub (`causeflowai/relay`) using semantic versioning derived from conventional commit messages.

## Audience & Verification

- **Audience:** Customer DevOps/SRE teams pulling the image during CauseFlow onboarding and upgrades. They need predictable semver tags to pin versions.
- **Verification:** A push to `main` with a `feat:` commit triggers the pipeline, computes the next semver, builds multi-arch images (amd64 + arm64), pushes to DockerHub, and `docker pull causeflowai/relay:<version>` works from a clean machine.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary registry | DockerHub (`causeflowai/relay`) | Industry standard for public images, best UX for customers |
| Architecture | `linux/amd64` + `linux/arm64` | Customers may run on x86 or ARM (Graviton, Apple Silicon) |
| Versioning | Conventional Commits → semantic-release | Automated semver from commit messages, no manual tagging |
| Tagging strategy | `1.2.3`, `1.2`, `1`, `latest` | Standard semver tags for flexible version pinning |

## Secrets (already configured)

- `DOCKERHUB_USERNAME` = `causeflowai` (set on `causeflow/relay`)
- `DOCKERHUB_TOKEN` = PAT with read/write (set on `causeflow/relay`)

## Deliverables

### 1. `.dockerignore`

Missing from the project. Needed to keep build context clean and images small.

### 2. `.github/workflows/release.yml` — Semantic Release

**Trigger:** Push to `main` branch

**Steps:**
1. Checkout with full history (`fetch-depth: 0`)
2. Setup Node.js
3. Install dependencies
4. Run `semantic-release` which:
   - Analyzes commits since last release
   - Determines version bump (`fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major)
   - Updates `package.json` version
   - Generates changelog
   - Creates git tag (`vX.Y.Z`)
   - Creates GitHub Release with changelog
   - Outputs the new version number for downstream steps
5. If a new version was released:
   - Set up Docker Buildx + QEMU (for multi-arch)
   - Login to DockerHub
   - Build and push multi-arch image with tags: `X.Y.Z`, `X.Y`, `X`, `latest`

### 3. `.github/workflows/ci.yml` — PR Validation

**Trigger:** Pull requests to `main`

**Steps:**
1. Lint commit messages (commitlint with conventional config)
2. Build TypeScript (`npm run build`)
3. Docker build smoke test (build but don't push)

### 4. `release.config.js` — semantic-release configuration

**Plugins:**
- `@semantic-release/commit-analyzer` — determine version bump from commits
- `@semantic-release/release-notes-generator` — generate changelog
- `@semantic-release/changelog` — write CHANGELOG.md
- `@semantic-release/npm` — update package.json version (no npm publish)
- `@semantic-release/github` — create GitHub Release
- `@semantic-release/git` — commit version bump + changelog back

### 5. `commitlint.config.js` — Conventional commit enforcement

Enforces the [Conventional Commits](https://www.conventionalcommits.org/) format on PR commits so that semantic-release can reliably compute versions.

## Conventional Commits → Semver Mapping

| Commit prefix | Version bump | Example |
|---------------|-------------|---------|
| `fix:` | Patch (0.0.X) | `fix: handle connection timeout` |
| `feat:` | Minor (0.X.0) | `feat: add Redis driver support` |
| `feat!:` or `BREAKING CHANGE:` | Major (X.0.0) | `feat!: change config schema` |
| `docs:`, `chore:`, `test:`, `refactor:`, `perf:`, `ci:` | No release | `docs: update README` |

## Docker Image Tags Example

For version `1.2.3`, the following tags are pushed:
- `causeflowai/relay:1.2.3`
- `causeflowai/relay:1.2`
- `causeflowai/relay:1`
- `causeflowai/relay:latest`

## Dev Dependencies to Add

```json
{
  "semantic-release": "^24.0.0",
  "@semantic-release/changelog": "^6.0.0",
  "@semantic-release/git": "^10.0.0",
  "commitlint": "^19.0.0",
  "@commitlint/config-conventional": "^19.0.0"
}
```

## Acceptance Criteria

- [ ] Push to `main` with `feat:` commit triggers a release with correct semver bump
- [ ] Push to `main` with `fix:` commit triggers a patch release
- [ ] Push to `main` with `docs:` commit does NOT trigger a release
- [ ] Docker image is pushed to DockerHub with all 4 tag variants (X.Y.Z, X.Y, X, latest)
- [ ] Image is multi-arch (amd64 + arm64)
- [ ] PR commits are validated against conventional commits format
- [ ] GitHub Release is created with auto-generated changelog
- [ ] CHANGELOG.md is maintained in the repo
- [x] Docker build succeeds on PRs (smoke test, no push)

## Workflow Journal

### WI-AC-008 (2026-07-08) — VERIFY-FIRST repair

**AC-008:** `.github/workflows/release.yml` triggers on `push` to `main`; `release` job runs `actions/checkout@v4` with `fetch-depth: 0`, Node 22, `npm ci`, `npx semantic-release` with `GITHUB_TOKEN`, and emits `released`/`version` outputs; `docker` job `needs: release` + `if: needs.release.outputs.released == 'true'` sets up QEMU, Buildx, DockerHub login, and `docker/build-push-action@v6` pushing `X.Y.Z`, `X.Y`, `X`, `latest` for `linux/amd64,linux/arm64`.

**Root cause:** Double-prefix bug in the tag block. `MINOR` was `cut -d. -f1-2` (already `X.Y`, e.g. `1.2`), but the X.Y tag line was `causeflowai/relay:${{ env.MAJOR }}.${{ env.MINOR }}`, prepending major to the full major.minor string → `1.1.2` instead of `1.2`.

**Fix (smallest possible diff):** Changed the X.Y tag line to `causeflowai/relay:${{ env.MINOR }}` (one-line edit). `MINOR` already holds `X.Y`.

**Validation:** YAML parses; all 27 structural AC-008 grep checks pass; simulated `RELEASE_VERSION=1.2.3` → tags `1.2.3, 1.2, 1, latest`; simulated `2.0.1` → `2.0.1, 2.0, 2, latest`; grep confirms no line still references `${{ env.MAJOR }}.${{ env.MINOR }}`.
