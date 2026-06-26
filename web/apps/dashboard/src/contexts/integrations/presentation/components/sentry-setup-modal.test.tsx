import { describe, expect, it } from 'vitest';
import { SentrySetupModal } from './sentry-setup-modal';

/**
 * Unit tests for `SentrySetupModal`.
 *
 * No `@testing-library/react` is installed. We use source-invariant tests +
 * named-export checks (see `fire-test-errors-card.test.tsx`).
 *
 * Sprint 2 acceptance criteria covered:
 *  - Modal renders all 7 setup steps verbatim
 *  - Client Secret input is required
 *  - Submit triggers `onSubmit` with a non-empty secret
 *  - The 5 issue subscription events (created/resolved/assigned/archived/unresolved) appear
 *  - The webhook URL displayed comes from the `webhookUrl` prop (never hardcoded)
 *  - Client Secret is never persisted to localStorage / never logged
 */

describe('SentrySetupModal (structure)', () => {
  it('is exported as a named function', () => {
    expect(SentrySetupModal).toBeDefined();
    expect(typeof SentrySetupModal).toBe('function');
  });

  it('component name is SentrySetupModal', () => {
    expect(SentrySetupModal.name).toBe('SentrySetupModal');
  });
});

describe('SentrySetupModal (source invariants — sprint acceptance)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL('./sentry-setup-modal.tsx', import.meta.url), 'utf-8');
  }

  async function readEnI18n(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL('../../infrastructure/i18n/en.json', import.meta.url), 'utf-8');
  }

  it('renders 7 setup steps (1-7) verbatim from i18n', async () => {
    const source = await readSource();
    // The keys list MUST contain all 7 steps
    expect(source).toContain("['1', '2', '3', '4', '5', '6', '7']");
    // Maps over the keys and renders <li> for each
    expect(source).toMatch(/SETUP_STEP_KEYS\.map/);
  });

  it('i18n contains all 7 setup steps under sentrySetup.steps', async () => {
    const en = await readEnI18n();
    for (const k of ['1', '2', '3', '4', '5', '6', '7']) {
      // Each step key must be present in the JSON
      expect(en).toMatch(new RegExp(`"${k}"\\s*:\\s*"`));
    }
  });

  it('Step 3 calls out Internal Integration (not Public)', async () => {
    const en = await readEnI18n();
    expect(en).toContain('Internal Integration (NOT Public)');
  });

  it('lists all 5 required issue webhook events verbatim', async () => {
    const en = await readEnI18n();
    // The 5 event types per the sprint spec
    expect(en).toContain('created, resolved, assigned, archived, unresolved');
  });

  it('Client Secret input is required and type=password', async () => {
    const source = await readSource();
    expect(source).toMatch(/type="password"/);
    expect(source).toMatch(/\brequired\b/);
    // Test ID for E2E
    expect(source).toContain('data-testid="sentry-client-secret-input"');
  });

  it('webhook URL is taken from the `webhookUrl` prop, never hardcoded', async () => {
    const source = await readSource();
    expect(source).toContain('webhookUrl: string;');
    // Must not contain a hardcoded URL like api-staging or causeflow.ai
    expect(source).not.toContain('api-staging.causeflow.ai');
    expect(source).not.toContain('https://api.causeflow.ai');
    // The displayed code block uses the prop
    expect(source).toMatch(/{webhookUrl}\s*\n?\s*<\/code>/);
  });

  it('does NOT persist Client Secret to localStorage or sessionStorage', async () => {
    const source = await readSource();
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });

  it('does NOT log the Client Secret', async () => {
    const source = await readSource();
    // No console.log/warn/error calls in this component at all
    expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    // No reference to `secret` inside any log/print expression
    expect(source).not.toMatch(/log\([^)]*secret/i);
  });

  it('clears the secret state immediately after a successful submit', async () => {
    const source = await readSource();
    // After awaiting onSubmit success, state is reset
    expect(source).toMatch(/await\s+onSubmit\(secret\)[\s\S]{0,200}?setSecret\(''\)/);
  });

  it('uses i18n namespace dashboard.integrations.sentrySetup', async () => {
    const source = await readSource();
    expect(source).toContain('dashboard.integrations.sentrySetup');
  });

  it('the form has autoComplete="off" to prevent credential manager save', async () => {
    const source = await readSource();
    expect(source).toMatch(/<form[^>]*autoComplete="off"/);
  });

  it('disables the submit button when the secret is empty', async () => {
    const source = await readSource();
    expect(source).toMatch(/disabled=\{!secret\.trim\(\)\s*\|\|\s*submitting\}/);
  });
});
