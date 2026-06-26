# CauseFlow Relay

Data relay agent deployed inside customer private networks as a Docker container. Connects customer databases to the CauseFlow platform via secure WebSocket tunnel.

## Execution Config

- build_command: npm run build
- test_command: echo "no tests configured"
- lint_command: echo "no linter configured"
- typecheck_command: npx tsc --noEmit
- kill_command: true
- package_manager: npm
- github_repo: causeflow/relay
- staging_urls: (none — container image, not a web service)
- production_urls: (none — container image, not a web service)
- deploy_commands:
  - staging_trigger: auto (push to main triggers semantic-release → DockerHub)
  - production: same as staging (semantic-release handles versioning and publish)
- pages_to_audit: (none)
- session-learnings-path: docs/session-learnings.md

## Stack

- Runtime: Node.js 22 (Alpine)
- Language: TypeScript (ES modules)
- Registry: DockerHub `causeflowai/relay`
- CI/CD: GitHub Actions (semantic-release + Docker buildx)

## Conventions

- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint in CI
- Versioning: Automated semver via semantic-release from commit messages
- Branching: `<type>/<short-description>` (e.g., `feat/redis-driver`)
