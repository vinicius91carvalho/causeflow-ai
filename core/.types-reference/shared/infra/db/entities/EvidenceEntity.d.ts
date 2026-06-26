import { Entity } from 'electrodb';
export declare const EvidenceEntity: Entity<string, string, string, {
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
