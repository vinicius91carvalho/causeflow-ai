import type { TenantId } from '../../../shared/domain/value-objects.js';

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup';

export interface IntegrationRecord {
  tenantId: TenantId;
  integrationId: string;
  provider: string;
  category: string;
  status: IntegrationStatus;
  displayName: string;
  config: Record<string, unknown>;
  connectedBy?: string;
  lastHealthCheck?: string;
  createdAt: string;
  updatedAt: string;
}
