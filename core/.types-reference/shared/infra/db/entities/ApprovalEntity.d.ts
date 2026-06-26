import { Entity } from 'electrodb';
export declare const ApprovalEntity: Entity<string, string, string, {
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
        approvalId: {
            type: "string";
            required: true;
        };
        notificationId: {
            type: "string";
            required: true;
        };
        incidentId: {
            type: "string";
            default: string;
        };
        remediationId: {
            type: "string";
            default: string;
        };
        title: {
            type: "string";
            required: true;
        };
        description: {
            type: "string";
            required: true;
        };
        actions: {
            type: "any";
            required: true;
        };
        status: {
            type: readonly ["pending", "approved", "rejected", "expired"];
            required: true;
            default: string;
        };
        respondedBy: {
            type: "string";
        };
        selectedAction: {
            type: "string";
        };
        timeoutMinutes: {
            type: "number";
            required: true;
            default: number;
        };
        expiresAt: {
            type: "string";
            required: true;
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
                composite: "approvalId"[];
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
                composite: "expiresAt"[];
            };
        };
        byNotification: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: "notificationId"[];
            };
        };
    };
}>;
