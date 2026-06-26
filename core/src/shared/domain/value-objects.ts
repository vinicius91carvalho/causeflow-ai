
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & {
    readonly [__brand]: B;
};

export type TenantId = Brand<string, 'TenantId'>;

export type IncidentId = Brand<string, 'IncidentId'>;

export type IntegrationId = Brand<string, 'IntegrationId'>;

export type EvidenceId = Brand<string, 'EvidenceId'>;

export type AuditEntryId = Brand<string, 'AuditEntryId'>;

export type RemediationId = Brand<string, 'RemediationId'>;

export type PatternId = Brand<string, 'PatternId'>;

export type FeedbackId = Brand<string, 'FeedbackId'>;

export type ServiceNodeId = Brand<string, 'ServiceNodeId'>;

export type EdgeId = Brand<string, 'EdgeId'>;

export type ChangeEventId = Brand<string, 'ChangeEventId'>;

export type NotificationId = Brand<string, 'NotificationId'>;

export type ApprovalId = Brand<string, 'ApprovalId'>;

export type ApiKeyId = Brand<string, 'ApiKeyId'>;

export type TriggerId = Brand<string, 'TriggerId'>;

export type BillingAccountId = Brand<string, 'BillingAccountId'>;

export type UsageRecordId = Brand<string, 'UsageRecordId'>;

export type WidgetSessionId = Brand<string, 'WidgetSessionId'>;

export type ToolCallId = Brand<string, 'ToolCallId'>;

export function tenantId(id: string): TenantId {
    return id as TenantId;
}
export function incidentId(id: string): IncidentId {
    return id as IncidentId;
}
export function integrationId(id: string): IntegrationId {
    return id as IntegrationId;
}
export function evidenceId(id: string): EvidenceId {
    return id as EvidenceId;
}
export function auditEntryId(id: string): AuditEntryId {
    return id as AuditEntryId;
}
export function remediationId(id: string): RemediationId {
    return id as RemediationId;
}
export function patternId(id: string): PatternId {
    return id as PatternId;
}
export function feedbackId(id: string): FeedbackId {
    return id as FeedbackId;
}
export function serviceNodeId(id: string): ServiceNodeId {
    return id as ServiceNodeId;
}
export function edgeId(id: string): EdgeId {
    return id as EdgeId;
}
export function changeEventId(id: string): ChangeEventId {
    return id as ChangeEventId;
}
export function notificationId(id: string): NotificationId {
    return id as NotificationId;
}
export function approvalId(id: string): ApprovalId {
    return id as ApprovalId;
}
export function apiKeyId(id: string): ApiKeyId {
    return id as ApiKeyId;
}
export function triggerId(id: string): TriggerId {
    return id as TriggerId;
}
export function billingAccountId(id: string): BillingAccountId {
    return id as BillingAccountId;
}
export function usageRecordId(id: string): UsageRecordId {
    return id as UsageRecordId;
}
export function widgetSessionId(id: string): WidgetSessionId {
    return id as WidgetSessionId;
}
export function toolCallId(id: string): ToolCallId {
    return id as ToolCallId;
}
