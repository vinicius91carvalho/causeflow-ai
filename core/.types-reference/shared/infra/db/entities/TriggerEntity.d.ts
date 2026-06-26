import { Entity } from 'electrodb';
export declare const TriggerEntity: Entity<string, string, string, {
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
