import { Entity } from 'electrodb';
export declare const IntegrationEntity: Entity<string, string, string, {
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
        integrationId: {
            type: "string";
            required: true;
        };
        provider: {
            type: "string";
            required: true;
        };
        category: {
            type: readonly ["observability", "alerting", "chat", "cloud"];
            required: true;
        };
        status: {
            type: readonly ["active", "inactive", "error", "pending_setup"];
            required: true;
            default: string;
        };
        displayName: {
            type: "string";
            required: true;
        };
        config: {
            type: "map";
            properties: {
                apiKeyRef: {
                    type: "string";
                };
                webhookUrl: {
                    type: "string";
                };
                region: {
                    type: "string";
                };
                accountId: {
                    type: "string";
                };
                roleArn: {
                    type: "string";
                };
                externalId: {
                    type: "string";
                };
            };
        };
        encryptedCredentials: {
            type: "string";
        };
        credentialIv: {
            type: "string";
        };
        credentialTag: {
            type: "string";
        };
        credentialDek: {
            type: "string";
        };
        connectedBy: {
            type: "string";
        };
        lastHealthCheck: {
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
                composite: "integrationId"[];
            };
        };
        byProviderStatus: {
            index: string;
            pk: {
                field: string;
                composite: "provider"[];
            };
            sk: {
                field: string;
                composite: "status"[];
            };
        };
    };
}>;
