import { Entity } from 'electrodb';
export declare const RepoServiceMapEntity: Entity<string, string, string, {
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
        repoFullName: {
            type: "string";
            required: true;
        };
        serviceId: {
            type: "string";
            required: true;
        };
        deployTarget: {
            type: "string";
        };
        environment: {
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
                composite: ("tenantId" | "serviceId")[];
            };
            sk: {
                field: string;
                composite: "repoFullName"[];
            };
        };
        byRepo: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "repoFullName")[];
            };
            sk: {
                field: string;
                composite: "serviceId"[];
            };
        };
    };
}>;
