import { Entity } from 'electrodb';
export declare const ApiKeyEntity: Entity<string, string, string, {
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
