# Agent Team Patterns — Reference Guide

## Team Compositions by Task Type

### New Page Build
```
┌─ Team Lead (main agent) ──────────────────────────┐
│                                                     │
│  Phase 1: Research (parallel)                       │
│  ├── Agent: Codebase Explorer                       │
│  └── Agent: Requirements Analyst                    │
│                                                     │
│  Phase 2: Tests + i18n (parallel)                   │
│  ├── Agent: Test Writer (unit + integration)        │
│  └── Agent: i18n Agent (EN + PT-BR keys)            │
│                                                     │
│  Phase 3: Implementation (sequential, mobile-first) │
│  ├── Step: Mobile (< 640px)                         │
│  ├── Step: Tablet (640px-1024px)                    │
│  ├── Step: Desktop (1024px-1280px)                  │
│  └── Step: Wide Desktop (> 1280px)                  │
│                                                     │
│  Phase 4: Verification (parallel)                   │
│  ├── Agent: Build Verifier                          │
│  ├── Agent: Test Runner                             │
│  ├── Agent: Lint Checker                            │
│  └── Agent: Type Checker                            │
│                                                     │
│  Phase 5: Independent Verification                  │
│  └── Skill: check-and-fix-tasks                     │
└─────────────────────────────────────────────────────┘
```

### Bug Fix
```
┌─ Team Lead ─────────────────────────┐
│                                      │
│  Phase 1: Diagnosis (parallel)       │
│  ├── Agent: Code Explorer            │
│  └── Agent: Playwright Inspector     │
│                                      │
│  Phase 2: Fix (sequential)           │
│  ├── Step: Write regression test     │
│  └── Step: Implement fix             │
│                                      │
│  Phase 3: Verify (parallel)          │
│  ├── Agent: Test Runner              │
│  └── Agent: Playwright Verifier      │
│                                      │
│  Phase 4: Independent Verification   │
│  └── Skill: check-and-fix-tasks      │
└──────────────────────────────────────┘
```

### Refactoring
```
┌─ Team Lead ──────────────────────────────┐
│                                           │
│  Phase 1: Impact Analysis (parallel)      │
│  ├── Agent: Usage Finder (grep all refs)  │
│  ├── Agent: Test Coverage Checker         │
│  └── Agent: Dependency Mapper             │
│                                           │
│  Phase 2: Safety Net (sequential)         │
│  └── Step: Write characterization tests   │
│                                           │
│  Phase 3: Refactor (sequential)           │
│  ├── Step: Refactor core logic            │
│  ├── Step: Update all consumers           │
│  └── Step: Update tests                   │
│                                           │
│  Phase 4: Regression Check (parallel)     │
│  ├── Agent: Full Test Suite               │
│  ├── Agent: Build Verifier                │
│  └── Agent: Playwright E2E               │
│                                           │
│  Phase 5: Independent Verification        │
│  └── Skill: check-and-fix-tasks           │
└───────────────────────────────────────────┘
```

## Agent Spawn Guidelines

### When to use `isolation: "worktree"`
- Large refactoring that touches many files
- Experimental approaches where rollback may be needed
- Never for small, targeted fixes

### When to use `run_in_background: true`
- Long-running builds or test suites
- Independent research that doesn't block next steps
- Never when the result determines the next action

### When to use `model: "haiku"`
- Simple file searches or grep operations
- Straightforward test execution
- Never for complex implementation or architectural decisions

### Subagent Communication
- Main agent tracks all progress in the task file
- Subagents report results back — main agent updates checkboxes
- Never let subagents directly modify the task file
- If a subagent fails, the main agent decides next steps

## Context Management Strategy

### When to Compact
Context window > 50% AND all of:
- Current phase is complete
- No pending agent results
- Remaining work is independent of completed work
- No active debugging session

### What Gets Lost on Compact
- Detailed file contents previously read
- Intermediate reasoning from earlier phases
- Agent results from completed phases

### What to Preserve Before Compact
- Update task file with all progress
- Note any critical findings in task file's ## Notes section
- Ensure all file paths are written in the task file

## Error Recovery Patterns

### Build Failure
1. Read error output
2. Spawn diagnostic agent to identify root cause
3. Fix and rebuild
4. If fix changes architecture, pause and ask user

### Test Failure
1. Read failing test details
2. Determine if test or implementation is wrong
3. Fix the correct side
4. Re-run full test suite (not just the failing test)

### Lint/Type Errors
1. Run `pnpm exec biome check --write .` for auto-fixable issues
2. Manually fix remaining issues
3. Re-run check to verify zero errors

### Playwright Verification Failure
1. Read console logs
2. Take before/after screenshots
3. Fix the issue
4. Re-run Playwright until clean
