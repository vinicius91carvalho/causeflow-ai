import { Entity } from 'electrodb';
export declare const UsageRecordEntity: Entity<string, string, string, {
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
