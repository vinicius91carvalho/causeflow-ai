import { Service } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
import { TenantEntity } from './TenantEntity.js';
import { IntegrationEntity } from './IntegrationEntity.js';
import { IncidentEntity } from './IncidentEntity.js';
import { EvidenceEntity } from './EvidenceEntity.js';
import { AuditEntryEntity } from './AuditEntryEntity.js';
import { RemediationEntity } from './RemediationEntity.js';
import { PatternEntity } from './PatternEntity.js';
import { FeedbackEntity } from './FeedbackEntity.js';
import { ServiceNodeEntity } from './ServiceNodeEntity.js';
import { ServiceEdgeEntity } from './ServiceEdgeEntity.js';
import { ChangeEventEntity } from './ChangeEventEntity.js';
import { NotificationEntity } from './NotificationEntity.js';
import { ApprovalEntity } from './ApprovalEntity.js';
import { ApiKeyEntity } from './ApiKeyEntity.js';
import { RepoNodeEntity } from './RepoNodeEntity.js';
import { PackageDependencyEntity } from './PackageDependencyEntity.js';
import { RepoServiceMapEntity } from './RepoServiceMapEntity.js';
import { BillingAccountEntity } from './BillingAccountEntity.js';
import { UsageRecordEntity } from './UsageRecordEntity.js';
import { TriggerEntity } from './TriggerEntity.js';
import { WidgetSessionEntity } from './WidgetSessionEntity.js';
import { ChatMessageEntity } from './ChatMessageEntity.js';
import { PushSubscriptionEntity } from './PushSubscriptionEntity.js';
import { ToolCallEntity } from './ToolCallEntity.js';
export const CauseFlowService = new Service(
  {
    tenant: TenantEntity,
    integration: IntegrationEntity,
    incident: IncidentEntity,
    evidence: EvidenceEntity,
    auditEntry: AuditEntryEntity,
    remediation: RemediationEntity,
    pattern: PatternEntity,
    feedback: FeedbackEntity,
    serviceNode: ServiceNodeEntity,
    serviceEdge: ServiceEdgeEntity,
    changeEvent: ChangeEventEntity,
    notification: NotificationEntity,
    approval: ApprovalEntity,
    apiKey: ApiKeyEntity,
    repoNode: RepoNodeEntity,
    packageDependency: PackageDependencyEntity,
    repoServiceMap: RepoServiceMapEntity,
    billingAccount: BillingAccountEntity,
    usageRecord: UsageRecordEntity,
    trigger: TriggerEntity,
    widgetSession: WidgetSessionEntity,
    chatMessage: ChatMessageEntity,
    toolCall: ToolCallEntity,
    pushSubscription: PushSubscriptionEntity,
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
export {
  TenantEntity,
  IntegrationEntity,
  IncidentEntity,
  EvidenceEntity,
  AuditEntryEntity,
  RemediationEntity,
  PatternEntity,
  FeedbackEntity,
  ServiceNodeEntity,
  ServiceEdgeEntity,
  ChangeEventEntity,
  NotificationEntity,
  ApprovalEntity,
  ApiKeyEntity,
  RepoNodeEntity,
  PackageDependencyEntity,
  RepoServiceMapEntity,
  BillingAccountEntity,
  UsageRecordEntity,
  TriggerEntity,
  WidgetSessionEntity,
  ChatMessageEntity,
  ToolCallEntity,
  PushSubscriptionEntity,
};
