# Codebase Audit & Documentation Sync Skill

## Phase 1: Research & Discovery
- [x] Explore existing skill structure and conventions (.claude/skills/)
- [x] Map all apps and packages in monorepo (apps/website, apps/dashboard, packages/*)
- [x] Inventory current documentation files (CLAUDE.md, MEMORY.md, docs/*, etc.)
- [x] Identify what data points need auditing per app/package

## Phase 2: Analyze Current Codebase State
- [x] Spawn agent team for apps/website — analyze routes, components, pages, dependencies, build status
- [x] Spawn agent team for apps/dashboard — analyze routes, components, pages, dependencies, build status
- [x] Spawn agent team for packages/shared — analyze exports, types, constants, utils
- [x] Spawn agent team for packages/ui — analyze components, themes, exports
- [x] Spawn agent team for packages/analytics — analyze tracking, exports
- [x] Spawn agent team for packages/forms — analyze form logic, exports
- [x] Spawn agent team for infrastructure — analyze CI/CD, SST configs, deployment state

## Phase 3: Update Documentation & Memory
- [x] Update MEMORY.md with current findings
- [x] Update CLAUDE.md if any structural changes detected
- [x] Update/create session-learnings.md with audit results
- [x] Verify all documented routes match actual routes
- [x] Verify all documented file paths are still accurate

## Phase 4: Build the Reusable Skill
- [x] Design skill prompt template (codebase-audit skill)
- [x] Write the skill file at .claude/skills/codebase-audit/SKILL.md
- [x] Skill must spawn parallel agent teams per app/package
- [x] Skill must output structured audit report
- [x] Skill must auto-update MEMORY.md and docs
- [x] Test the skill by invoking it

## Phase 5: Validation
- [x] Verify skill file is properly structured
- [x] Verify all documentation is consistent and accurate
- [x] Final review of updated files

## Status: COMPLETED — 2026-02-26
