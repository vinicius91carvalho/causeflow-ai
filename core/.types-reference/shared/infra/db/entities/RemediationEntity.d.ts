import { Entity } from 'electrodb';
export declare const RemediationEntity: Entity<string, string, string, {
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
