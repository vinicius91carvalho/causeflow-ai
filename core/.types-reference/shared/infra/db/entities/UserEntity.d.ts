import { Entity } from 'electrodb';
export declare const UserEntity: Entity<string, string, string, {
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
        email: {
            type: "string";
            required: true;
        };
        name: {
            type: "string";
            required: true;
        };
        role: {
            type: readonly ["admin", "member"];
            required: true;
            default: string;
        };
        profileComplete: {
            type: "boolean";
            default: false;
        };
        termsAcceptedAt: {
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
                composite: "userId"[];
            };
        };
        byUserId: {
            index: string;
            pk: {
                field: string;
                composite: "userId"[];
            };
            sk: {
                field: string;
                composite: "tenantId"[];
            };
        };
        byEmail: {
            index: string;
            pk: {
                field: string;
                composite: "email"[];
            };
            sk: {
                field: string;
                composite: "tenantId"[];
            };
        };
    };
}>;
