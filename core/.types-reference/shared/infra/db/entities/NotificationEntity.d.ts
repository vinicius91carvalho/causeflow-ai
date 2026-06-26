import { Entity } from 'electrodb';
export declare const NotificationEntity: Entity<string, string, string, {
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
        notificationId: {
            type: "string";
            required: true;
        };
        channelId: {
            type: "string";
            required: true;
        };
        threadId: {
            type: "string";
        };
        type: {
            type: readonly ["message", "approval_request", "update"];
            required: true;
        };
        title: {
            type: "string";
            default: string;
        };
        text: {
            type: "string";
            required: true;
        };
        blocks: {
            type: "any";
        };
        status: {
            type: readonly ["pending", "delivered", "read", "expired"];
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
                composite: "notificationId"[];
            };
        };
        byChannel: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: ("createdAt" | "channelId")[];
            };
        };
        byStatus: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "status")[];
            };
            sk: {
                field: string;
                composite: "createdAt"[];
            };
        };
    };
}>;
