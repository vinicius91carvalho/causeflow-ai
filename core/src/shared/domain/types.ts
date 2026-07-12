export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type TenantPlan = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type IncidentStatus =
  | 'open'
  | 'triaging'
  | 'investigating'
  | 'awaiting_approval'
  | 'remediating'
  | 'resolved'
  | 'closed'
  | 'aborted'
  | 'cost_exceeded'
  | 'failed'
  | 'inconclusive';
export type IntegrationProvider =
  | 'datadog'
  | 'grafana'
  | 'newrelic'
  | 'cloudwatch'
  | 'prometheus'
  | 'pagerduty'
  | 'opsgenie'
  | 'slack'
  | 'teams'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'jira'
  | 'linear'
  | 'hubspot'
  | 'confluence';
export type IntegrationCategory = 'observability' | 'alerting' | 'chat' | 'cloud';
export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup';
export type AgentRole =
  | 'coordinator'
  | 'orchestrator'
  | 'log_analyst'
  | 'metric_analyst'
  | 'infra_inspector'
  | 'change_detector'
  | 'code_analyzer'
  | 'code_fixer'
  | 'remediator'
  | 'db_analyst'
  | 'operator'
  | 'issue_correlator'
  | 'apm_analyst'
  | 'notification_sender'
  | 'falsifier'
  | 'scout'
  | 'diagnosis_verifier'
  | `skill:${string}`;
export type AuditAction =
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.suspended'
  | 'integration.created'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.updated'
  | 'integration.deleted'
  | 'incident.created'
  | 'incident.status_changed'
  | 'incident.assigned'
  | 'investigation.completed'
  | 'remediation.proposed'
  | 'remediation.approved'
  | 'remediation.rejected'
  | 'remediation.executed'
  | 'auth.login'
  | 'auth.logout'
  | 'knowledge.pattern_extracted'
  | 'knowledge.feedback_recorded'
  | 'graph.node_upserted'
  | 'graph.edge_upserted'
  | 'graph.change_added'
  | 'graph.infra_discovered'
  | 'credential.vended'
  | 'credential.revoked'
  | 'notification.sent'
  | 'notification.approval_responded'
  | 'apikey.created'
  | 'apikey.revoked'
  | 'knowledge.runbook_executed'
  | 'investigation.aborted'
  | 'terms.accepted'
  | 'audit.entry.deleted';
export type NotificationType = 'message' | 'approval_request' | 'update';
export type NotificationStatus = 'pending' | 'delivered' | 'read' | 'expired';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ChatProvider = 'web_portal' | 'slack' | 'teams';
export type EvidenceType =
  | 'log_snippet'
  | 'metric_snapshot'
  | 'trace_span'
  | 'resource_state'
  | 'agent_reasoning'
  | 'user_context';
export type PatternStatus =
  | 'learning'
  | 'stable'
  | 'runbook_candidate'
  | 'auto_remediation'
  | 'deprecated';
export type SignalType =
  | 'error_rate_spike'
  | 'latency_increase'
  | '5xx_spike'
  | 'oom_kill'
  | 'connection_timeout'
  | 'queue_depth'
  | 'cpu_saturation'
  | 'disk_full'
  | 'cert_expired'
  | 'dns_failure';
export type RootCauseCategory =
  | 'config_change'
  | 'code_regression'
  | 'infra_failure'
  | 'dependency_failure'
  | 'capacity'
  | 'security'
  | 'external';
export type FeedbackType =
  | 'confirm_rca'
  | 'reject_rca'
  | 'correct_rca'
  | 'confirm_fix'
  | 'reject_fix'
  | 'add_context'
  | 'investigation_accurate'
  | 'investigation_inaccurate'
  | 'investigation_partial'
  | 'remediation_effective'
  | 'remediation_ineffective'
  | 'remediation_made_worse';
export type ServiceType =
  | 'api'
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'cdn'
  | 'load_balancer'
  | 'function'
  | 'container'
  | 'other';
export type EdgeType = 'http' | 'grpc' | 'tcp' | 'event' | 'database' | 'cache' | 'queue';
export type ChangeType =
  | 'deployment'
  | 'config_change'
  | 'scaling'
  | 'rollback'
  | 'infra_change'
  | 'secret_rotation';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type Criticality = 'critical' | 'high' | 'medium' | 'low';
export type UsageType = 'investigation' | 'event' | 'daily_rollup';
export type OveragePolicy = 'block' | 'auto_charge' | 'manual';
