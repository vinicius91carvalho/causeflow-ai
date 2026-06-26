import { Entity } from 'electrodb';
export declare const PackageDependencyEntity: Entity<string, string, string, {
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
        packageName: {
            type: "string";
            required: true;
        };
        version: {
            type: "string";
            required: true;
        };
        declaredIn: {
            type: "string";
            required: true;
        };
        isDev: {
            type: "boolean";
            required: true;
            default: false;
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
                composite: ("tenantId" | "repoFullName")[];
            };
            sk: {
                field: string;
                composite: "packageName"[];
            };
        };
        byPackage: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "packageName")[];
            };
            sk: {
                field: string;
                composite: "repoFullName"[];
            };
        };
    };
}>;
