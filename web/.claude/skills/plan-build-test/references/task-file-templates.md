# Task File Templates — Reference Guide

## Template 1: New Page / Feature

```markdown
# [Feature Name]

## Context
[1-2 sentences: what the user asked for and why]

## Files to Modify
- `apps/website/src/app/[locale]/[page]/page.tsx` — Page component
- `packages/shared/src/infrastructure/i18n/messages/en.json` — EN translations
- `packages/shared/src/infrastructure/i18n/messages/pt-br.json` — PT-BR translations
- `packages/ui/src/...` — Reusable components (if any)

## Phase 1: Research & Setup
- [ ] Explore existing code and identify patterns
- [ ] Identify all files to create/modify
- [ ] Review similar pages for conventions

## Phase 2: Tests (write first — TDD)
- [ ] Write unit tests for new components
- [ ] Write integration tests for page behavior

## Phase 3: i18n
- [ ] Add EN translation keys
- [ ] Add PT-BR translation keys

## Phase 4: Implementation (mobile first)
- [ ] Implement components (mobile < 640px)
- [ ] Expand to tablet (640px-1024px)
- [ ] Expand to desktop (1024px-1280px)
- [ ] Expand to wide desktop (> 1280px)

## Phase 5: E2E & Validation
- [ ] Write E2E tests (Playwright)
- [ ] Run ALL tests — fix failures immediately
- [ ] Run `pnpm turbo build` — verify zero errors
- [ ] Run `pnpm exec biome check .` — verify zero lint issues
- [ ] Run `pnpm turbo check-types` — verify zero type errors
- [ ] Code review (clean + performant)
- [ ] Security check
- [ ] Performance check
- [ ] Remove unused code/imports

## Issues
<!-- Log any errors or blockers encountered during implementation -->

## Notes
<!-- Critical findings, file paths, or decisions to preserve across compacts -->
```

## Template 2: Bug Fix

```markdown
# Fix: [Bug Description]

## Context
[What's broken, where, and how to reproduce]

## Files to Modify
- `[file]` — [what needs to change]

## Phase 1: Diagnosis
- [ ] Reproduce the bug
- [ ] Identify root cause
- [ ] Document affected components

## Phase 2: Regression Test
- [ ] Write test that fails with the bug
- [ ] Verify test fails before fix

## Phase 3: Fix
- [ ] Implement the fix
- [ ] Verify regression test passes
- [ ] Check for similar bugs in related code

## Phase 4: Validation
- [ ] Run ALL tests — fix failures immediately
- [ ] Run `pnpm turbo build` — verify zero errors
- [ ] Playwright verification — zero console errors
- [ ] No regressions in nearby components

## Issues

## Notes
```

## Template 3: Refactoring

```markdown
# Refactor: [What's Being Refactored]

## Context
[Why this refactor is needed and what the target architecture looks like]

## Files to Modify
- `[file]` — [what changes]

## Phase 1: Impact Analysis
- [ ] Find all usages/references
- [ ] Check test coverage of affected code
- [ ] Map dependencies

## Phase 2: Safety Net
- [ ] Write characterization tests (capture current behavior)
- [ ] Verify all existing tests pass

## Phase 3: Refactor
- [ ] Refactor core logic
- [ ] Update all consumers
- [ ] Update affected tests

## Phase 4: Regression Check
- [ ] Run ALL tests — fix failures immediately
- [ ] Run `pnpm turbo build` — verify zero errors
- [ ] Run `pnpm exec biome check .` — verify zero lint issues
- [ ] Playwright E2E — verify no visual regressions
- [ ] Remove dead code

## Issues

## Notes
```

## Template 4: Design / Styling Change

```markdown
# Design: [What's Changing]

## Context
[Design intent, reference screenshots, or mockup descriptions]

## Files to Modify
- `[component files]`
- `packages/ui/src/themes/...` — Theme tokens (if needed)

## Phase 1: Research
- [ ] Review current design and styling
- [ ] Identify theme tokens involved
- [ ] Check responsive behavior across viewports

## Phase 2: Implementation (mobile first)
- [ ] Implement design changes (mobile < 640px)
- [ ] Expand to tablet (640px-1024px)
- [ ] Expand to desktop (1024px-1280px)
- [ ] Expand to wide desktop (> 1280px)

## Phase 3: Visual Verification
- [ ] Playwright screenshots at all 4 viewports
- [ ] Verify dark mode (if applicable)
- [ ] Verify animations/transitions
- [ ] Zero console errors

## Phase 4: Validation
- [ ] Run `pnpm turbo build` — verify zero errors
- [ ] Run `pnpm exec biome check .` — verify zero lint issues
- [ ] No visual regressions on other pages

## Issues

## Notes
```

## Checkbox Reset Pattern

When preparing for verification phase, reset all checkboxes:

**Find:** `- [x]`
**Replace with:** `- [ ]`

Use the Edit tool with `replace_all: true` on the task file.
```
Edit tool:
  file_path: [task file path]
  old_string: "- [x]"
  new_string: "- [ ]"
  replace_all: true
```

This allows the check-and-fix-tasks skill to independently verify each item.
