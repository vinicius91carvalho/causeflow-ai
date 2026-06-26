---
title: pressSequentially() instead of fill() for React controlled inputs
date: 2026-02-28
category: bugfixes
tags: [playwright, react, controlled-input, fill, pressSequentially, onchange, state]
app: website, dashboard
severity: medium
---

# pressSequentially() instead of fill() for React controlled inputs

## Problem

`fill()` on React-controlled inputs appears to work (the DOM shows the value) but form submission sees empty fields. State-dependent UI (e.g., button enabled/disabled) never updates. Tests pass with `fill()` but the feature fails in manual testing and production builds.

Affected inputs: any `<input>` that uses `useState` + `onChange` handler, including:
- Dashboard forgot-password email field
- Dashboard sign-up name field

## Root Cause

`fill()` sets the DOM `value` property directly via Playwright's internal mechanism. This bypasses React's synthetic event system — no `onChange` event fires, so React state remains empty. In development builds the discrepancy may not surface, but in production builds React's optimizations widen the gap.

`pressSequentially()` types one character at a time, triggering `keydown` → `input` → `keyup` for each character. React's synthetic event listener fires on `input`, updating state correctly.

## Solution

Replace `fill()` with `pressSequentially()` on any React-controlled input:

```ts
// Wrong — React state stays empty:
await page.getByLabel('Email').fill('user@example.com');

// Correct — React state updates on each keystroke:
const input = page.getByLabel('Email');
await input.click();
await input.pressSequentially('user@example.com', { delay: 10 });
```

The `delay: 10` (milliseconds between keystrokes) gives React time to flush state updates between characters. Without it, rapid typing can still miss updates in some environments.

## Prevention

- Rule in `MEMORY.md`: "For React controlled inputs: use `pressSequentially()` instead of `fill()`."
- If a form test passes but the feature is reported broken: suspect `fill()` first.
- When writing new Playwright tests for auth/form flows, default to `pressSequentially()`.

## Related

- [`bugfixes/2026-02-28_cognito-secrethash.md`](./2026-02-28_cognito-secrethash.md) — other dashboard auth testing issue
- [Playwright docs — fill vs type](https://playwright.dev/docs/input)
