import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ServiceEdge {
  tenantId: TenantId;
  edgeId: string;
  sourceService: string;
  targetService: string;
  edgeType: 'http' | 'grpc' | 'tcp' | 'event' | 'database' | 'cache' | 'queue';
  protocol?: string;
  traffic?: {
    requestsPerSecond?: number;
    avgLatencyMs?: number;
    errorRate?: number;
  };
  isCriticalPath: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
