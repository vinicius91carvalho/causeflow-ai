import { Entity } from 'electrodb';
export declare const RepoNodeEntity: Entity<string, string, string, {
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
        provider: {
            type: readonly ["github"];
            required: true;
            default: string;
        };
        language: {
            type: "string";
        };
        defaultBranch: {
            type: "string";
        };
        lastCommitSha: {
            type: "string";
        };
        lastIndexedAt: {
            type: "string";
        };
        fileCount: {
            type: "number";
        };
        config: {
            type: "any";
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
                composite: "repoFullName"[];
            };
        };
        byLanguage: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: ("repoFullName" | "language")[];
            };
        };
    };
}>;
