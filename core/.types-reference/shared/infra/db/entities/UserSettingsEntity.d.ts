import { Entity } from 'electrodb';
export declare const UserSettingsEntity: Entity<string, string, string, {
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
        userId: {
            type: "string";
            required: true;
        };
        theme: {
            type: readonly ["light", "dark", "system"];
            default: string;
        };
        locale: {
            type: readonly ["en", "pt-br"];
            default: string;
        };
        notifications: {
            type: "map";
            properties: {
                emailOnComplete: {
                    type: "boolean";
                    default: true;
                };
                emailOnError: {
                    type: "boolean";
                    default: true;
                };
                slackOnComplete: {
                    type: "boolean";
                    default: false;
                };
                slackOnError: {
                    type: "boolean";
                    default: true;
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
                composite: "userId"[];
                template: string;
            };
        };
    };
}>;
