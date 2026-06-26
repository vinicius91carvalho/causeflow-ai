import { describe, expect, it } from 'vitest';
import { TRIGGER_CATALOG } from './integration-catalog';

describe('TRIGGER_CATALOG', () => {
  it('includes sentry with SENTRY_NEW_ISSUE slug', () => {
    expect(TRIGGER_CATALOG.sentry).toBeDefined();
    expect(TRIGGER_CATALOG.sentry[0].slug).toBe('SENTRY_NEW_ISSUE');
  });

  it('includes pagerduty with PAGERDUTY_INCIDENT_TRIGGERED slug', () => {
    expect(TRIGGER_CATALOG.pagerduty).toBeDefined();
    expect(TRIGGER_CATALOG.pagerduty[0].slug).toBe('PAGERDUTY_INCIDENT_TRIGGERED');
  });

  it('includes github with GITHUB_COMMIT_EVENT and GITHUB_PULL_REQUEST_EVENT slugs', () => {
    expect(TRIGGER_CATALOG.github).toBeDefined();
    const slugs = TRIGGER_CATALOG.github.map((t) => t.slug);
    expect(slugs).toContain('GITHUB_COMMIT_EVENT');
    expect(slugs).toContain('GITHUB_PULL_REQUEST_EVENT');
  });

  it('includes datadog with DATADOG_MONITOR_TRIGGERED slug', () => {
    expect(TRIGGER_CATALOG.datadog).toBeDefined();
    expect(TRIGGER_CATALOG.datadog[0].slug).toBe('DATADOG_MONITOR_TRIGGERED');
  });

  it('does NOT include slack triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.slack).toEqual([]);
  });

  it('does NOT include jira triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.jira).toEqual([]);
  });

  it('does NOT include linear triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.linear).toEqual([]);
  });

  it('does NOT include notion triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.notion).toEqual([]);
  });

  it('does NOT include discord triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.discord).toEqual([]);
  });

  it('does NOT include zendesk triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.zendesk).toEqual([]);
  });

  it('does NOT include asana triggers (not in active mapper)', () => {
    expect(TRIGGER_CATALOG.asana).toEqual([]);
  });

  it('all active entries have labelKey set', () => {
    for (const key of ['sentry', 'pagerduty', 'github', 'datadog']) {
      for (const entry of TRIGGER_CATALOG[key]) {
        expect(entry.labelKey).toBeTruthy();
      }
    }
  });

  it('only contains slugs that map to active incidents in trigger-event-mapper', () => {
    const activeSlugs = new Set([
      'SENTRY_NEW_ISSUE',
      'PAGERDUTY_INCIDENT_TRIGGERED',
      'GITHUB_COMMIT_EVENT',
      'GITHUB_PULL_REQUEST_EVENT',
      'DATADOG_MONITOR_TRIGGERED',
    ]);
    for (const [, triggers] of Object.entries(TRIGGER_CATALOG)) {
      for (const trigger of triggers) {
        expect(activeSlugs.has(trigger.slug)).toBe(true);
      }
    }
  });
});
