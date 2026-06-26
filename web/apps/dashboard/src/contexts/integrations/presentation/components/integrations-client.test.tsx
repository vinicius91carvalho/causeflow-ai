import { describe, expect, it } from 'vitest';

/**
 * Source-invariant regression tests for `IntegrationsClient`.
 *
 * Following the project pattern (no `@testing-library/react` installed): we
 * read the source file and assert that critical branching invariants are
 * preserved. See `sentry-setup-modal.test.tsx` for the same pattern.
 *
 * Bug being regressed:
 *   On 2026-04-28 a user reported that clicking on Sentry on
 *   `/dashboard/integrations` opened the OLD `WebhookSetupModal`
 *   ("Configure Sentry webhook / Add Webhook / Callback URLs") instead of the
 *   NEW `SentrySetupModal` (Client Secret input — sprint 02).
 *
 *   Root cause #1: staging deploy was 8h stale and predated the modal.
 *   Root cause #2 (latent): `handleCreateTrigger` unconditionally opened
 *   `WebhookSetupModal` whenever the backend returned a `webhookUrl`, with no
 *   guard for `type === 'sentry'`. After staging deploys, this path would
 *   still bypass the new modal.
 *
 *   Fix: guard at the top of the success branch — if `type === 'sentry'`,
 *   open `SentrySetupModal` and return before checking `webhookUrl`.
 */

async function readSource(): Promise<string> {
  const fs = await import('node:fs');
  return fs.readFileSync(new URL('./integrations-client.tsx', import.meta.url), 'utf-8');
}

describe('IntegrationsClient — Sentry never opens WebhookSetupModal', () => {
  it('handleCreateTrigger guards type==="sentry" BEFORE the webhookUrl branch', async () => {
    const source = await readSource();
    // The guard must exist literally
    expect(source).toContain("if (type === 'sentry')");
    // The guard must call setSentrySetupOpen(true) (the NEW modal)
    expect(source).toMatch(/if \(type === 'sentry'\)[\s\S]{0,120}setSentrySetupOpen\(true\)/);
    // And it must return early (so the webhookUrl branch never runs for sentry)
    expect(source).toMatch(/setSentrySetupOpen\(true\);[\s\S]{0,40}return;/);
  });

  it('the sentry guard appears INSIDE handleCreateTrigger and BEFORE setWebhookSetup', async () => {
    const source = await readSource();
    const handlerStart = source.indexOf('async function handleCreateTrigger');
    expect(handlerStart).toBeGreaterThan(-1);
    // Find the next `}` that closes the function (rough heuristic: the next
    // `\n  }\n` after the handler start)
    const handlerEnd = source.indexOf('\n  }\n', handlerStart);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const handlerBody = source.slice(handlerStart, handlerEnd);

    const guardIdx = handlerBody.indexOf("if (type === 'sentry')");
    const setWebhookIdx = handlerBody.indexOf('setWebhookSetup(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(setWebhookIdx).toBeGreaterThan(-1);
    // Guard must come before the call to setWebhookSetup
    expect(guardIdx).toBeLessThan(setWebhookIdx);
  });

  it('handleConnect already routes sentry to SentrySetupModal (sprint-02 invariant preserved)', async () => {
    const source = await readSource();
    // Must contain the original handleConnect guard from sprint 02
    expect(source).toMatch(/if \(id === 'sentry'\)[\s\S]{0,80}setSentrySetupOpen\(true\)/);
  });

  it('renders both modals so either can be opened by its own state flag', async () => {
    const source = await readSource();
    expect(source).toContain('<SentrySetupModal');
    expect(source).toContain('<WebhookSetupModal');
  });

  it('imports SentrySetupModal from the canonical location', async () => {
    const source = await readSource();
    expect(source).toContain("import { SentrySetupModal } from './sentry-setup-modal'");
  });
});
