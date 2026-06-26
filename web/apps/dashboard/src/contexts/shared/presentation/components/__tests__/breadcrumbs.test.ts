import { describe, expect, it } from 'vitest';

// Unit tests for breadcrumb route segment mapping logic

const SEGMENT_LABEL_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  analyses: 'analyses',
  new: 'newAnalysis',
  integrations: 'integrations',
  team: 'team',
  settings: 'settings',
};

const UUID_PATTERN = /^[0-9a-f-]{8,}$/i;

function buildBreadcrumbs(pathname: string): { segment: string; labelKey: string }[] {
  const normalizedPath = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?\//, '/');
  const segments = normalizedPath.split('/').filter(Boolean);

  const items: { segment: string; labelKey: string }[] = [];
  for (const segment of segments) {
    if (UUID_PATTERN.test(segment)) continue;
    const labelKey = SEGMENT_LABEL_MAP[segment];
    if (!labelKey) continue;
    items.push({ segment, labelKey });
  }
  return items;
}

describe('Breadcrumbs - route segment mapping', () => {
  it('maps /dashboard to dashboard', () => {
    const items = buildBreadcrumbs('/dashboard');
    expect(items).toHaveLength(1);
    expect(items[0].labelKey).toBe('dashboard');
  });

  it('maps /dashboard/analyses to two breadcrumbs', () => {
    const items = buildBreadcrumbs('/dashboard/analyses');
    expect(items).toHaveLength(2);
    expect(items[0].labelKey).toBe('dashboard');
    expect(items[1].labelKey).toBe('analyses');
  });

  it('maps /dashboard/analyses/new to three breadcrumbs', () => {
    const items = buildBreadcrumbs('/dashboard/analyses/new');
    expect(items).toHaveLength(3);
    expect(items[2].labelKey).toBe('newAnalysis');
  });

  it('maps /dashboard/integrations', () => {
    const items = buildBreadcrumbs('/dashboard/integrations');
    expect(items).toHaveLength(2);
    expect(items[1].labelKey).toBe('integrations');
  });

  it('maps /dashboard/team', () => {
    const items = buildBreadcrumbs('/dashboard/team');
    expect(items).toHaveLength(2);
    expect(items[1].labelKey).toBe('team');
  });

  it('maps /dashboard/settings', () => {
    const items = buildBreadcrumbs('/dashboard/settings');
    expect(items).toHaveLength(2);
    expect(items[1].labelKey).toBe('settings');
  });

  it('skips UUID segments', () => {
    const items = buildBreadcrumbs('/dashboard/analyses/abcd1234-ef56-7890-gh12-ij34kl56mn78');
    expect(items).toHaveLength(2); // dashboard + analyses, not the UUID
    expect(items[0].labelKey).toBe('dashboard');
    expect(items[1].labelKey).toBe('analyses');
  });

  it('strips pt-br locale prefix', () => {
    const items = buildBreadcrumbs('/pt-br/dashboard/settings');
    expect(items).toHaveLength(2);
    expect(items[0].labelKey).toBe('dashboard');
    expect(items[1].labelKey).toBe('settings');
  });

  it('handles unknown segments gracefully (skips them)', () => {
    const items = buildBreadcrumbs('/dashboard/unknown-page');
    expect(items).toHaveLength(1); // only dashboard
  });
});
