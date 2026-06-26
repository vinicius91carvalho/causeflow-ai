import { Entity } from 'electrodb';
export declare const BillingAccountEntity: Entity<string, string, string, {
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
