import { Entity } from 'electrodb';
export declare const OAuthTokenEntity: Entity<string, string, string, {
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
        provider: {
            type: readonly ["trello", "notion", "shortcut", "jira", "linear", "hubspot", "confluence"];
            required: true;
        };
        encryptedToken: {
            type: "string";
            required: true;
        };
        encryptedDek: {
            type: "string";
            required: true;
        };
        tokenIv: {
            type: "string";
            required: true;
        };
        tokenTag: {
            type: "string";
            required: true;
        };
        encryptedRefreshToken: {
            type: "string";
        };
        refreshDek: {
            type: "string";
        };
        refreshIv: {
            type: "string";
        };
        refreshTag: {
            type: "string";
        };
        expiresAt: {
            type: "string";
        };
        scopes: {
            type: "list";
            items: {
                type: "string";
            };
        };
        metadata: {
            type: "map";
            properties: {
                workspaceId: {
                    type: "string";
                };
                workspaceName: {
                    type: "string";
                };
                userId: {
                    type: "string";
                };
            };
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
                composite: "provider"[];
            };
        };
        byProvider: {
            index: string;
            pk: {
                field: string;
                composite: "provider"[];
            };
            sk: {
                field: string;
                composite: "tenantId"[];
            };
        };
    };
}>;
