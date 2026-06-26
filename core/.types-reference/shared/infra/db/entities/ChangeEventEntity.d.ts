import { Entity } from 'electrodb';
export declare const ChangeEventEntity: Entity<string, string, string, {
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
