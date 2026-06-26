import { Entity } from 'electrodb';
export declare const AuditEntryEntity: Entity<string, string, string, {
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
        entryId: {
            type: "string";
            required: true;
        };
        action: {
            type: "string";
            required: true;
        };
        actorType: {
            type: readonly ["user", "system", "agent"];
            required: true;
        };
        actorEmail: {
            type: "string";
            required: true;
        };
        resourceType: {
            type: "string";
            required: true;
        };
        resourceId: {
            type: "string";
            required: true;
        };
        changes: {
            type: "string";
        };
        previousHash: {
            type: "string";
            required: true;
        };
        entryHash: {
            type: "string";
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
                composite: "entryId"[];
            };
        };
        byAction: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "action")[];
            };
            sk: {
                field: string;
                composite: "createdAt"[];
            };
        };
        byActor: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "actorEmail")[];
            };
            sk: {
                field: string;
                composite: "createdAt"[];
            };
        };
    };
}>;
