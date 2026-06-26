# Playwright Test Suite Performance Optimization Checklist

This checklist defines the required refactoring to drastically reduce Playwright test execution time, specifically optimized for a resource-constrained ARM64 Linux proot environment.

**Result: 80 tests passed in 1.5 minutes (down from ~10+ minutes with redundant navigations, networkidle waits, and hardcoded sleeps).**

## 1. Consolidate Redundant Navigations (Critical)
*Currently, the suite navigates to the same route multiple times across different `test.describe` blocks (Visual, SEO, A11y). This multiplies network/rendering overhead.*
- [x] Refactor the test files to navigate to each `BASE_URL + route` **exactly once** per test cycle.
- [x] Combine the SEO Audit, Accessibility (A11y) Audit, and Visual Screenshot logic into a single `test()` block for each page.
  - *Flow:* `page.goto()` -> Run SEO assertions -> Run A11y assertions -> Capture Screenshot -> Move to next page.

## 2. Eliminate Slow Waits & Timeouts
- [x] Find and remove `await browserPage.waitForTimeout(1000);`. Replace it with web-first assertions (e.g., `await expect(locator).toBeVisible()`) so the test proceeds the exact millisecond the DOM is ready.
- [x] Replace `waitUntil: 'networkidle'` with `waitUntil: 'domcontentloaded'` wherever possible. `networkidle` often waits several unnecessary seconds for tracking scripts or lingering connections to close.

## 3. Global Configuration Tuning (`playwright.config.ts`)
- [x] Enable `fullyParallel: true` to utilize multiple CPU cores.
- [x] Explicitly set `workers: 3` (or maximum 4). Do not let Playwright default to maximum workers, as this will cause CPU thermal throttling and lock up the environment.
- [x] Ensure all tracing, video recording, and automatic error screenshots are globally disabled (`trace: 'off'`, `video: 'off'`, `screenshot: 'off'`) to minimize disk I/O overhead.

## 4. Implement Aggressive Network Interception
- [x] Add a `test.beforeEach` hook to intercept and abort non-essential network requests using `page.route()`.
- [x] Explicitly block external analytics, tracking pixels, third-party support chat widgets, and heavy external fonts that do not affect the core DOM structure or layout.

# CauseFlow AI - Playwright Performance Optimization Plan

This document instructs Claude Code on how to refactor the Playwright test suite to drastically reduce execution time. The current tests are running in a resource-constrained ARM64 Linux proot environment (Termux), so minimizing network requests, CPU load, and idle waiting is critical.

Please apply the following changes automatically to the test files:

## 1. The "Grand Consolidation" (Merge Redundant Navigations)
*Currently, the suite navigates to the same route multiple times across different test blocks (Visual, SEO, A11y). This multiplies network and rendering overhead by 3x.*
- [x] Merge the visual audit script and the SEO/A11y script.
- [x] Refactor the test logic to navigate to each `BASE_URL + route` **exactly once** per test cycle per viewport/locale.
- [x] The flow for a single `test()` block should be:
  1. `page.goto(route)`
  2. Run all SEO assertions
  3. Run all Accessibility (A11y) assertions
  4. Capture the Visual Screenshot
  5. Close/Move to the next route.

## 2. Eliminate The "112-Second Penalty" (Hardcoded Waits)
*The visual audit script currently has a hardcoded `await browserPage.waitForTimeout(1000);`. Across 14 pages, 2 locales, and 4 viewports, this causes almost 2 minutes of pure idle time.*
- [x] Scan for and delete all instances of `await browserPage.waitForTimeout(...)`.
- [x] Replace these hard sleeps with web-first visual assertions. For example, wait for a key layout element to render before taking the screenshot: `await expect(browserPage.locator('footer')).toBeVisible();` or `await expect(browserPage.locator('h1')).toBeVisible();`.

## 3. Escape the `networkidle` Trap
*The visual script uses `waitUntil: 'networkidle'`. If CauseFlow AI has any lingering background requests or third-party scripts, Playwright will hang for seconds on every single page load.*
- [x] Change `waitUntil: 'networkidle'` to `waitUntil: 'load'` or `waitUntil: 'domcontentloaded'` in the `page.goto()` calls.
- [x] Rely on the explicit locator assertions (from Step 2) to ensure the page is ready for the screenshot, rather than waiting for the network to go completely silent.

## 4. Implement Smart Network Interception
*Because screenshots are required, CSS and images must load. However, external trackers and analytics scripts waste CPU cycles and network bandwidth.*
- [x] Add a `test.beforeEach` or global hook using `page.route('**/*', ...)` to intercept all network requests.
- [x] Write logic to explicitly `route.abort()` requests to known third-party analytics, tracking pixels, heavy external fonts, or support widgets (e.g., Google Analytics, Intercom, Clarity).
- [x] Ensure that CSS, local images, and core JS bundles are allowed to `route.continue()`.

## 5. Global Configuration Tuning (`playwright.config.ts`)
- [x] Ensure `fullyParallel: true` is set to utilize multiple CPU cores.
- [x] Explicitly limit `workers` to `2` or `3`. Do not let Playwright default to maximum workers, as this will cause CPU thermal throttling on the ARM mobile processor.
- [x] Globally disable tracing, video recording, and automatic error screenshots (`trace: 'off'`, `video: 'off'`, `screenshot: 'off'`) to minimize disk I/O overhead.

## 6. All tests needs to be configured
- [x] All tests will run in the default language (english) only. We need a param in a config file to edit it to run in Portuguese language. It will decrease the number of tests that are running.
  - *Implemented via `TEST_LOCALES` env var. Default: `en`. Set `TEST_LOCALES=en,pt-br` to test both.*

## Additional Optimizations Applied
- [x] Removed HTML reporter (only `list` reporter) — reduces disk I/O
- [x] Set `actionTimeout: 10000` — fail fast on stuck actions
- [x] Reduced `page.goto` timeout from 30s to 15s — fail fast on slow loads
- [x] Used `baseURL` from config instead of hardcoded URLs — consistent port config
- [x] Merged 2 test files into 1 (`audit.spec.ts`) — eliminates file overhead
- [x] Consolidated page list (14 pages with all /vs/* routes included)
