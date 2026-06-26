import { Service } from 'electrodb';
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
export declare const CauseFlowService: Service<{
    tenant: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            name: {
                type: "string";
                required: true;
            };
            slug: {
                type: "string";
                required: true;
            };
            ownerEmail: {
                type: "string";
                required: true;
            };
            plan: {
                type: readonly ["starter", "pro", "business", "enterprise"];
                required: true;
                default: string;
            };
            status: {
                type: readonly ["active", "suspended", "trial", "cancelled"];
                required: true;
                default: string;
            };
            creditsTotal: {
                type: "number";
                default: number;
            };
            creditsUsed: {
                type: "number";
                default: number;
            };
            renewDate: {
                type: "string";
            };
            stripeCustomerId: {
                type: "string";
            };
            stripeSubscriptionId: {
                type: "string";
            };
            subscriptionStatus: {
                type: readonly ["active", "past_due", "canceling", "canceled"];
            };
            currentPeriodEnd: {
                type: "string";
            };
            cancelAtPeriodEnd: {
                type: "boolean";
                default: false;
            };
            websiteUrl: {
                type: "string";
            };
            teamSize: {
                type: readonly ["1_5", "6_20", "21_50", "50plus"];
            };
            settings: {
                type: "map";
                properties: {
                    maxIncidentsPerMonth: {
                        type: "number";
                    };
                    autoRemediation: {
                        type: "boolean";
                    };
                    notificationChannels: {
                        type: "list";
                        items: {
                            type: "string";
                        };
                    };
                    awsRoleArn: {
                        type: "string";
                    };
                    awsExternalId: {
                        type: "string";
                    };
                    awsRegion: {
                        type: "string";
                    };
                    chatProvider: {
                        type: readonly ["web_portal", "slack", "teams"];
                    };
                };
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: never[];
                };
            };
            bySlug: {
                index: string;
                pk: {
                    field: string;
                    composite: "slug"[];
                };
                sk: {
                    field: string;
                    composite: never[];
                };
            };
            byOwner: {
                index: string;
                pk: {
                    field: string;
                    composite: "ownerEmail"[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
        };
    }>;
    integration: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            integrationId: {
                type: "string";
                required: true;
            };
            provider: {
                type: "string";
                required: true;
            };
            category: {
                type: readonly ["observability", "alerting", "chat", "cloud"];
                required: true;
            };
            status: {
                type: readonly ["active", "inactive", "error", "pending_setup"];
                required: true;
                default: string;
            };
            displayName: {
                type: "string";
                required: true;
            };
            config: {
                type: "map";
                properties: {
                    apiKeyRef: {
                        type: "string";
                    };
                    webhookUrl: {
                        type: "string";
                    };
                    region: {
                        type: "string";
                    };
                    accountId: {
                        type: "string";
                    };
                    roleArn: {
                        type: "string";
                    };
                    externalId: {
                        type: "string";
                    };
                };
            };
            encryptedCredentials: {
                type: "string";
            };
            credentialIv: {
                type: "string";
            };
            credentialTag: {
                type: "string";
            };
            credentialDek: {
                type: "string";
            };
            connectedBy: {
                type: "string";
            };
            lastHealthCheck: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "integrationId"[];
                };
            };
            byProviderStatus: {
                index: string;
                pk: {
                    field: string;
                    composite: "provider"[];
                };
                sk: {
                    field: string;
                    composite: "status"[];
                };
            };
        };
    }>;
    incident: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            incidentId: {
                type: "string";
                required: true;
            };
            title: {
                type: "string";
                required: true;
            };
            description: {
                type: "string";
            };
            severity: {
                type: readonly ["critical", "high", "medium", "low", "info"];
                required: true;
            };
            status: {
                type: readonly ["open", "triaging", "investigating", "awaiting_approval", "remediating", "resolved", "closed", "aborted", "failed"];
                required: true;
                default: string;
            };
            sourceProvider: {
                type: "string";
                required: true;
            };
            sourceAlertId: {
                type: "string";
            };
            assignedAgents: {
                type: "list";
                items: {
                    type: "string";
                };
            };
            rootCause: {
                type: "string";
            };
            recommendedActions: {
                type: "any";
            };
            knownSolutionPatternId: {
                type: "string";
            };
            knownSolutionStatus: {
                type: readonly ["pending", "accepted", "declined"];
            };
            customerExplanation: {
                type: "any";
            };
            totalCostUsd: {
                type: "number";
            };
            costBreakdown: {
                type: "any";
            };
            investigationDurationMs: {
                type: "number";
            };
            resolution: {
                type: "string";
            };
            resolvedAt: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                collection: "incidentDetails";
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "incidentId"[];
                };
            };
            bySeverityStatus: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "severity")[];
                };
                sk: {
                    field: string;
                    composite: "status"[];
                };
            };
            byCreatedAt: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
            bySourceAlert: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "sourceProvider")[];
                };
                sk: {
                    field: string;
                    composite: "sourceAlertId"[];
                };
            };
        };
    }>;
    evidence: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            incidentId: {
                type: "string";
                required: true;
            };
            evidenceId: {
                type: "string";
                required: true;
            };
            agentRole: {
                type: readonly ["coordinator", "log_analyst", "metric_analyst", "infra_inspector", "change_detector", "code_analyzer", "code_fixer", "remediator", "db_analyst", "operator", "issue_correlator", "apm_analyst", "notification_sender", "falsifier"];
                required: true;
            };
            evidenceType: {
                type: readonly ["log_snippet", "metric_snapshot", "trace_span", "resource_state", "agent_reasoning", "user_context"];
                required: true;
            };
            content: {
                type: "string";
                required: true;
            };
            metadata: {
                type: "map";
                properties: {
                    source: {
                        type: "string";
                    };
                    timeRange: {
                        type: "string";
                    };
                    confidence: {
                        type: "number";
                    };
                    category: {
                        type: "string";
                    };
                };
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                collection: "incidentDetails";
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: ("incidentId" | "evidenceId")[];
                };
            };
            byAgentRole: {
                index: string;
                pk: {
                    field: string;
                    composite: "incidentId"[];
                };
                sk: {
                    field: string;
                    composite: "agentRole"[];
                };
            };
        };
    }>;
    auditEntry: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            entryId: {
                type: "string";
                required: true;
            };
            action: {
                type: "string";
                required: true;
            };
            actorType: {
                type: readonly ["user", "system", "agent"];
                required: true;
            };
            actorEmail: {
                type: "string";
                required: true;
            };
            resourceType: {
                type: "string";
                required: true;
            };
            resourceId: {
                type: "string";
                required: true;
            };
            changes: {
                type: "string";
            };
            previousHash: {
                type: "string";
                required: true;
            };
            entryHash: {
                type: "string";
                required: true;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "entryId"[];
                };
            };
            byAction: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "action")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
            byActor: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "actorEmail")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
        };
    }>;
    remediation: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            remediationId: {
                type: "string";
                required: true;
            };
            incidentId: {
                type: "string";
                required: true;
            };
            status: {
                type: readonly ["proposed", "approved", "rejected", "executing", "completed", "failed"];
                required: true;
                default: string;
            };
            description: {
                type: "string";
                required: true;
            };
            rootCause: {
                type: "string";
                required: true;
            };
            steps: {
                type: "list";
                items: {
                    type: "map";
                    properties: {
                        stepIndex: {
                            type: "number";
                            required: true;
                        };
                        action: {
                            type: "string";
                            required: true;
                        };
                        params: {
                            type: "any";
                        };
                        status: {
                            type: readonly ["pending", "running", "completed", "failed", "skipped"];
                            required: true;
                            default: string;
                        };
                        output: {
                            type: "string";
                        };
                        costUsd: {
                            type: "number";
                        };
                        durationMs: {
                            type: "number";
                        };
                        startedAt: {
                            type: "string";
                        };
                        completedAt: {
                            type: "string";
                        };
                    };
                };
            };
            pullRequests: {
                type: "list";
                items: {
                    type: "map";
                    properties: {
                        repoFullName: {
                            type: "string";
                            required: true;
                        };
                        prNumber: {
                            type: "number";
                            required: true;
                        };
                        prUrl: {
                            type: "string";
                            required: true;
                        };
                        branch: {
                            type: "string";
                            required: true;
                        };
                        status: {
                            type: readonly ["open", "merged", "closed"];
                            required: true;
                            default: string;
                        };
                    };
                };
            };
            totalCostUsd: {
                type: "number";
            };
            totalDurationMs: {
                type: "number";
            };
            proposedBy: {
                type: "string";
                required: true;
            };
            approvedBy: {
                type: "string";
            };
            rejectedBy: {
                type: "string";
            };
            rejectionReason: {
                type: "string";
            };
            completedAt: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "remediationId"[];
                };
            };
            byIncident: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: ("incidentId" | "remediationId")[];
                };
            };
        };
    }>;
    pattern: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            patternId: {
                type: "string";
                required: true;
            };
            symptoms: {
                type: "list";
                items: {
                    type: "map";
                    properties: {
                        signal: {
                            type: "string";
                            required: true;
                        };
                        service: {
                            type: "string";
                            required: true;
                        };
                        threshold: {
                            type: "string";
                        };
                    };
                };
            };
            serviceType: {
                type: "string";
            };
            infraContext: {
                type: "string";
            };
            rootCause: {
                type: "map";
                properties: {
                    category: {
                        type: "string";
                        required: true;
                    };
                    description: {
                        type: "string";
                        required: true;
                    };
                    evidence: {
                        type: "list";
                        items: {
                            type: "string";
                        };
                    };
                };
            };
            fix: {
                type: "map";
                properties: {
                    action: {
                        type: "string";
                        required: true;
                    };
                    description: {
                        type: "string";
                        required: true;
                    };
                    automated: {
                        type: "boolean";
                        required: true;
                    };
                };
            };
            confidence: {
                type: "number";
                required: true;
            };
            occurrences: {
                type: "number";
                required: true;
                default: number;
            };
            confirmations: {
                type: "number";
                required: true;
                default: number;
            };
            rejections: {
                type: "number";
                required: true;
                default: number;
            };
            status: {
                type: readonly ["learning", "stable", "runbook_candidate", "auto_remediation", "deprecated"];
                required: true;
                default: string;
            };
            sourceIncidents: {
                type: "list";
                items: {
                    type: "string";
                };
            };
            firstSeen: {
                type: "string";
                required: true;
            };
            lastSeen: {
                type: "string";
                required: true;
            };
            lastFeedback: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "patternId"[];
                };
            };
            byStatus: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "status"[];
                };
            };
            byConfidence: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "confidence"[];
                };
            };
        };
    }>;
    feedback: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            feedbackId: {
                type: "string";
                required: true;
            };
            incidentId: {
                type: "string";
                required: true;
            };
            patternId: {
                type: "string";
            };
            type: {
                type: "string";
                required: true;
            };
            actor: {
                type: "string";
                required: true;
            };
            channel: {
                type: readonly ["api", "slack", "teams", "dashboard"];
                required: true;
                default: string;
            };
            originalValue: {
                type: "string";
            };
            correctedValue: {
                type: "string";
            };
            freeText: {
                type: "string";
            };
            agentRole: {
                type: "string";
            };
            quality: {
                type: "number";
            };
            confidenceDelta: {
                type: "number";
                required: true;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "feedbackId"[];
                };
            };
            byIncident: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "incidentId")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
            byPattern: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "patternId")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
        };
    }>;
    serviceNode: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            serviceId: {
                type: "string";
                required: true;
            };
            name: {
                type: "string";
                required: true;
            };
            type: {
                type: readonly ["api", "database", "cache", "queue", "storage", "cdn", "load_balancer", "function", "container", "other"];
                required: true;
            };
            runtime: {
                type: "string";
            };
            health: {
                type: "map";
                properties: {
                    status: {
                        type: readonly ["healthy", "degraded", "unhealthy", "unknown"];
                        required: true;
                    };
                    lastCheck: {
                        type: "string";
                        required: true;
                    };
                    details: {
                        type: "string";
                    };
                };
                required: true;
            };
            healthStatus: {
                type: readonly ["healthy", "degraded", "unhealthy", "unknown"];
                required: true;
            };
            blastRadius: {
                type: "number";
                required: true;
                default: number;
            };
            criticality: {
                type: readonly ["critical", "high", "medium", "low"];
                required: true;
                default: string;
            };
            ownerTeam: {
                type: "string";
            };
            tags: {
                type: "any";
            };
            metadata: {
                type: "any";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "serviceId"[];
                };
            };
            byTeam: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: ("serviceId" | "ownerTeam")[];
                };
            };
            byBlastRadius: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "blastRadius"[];
                };
            };
        };
    }>;
    serviceEdge: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            edgeId: {
                type: "string";
                required: true;
            };
            sourceService: {
                type: "string";
                required: true;
            };
            targetService: {
                type: "string";
                required: true;
            };
            edgeType: {
                type: readonly ["http", "grpc", "tcp", "event", "database", "cache", "queue"];
                required: true;
            };
            protocol: {
                type: "string";
            };
            traffic: {
                type: "map";
                properties: {
                    requestsPerSecond: {
                        type: "number";
                    };
                    avgLatencyMs: {
                        type: "number";
                    };
                    errorRate: {
                        type: "number";
                    };
                };
            };
            isCriticalPath: {
                type: "boolean";
                required: true;
                default: false;
            };
            metadata: {
                type: "any";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "edgeId"[];
                };
            };
            bySource: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "sourceService")[];
                };
                sk: {
                    field: string;
                    composite: "targetService"[];
                };
            };
            byTarget: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "targetService")[];
                };
                sk: {
                    field: string;
                    composite: "sourceService"[];
                };
            };
        };
    }>;
    changeEvent: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            changeId: {
                type: "string";
                required: true;
            };
            changeType: {
                type: readonly ["deployment", "config_change", "scaling", "rollback", "infra_change", "secret_rotation"];
                required: true;
            };
            serviceId: {
                type: "string";
                required: true;
            };
            description: {
                type: "string";
                required: true;
            };
            source: {
                type: "string";
                required: true;
            };
            timestamp: {
                type: "string";
                required: true;
            };
            riskScore: {
                type: "number";
                required: true;
                default: number;
            };
            diff: {
                type: "map";
                properties: {
                    before: {
                        type: "string";
                    };
                    after: {
                        type: "string";
                    };
                    summary: {
                        type: "string";
                        required: true;
                    };
                };
            };
            linkedIncidentId: {
                type: "string";
            };
            metadata: {
                type: "any";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "changeId"[];
                };
            };
            byService: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "serviceId")[];
                };
                sk: {
                    field: string;
                    composite: "timestamp"[];
                };
            };
            byTime: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "timestamp"[];
                };
            };
        };
    }>;
    notification: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            notificationId: {
                type: "string";
                required: true;
            };
            channelId: {
                type: "string";
                required: true;
            };
            threadId: {
                type: "string";
            };
            type: {
                type: readonly ["message", "approval_request", "update"];
                required: true;
            };
            title: {
                type: "string";
                default: string;
            };
            text: {
                type: "string";
                required: true;
            };
            blocks: {
                type: "any";
            };
            status: {
                type: readonly ["pending", "delivered", "read", "expired"];
                required: true;
                default: string;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "notificationId"[];
                };
            };
            byChannel: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: ("createdAt" | "channelId")[];
                };
            };
            byStatus: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "status")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
        };
    }>;
    approval: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            approvalId: {
                type: "string";
                required: true;
            };
            notificationId: {
                type: "string";
                required: true;
            };
            incidentId: {
                type: "string";
                default: string;
            };
            remediationId: {
                type: "string";
                default: string;
            };
            title: {
                type: "string";
                required: true;
            };
            description: {
                type: "string";
                required: true;
            };
            actions: {
                type: "any";
                required: true;
            };
            status: {
                type: readonly ["pending", "approved", "rejected", "expired"];
                required: true;
                default: string;
            };
            respondedBy: {
                type: "string";
            };
            selectedAction: {
                type: "string";
            };
            timeoutMinutes: {
                type: "number";
                required: true;
                default: number;
            };
            expiresAt: {
                type: "string";
                required: true;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "approvalId"[];
                };
            };
            byStatus: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "status")[];
                };
                sk: {
                    field: string;
                    composite: "expiresAt"[];
                };
            };
            byNotification: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "notificationId"[];
                };
            };
        };
    }>;
    apiKey: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            keyId: {
                type: "string";
                required: true;
            };
            tenantId: {
                type: "string";
                required: true;
            };
            name: {
                type: "string";
                required: true;
            };
            keyHash: {
                type: "string";
                required: true;
            };
            prefix: {
                type: "string";
                required: true;
            };
            status: {
                type: readonly ["active", "revoked"];
                required: true;
                default: string;
            };
            webhookSecretHash: {
                type: "string";
            };
            lastUsedAt: {
                type: "string";
            };
            revokedAt: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "keyHash"[];
                };
                sk: {
                    field: string;
                    composite: never[];
                };
            };
            byTenant: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "keyId"[];
                };
            };
        };
    }>;
    repoNode: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            repoFullName: {
                type: "string";
                required: true;
            };
            provider: {
                type: readonly ["github"];
                required: true;
                default: string;
            };
            language: {
                type: "string";
            };
            defaultBranch: {
                type: "string";
            };
            lastCommitSha: {
                type: "string";
            };
            lastIndexedAt: {
                type: "string";
            };
            fileCount: {
                type: "number";
            };
            config: {
                type: "any";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "repoFullName"[];
                };
            };
            byLanguage: {
                index: string;
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: ("repoFullName" | "language")[];
                };
            };
        };
    }>;
    packageDependency: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            repoFullName: {
                type: "string";
                required: true;
            };
            packageName: {
                type: "string";
                required: true;
            };
            version: {
                type: "string";
                required: true;
            };
            declaredIn: {
                type: "string";
                required: true;
            };
            isDev: {
                type: "boolean";
                required: true;
                default: false;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: ("tenantId" | "repoFullName")[];
                };
                sk: {
                    field: string;
                    composite: "packageName"[];
                };
            };
            byPackage: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "packageName")[];
                };
                sk: {
                    field: string;
                    composite: "repoFullName"[];
                };
            };
        };
    }>;
    repoServiceMap: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            repoFullName: {
                type: "string";
                required: true;
            };
            serviceId: {
                type: "string";
                required: true;
            };
            deployTarget: {
                type: "string";
            };
            environment: {
                type: "string";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: ("tenantId" | "serviceId")[];
                };
                sk: {
                    field: string;
                    composite: "repoFullName"[];
                };
            };
            byRepo: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "repoFullName")[];
                };
                sk: {
                    field: string;
                    composite: "serviceId"[];
                };
            };
        };
    }>;
    billingAccount: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            plan: {
                type: readonly ["starter", "pro", "business", "enterprise"];
                required: true;
            };
            periodStart: {
                type: "string";
                required: true;
            };
            periodEnd: {
                type: "string";
                required: true;
            };
            investigationsLimit: {
                type: "number";
                required: true;
                default: number;
            };
            investigationsUsed: {
                type: "number";
                required: true;
                default: number;
            };
            eventsLimit: {
                type: "number";
                required: true;
                default: number;
            };
            eventsUsed: {
                type: "number";
                required: true;
                default: number;
            };
            overagePolicy: {
                type: readonly ["block", "auto_charge", "manual"];
                required: true;
                default: string;
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
            updatedAt: {
                type: "string";
                required: true;
                default: () => string;
                watch: "*";
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: never[];
                };
            };
        };
    }>;
    usageRecord: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            recordId: {
                type: "string";
                required: true;
            };
            type: {
                type: readonly ["investigation", "event"];
                required: true;
            };
            incidentId: {
                type: "string";
            };
            costUsd: {
                type: "number";
            };
            createdAt: {
                type: "string";
                required: true;
                default: () => string;
                readOnly: true;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "recordId"[];
                };
            };
            byType: {
                index: string;
                pk: {
                    field: string;
                    composite: ("tenantId" | "type")[];
                };
                sk: {
                    field: string;
                    composite: "createdAt"[];
                };
            };
        };
    }>;
    trigger: import("electrodb").Entity<string, string, string, {
        model: {
            entity: string;
            version: string;
            service: string;
        };
        attributes: {
            tenantId: {
                type: "string";
                required: true;
            };
            triggerId: {
                type: "string";
                required: true;
            };
            triggerSlug: {
                type: "string";
                required: true;
            };
            provider: {
                type: "string";
                required: true;
            };
            composioTriggerId: {
                type: "string";
                required: true;
            };
            connectedAccountId: {
                type: "string";
                required: true;
            };
            config: {
                type: "any";
                default: {};
            };
            status: {
                type: readonly ["active", "paused", "error"];
                default: string;
            };
            lastEventAt: {
                type: "string";
            };
            eventCount: {
                type: "number";
                default: number;
            };
            createdAt: {
                type: "string";
                required: true;
                readOnly: true;
                default: () => string;
            };
            updatedAt: {
                type: "string";
                required: true;
                watch: "*";
                default: () => string;
                set: () => string;
            };
        };
        indexes: {
            primary: {
                pk: {
                    field: string;
                    composite: "tenantId"[];
                };
                sk: {
                    field: string;
                    composite: "triggerId"[];
                };
            };
            byComposioTrigger: {
                index: string;
                pk: {
                    field: string;
                    composite: "composioTriggerId"[];
                };
                sk: {
                    field: string;
                    composite: "tenantId"[];
                };
            };
        };
    }>;
}>;
export { TenantEntity, IntegrationEntity, IncidentEntity, EvidenceEntity, AuditEntryEntity, RemediationEntity, PatternEntity, FeedbackEntity, ServiceNodeEntity, ServiceEdgeEntity, ChangeEventEntity, NotificationEntity, ApprovalEntity, ApiKeyEntity, RepoNodeEntity, PackageDependencyEntity, RepoServiceMapEntity, BillingAccountEntity, UsageRecordEntity, TriggerEntity, };
