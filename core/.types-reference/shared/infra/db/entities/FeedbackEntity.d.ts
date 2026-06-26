import { Entity } from 'electrodb';
export declare const FeedbackEntity: Entity<string, string, string, {
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
