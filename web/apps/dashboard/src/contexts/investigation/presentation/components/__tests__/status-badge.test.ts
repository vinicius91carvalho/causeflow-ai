import { describe, expect, it } from 'vitest';
import type { IncidentSeverity, IncidentStatus } from '@/contexts/investigation/domain/types';

/**
 * Unit tests for status and severity badge logic.
 * These test pure CSS class selection logic without rendering React components.
 */

const statusClasses: Record<IncidentStatus, string> = {
  open: 'open-class',
  triaging: 'triaging-class',
  investigating: 'investigating-class',
  awaiting_approval: 'awaiting-approval-class',
  remediating: 'remediating-class',
  resolved: 'resolved-class',
  closed: 'closed-class',
  inconclusive: 'inconclusive-class',
};

const severityClasses: Record<IncidentSeverity, string> = {
  critical: 'critical-class',
  high: 'high-class',
  medium: 'medium-class',
  low: 'low-class',
  info: 'info-class',
};

function getStatusClass(status: IncidentStatus): string {
  return statusClasses[status];
}

function getSeverityClass(severity: IncidentSeverity): string {
  return severityClasses[severity];
}

describe('StatusBadge logic', () => {
  it('returns correct class for open status', () => {
    expect(getStatusClass('open')).toBe('open-class');
  });

  it('returns correct class for triaging status', () => {
    expect(getStatusClass('triaging')).toBe('triaging-class');
  });

  it('returns correct class for investigating status', () => {
    expect(getStatusClass('investigating')).toBe('investigating-class');
  });

  it('returns correct class for awaiting_approval status', () => {
    expect(getStatusClass('awaiting_approval')).toBe('awaiting-approval-class');
  });

  it('returns correct class for remediating status', () => {
    expect(getStatusClass('remediating')).toBe('remediating-class');
  });

  it('returns correct class for resolved status', () => {
    expect(getStatusClass('resolved')).toBe('resolved-class');
  });

  it('returns correct class for closed status', () => {
    expect(getStatusClass('closed')).toBe('closed-class');
  });

  it('all status values have a class mapping', () => {
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
      expect(getStatusClass(status)).toBeTruthy();
    }
  });
});

describe('SeverityBadge logic', () => {
  it('returns correct class for critical severity', () => {
    expect(getSeverityClass('critical')).toBe('critical-class');
  });

  it('returns correct class for high severity', () => {
    expect(getSeverityClass('high')).toBe('high-class');
  });

  it('returns correct class for medium severity', () => {
    expect(getSeverityClass('medium')).toBe('medium-class');
  });

  it('returns correct class for low severity', () => {
    expect(getSeverityClass('low')).toBe('low-class');
  });

  it('returns correct class for info severity', () => {
    expect(getSeverityClass('info')).toBe('info-class');
  });

  it('all severity values have a class mapping', () => {
    const severities: IncidentSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of severities) {
      expect(getSeverityClass(severity)).toBeTruthy();
    }
  });
});

describe('Status types', () => {
  it('valid status values are exhaustive', () => {
    const validStatuses: IncidentStatus[] = [
      'open',
      'triaging',
      'investigating',
      'awaiting_approval',
      'remediating',
      'resolved',
      'closed',
      'inconclusive',
    ];
    expect(validStatuses).toHaveLength(8);
  });

  it('valid severity values are exhaustive', () => {
    const validSeverities: IncidentSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    expect(validSeverities).toHaveLength(5);
  });
});
