import { Entity } from 'electrodb';
export declare const ServiceNodeEntity: Entity<string, string, string, {
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
        serviceId: {
            type: "string";
            required: true;
        };
        name: {
            type: "string";
            required: true;
        };
        type: {
            type: readonly ["api", "database", "cache", "queue", "storage", "cdn", "load_balancer", "function", "container", "other"];
            required: true;
        };
        runtime: {
            type: "string";
        };
        health: {
            type: "map";
            properties: {
                status: {
                    type: readonly ["healthy", "degraded", "unhealthy", "unknown"];
                    required: true;
                };
                lastCheck: {
                    type: "string";
                    required: true;
                };
                details: {
                    type: "string";
                };
            };
            required: true;
        };
        healthStatus: {
            type: readonly ["healthy", "degraded", "unhealthy", "unknown"];
            required: true;
        };
        blastRadius: {
            type: "number";
            required: true;
            default: number;
        };
        criticality: {
            type: readonly ["critical", "high", "medium", "low"];
            required: true;
            default: string;
        };
        ownerTeam: {
            type: "string";
        };
        tags: {
            type: "any";
        };
        metadata: {
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
                composite: "serviceId"[];
            };
        };
        byTeam: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: ("serviceId" | "ownerTeam")[];
            };
        };
        byBlastRadius: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: "blastRadius"[];
            };
        };
    };
}>;
