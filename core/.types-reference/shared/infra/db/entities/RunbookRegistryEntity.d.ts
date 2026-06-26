import { Entity } from 'electrodb';
export declare const RunbookRegistryEntity: Entity<string, string, string, {
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
        rootCauseHash: {
            type: "string";
            required: true;
        };
        rootCauseSummary: {
            type: "string";
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
        lastSeen: {
            type: "string";
            required: true;
        };
        fixAction: {
            type: "string";
            default: string;
        };
        fixDescription: {
            type: "string";
            default: string;
        };
        automated: {
            type: "boolean";
            default: false;
        };
        createdAt: {
            type: "string";
            required: true;
        };
        updatedAt: {
            type: "string";
            required: true;
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
                composite: "rootCauseHash"[];
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
                composite: "occurrences"[];
            };
        };
    };
}>;
