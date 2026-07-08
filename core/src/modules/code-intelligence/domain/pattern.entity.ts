import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface Pattern {
  tenantId: TenantId;
  patternId: string;
  repoFullName: string;
  symptoms: Array<{
    signal: string;
    service: string;
    threshold?: string;
  }>;
  rootCause: {
    category: string;
    description: string;
    evidence: string[];
  };
  fix: {
    action: string;
    description: string;
    automated: boolean;
  };
  confidence: number;
  occurrences: number;
  status: string;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}
