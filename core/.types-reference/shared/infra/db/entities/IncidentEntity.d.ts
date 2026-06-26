import { Entity } from 'electrodb';
export declare const IncidentEntity: Entity<string, string, string, {
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
