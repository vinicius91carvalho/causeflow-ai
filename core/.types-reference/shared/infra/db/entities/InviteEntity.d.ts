import { Entity } from 'electrodb';
export declare const InviteEntity: Entity<string, string, string, {
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
        email: {
            type: "string";
            required: true;
        };
        invitedBy: {
            type: "string";
            required: true;
        };
        role: {
            type: readonly ["admin", "member"];
            required: true;
            default: string;
        };
        status: {
            type: readonly ["pending", "accepted", "expired", "revoked"];
            required: true;
            default: string;
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
                composite: "email"[];
            };
        };
    };
}>;
