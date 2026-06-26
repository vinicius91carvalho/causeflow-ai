# GitHub Actions Workflow for Staging & Production Deployment

## Phase 1: Research & Setup
- [x] Explore existing project structure (SST config, env files, existing workflows)
- [x] Identify required environment variables from env.local
- [x] Understand SST deployment commands and requirements

## Phase 2: Implementation
- [x] Create GitHub Actions workflow file with staging deploy
- [x] Add production deploy step with approval gate (GitHub environment protection)
- [x] Configure environment variables for both stages
- [x] Add proper caching (pnpm, turbo, node_modules)

## Phase 3: Validation
- [x] Review workflow syntax and logic
- [x] Verify all env variables are mapped
- [x] Document required GitHub secrets/variables setup
