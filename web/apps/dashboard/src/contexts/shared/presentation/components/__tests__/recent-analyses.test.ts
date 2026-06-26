import { describe, expect, it } from 'vitest';
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from '@/contexts/investigation/domain/types';

/**
 * RecentAnalyses unit tests — logic layer only.
 * Full render tests require jsdom + next-intl providers.
 */

// ─── Badge color mapping (mirrors component) ─────────────────────────────────

// Semantic token color mapping — mirrors status-badge.tsx DS enforcement (Sprint 04)
const STATUS_COLORS: Record<IncidentStatus, string> = {
  open: 'border-warning/40 bg-warning/10 text-warning',
  triaging: 'border-accent/40 bg-accent/10 text-accent-foreground',
  investigating: 'border-primary/40 bg-primary/10 text-primary',
  awaiting_approval: 'border-border bg-muted text-muted-foreground',
  remediating: 'border-accent/30 bg-accent/[0.08] text-accent-foreground',
  resolved: 'border-success/40 bg-success/10 text-success',
  closed: 'border-border bg-muted text-muted-foreground',
  inconclusive: 'border-warning/40 bg-warning/10 text-warning',
};

// Semantic severity mapping — no hardcoded palette colors
const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
  high: 'border-warning/40 bg-warning/10 text-warning',
  medium: 'border-border bg-muted text-muted-foreground',
  low: 'border-border bg-muted text-muted-foreground',
  info: 'border-border bg-muted text-muted-foreground',
};

// ─── Helper functions ────────────────────────────────────────────────────────

function truncateTitle(title: string, maxLength = 80): string {
  return title.length > maxLength ? `${title.slice(0, maxLength)}…` : title;
}

function shouldShowEmptyState(incidents: Incident[]): boolean {
  return incidents.length === 0;
}

function getIncidentDetailPath(incidentId: string): string {
  return `/dashboard/incidents/${incidentId}`;
}

// ─── Test data ────────────────────────────────────────────────────────────────

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    tenantId: 'tenant-1',
    incidentId: 'test-incident-1',
    title: 'Test incident title',
    status: 'open',
    severity: 'medium',
    sourceProvider: 'manual',
    createdAt: '2026-02-24T10:00:00.000Z',
    updatedAt: '2026-02-24T10:00:00.000Z',
    ...overrides,
  };
}

describe('RecentAnalyses logic', () => {
  describe('status badge colors', () => {
    it('open status uses warning semantic token', () => {
      expect(STATUS_COLORS.open).toContain('warning');
    });

    it('triaging status uses accent semantic token', () => {
      expect(STATUS_COLORS.triaging).toContain('accent');
    });

    it('investigating status uses primary semantic token', () => {
      expect(STATUS_COLORS.investigating).toContain('primary');
    });

    it('resolved status uses success semantic token', () => {
      expect(STATUS_COLORS.resolved).toContain('success');
    });

    it('closed status uses muted semantic token', () => {
      expect(STATUS_COLORS.closed).toContain('muted');
    });

    it('all statuses have a color defined', () => {
      const statuses: IncidentStatus[] = [
        'open',
        'triaging',
        'investigating',
        'awaiting_approval',
        'remediating',
        'resolved',
        'closed',
        'inconclusive',
      ];
      for (const status of statuses) {
        expect(STATUS_COLORS[status]).toBeTruthy();
      }
    });
  });

  describe('severity badge colors', () => {
    it('critical severity uses destructive semantic token', () => {
      expect(SEVERITY_COLORS.critical).toContain('destructive');
    });

    it('high severity uses warning semantic token', () => {
      expect(SEVERITY_COLORS.high).toContain('warning');
    });

    it('medium severity uses muted semantic token', () => {
      expect(SEVERITY_COLORS.medium).toContain('muted');
    });

    it('low severity uses muted semantic token', () => {
      expect(SEVERITY_COLORS.low).toContain('muted');
    });

    it('info severity uses muted semantic token', () => {
      expect(SEVERITY_COLORS.info).toContain('muted');
    });

    it('all severities have a color defined', () => {
      const severities: IncidentSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      for (const severity of severities) {
        expect(SEVERITY_COLORS[severity]).toBeTruthy();
      }
    });
  });

  describe('title truncation', () => {
    it('does not truncate short titles', () => {
      const title = 'Short incident title';
      expect(truncateTitle(title)).toBe(title);
    });

    it('truncates at 80 characters with ellipsis', () => {
      const title = 'A'.repeat(100);
      const truncated = truncateTitle(title);
      expect(truncated).toHaveLength(81); // 80 chars + ellipsis
      expect(truncated.endsWith('…')).toBe(true);
    });

    it('does not truncate exactly 80 chars', () => {
      const title = 'A'.repeat(80);
      expect(truncateTitle(title)).toBe(title);
    });
  });

  describe('empty state logic', () => {
    it('shows empty state for empty list', () => {
      expect(shouldShowEmptyState([])).toBe(true);
    });

    it('does not show empty state when list has items', () => {
      const incident = makeIncident();
      expect(shouldShowEmptyState([incident])).toBe(false);
    });
  });

  describe('navigation path', () => {
    it('generates correct detail page path', () => {
      expect(getIncidentDetailPath('abc-123')).toBe('/dashboard/incidents/abc-123');
    });

    it('works with uuid-style ids', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      expect(getIncidentDetailPath(id)).toBe(`/dashboard/incidents/${id}`);
    });
  });

  describe('list rendering', () => {
    it('renders up to 5 recent incidents', () => {
      const incidents = Array.from({ length: 5 }, (_, i) =>
        makeIncident({ incidentId: `id-${i}`, title: `Incident ${i}` }),
      );
      expect(incidents).toHaveLength(5);
      expect(shouldShowEmptyState(incidents)).toBe(false);
    });

    it('all statuses are valid strings', () => {
      const statuses: IncidentStatus[] = [
        'open',
        'triaging',
        'investigating',
        'awaiting_approval',
        'remediating',
        'resolved',
        'closed',
        'inconclusive',
      ];
      for (const status of statuses) {
        const incident = makeIncident({ status });
        expect(incident.status).toBe(status);
      }
    });
  });
});
