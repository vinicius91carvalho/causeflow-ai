import type { TenantId, UsageRecordId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';

/**
 * Per-agent token usage and cost for a single agent that participated in an
 * investigation. Persisted on the UsageRecord so billing/usage views can show
 * per-agent breakdowns (AC-012).
 */
export interface AgentUsageBreakdown {
  agentRole: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface UsageRecord {
  tenantId: TenantId;
  recordId: UsageRecordId;
  type: UsageType;
  incidentId?: IncidentId;
  costUsd?: number;
  /** Per-agent token counts and cost (present for investigation-type records). */
  agentBreakdown?: AgentUsageBreakdown[];
  createdAt: string;
}
