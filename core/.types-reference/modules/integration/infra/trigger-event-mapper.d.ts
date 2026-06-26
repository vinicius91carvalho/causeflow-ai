import type { TenantId } from '../../../shared/domain/value-objects.js';
/**
 * Raw alert shape expected by IngestAlertUseCase (via ProviderRegistry parser).
 */
export interface RawAlertPayload {
    source: string;
    payload: Record<string, unknown>;
}
/**
 * Change event input compatible with AddChangeEventUseCase.
 */
export interface ChangeEventPayload {
    tenantId: TenantId;
    changeType: 'deployment' | 'config_change' | 'code_change';
    description: string;
    source: string;
    metadata: Record<string, unknown>;
}
export type TriggerMappingResult = {
    type: 'alert';
    source: string;
    payload: Record<string, unknown>;
} | {
    type: 'change_event';
    data: ChangeEventPayload;
} | {
    type: 'unknown';
    data: Record<string, unknown>;
};
/**
 * Maps Composio trigger payloads to CauseFlow actions.
 *
 * Alert triggers → IngestAlertUseCase (existing parsers or inline parsing)
 * Change triggers → AddChangeEventUseCase (graph correlation engine)
 */
export declare class TriggerEventMapper {
    map(triggerSlug: string, data: Record<string, unknown>, tenantId: TenantId): TriggerMappingResult;
    private mapPagerDutyAlert;
    private mapSentryAlert;
    private mapSlackAlert;
    private mapJiraAlert;
    private mapGitHubCommit;
    private mapGitHubPullRequest;
}
