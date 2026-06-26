import { Entity } from 'electrodb';
export declare const ServiceEdgeEntity: Entity<string, string, string, {
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
        edgeId: {
            type: "string";
            required: true;
        };
        sourceService: {
            type: "string";
            required: true;
        };
        targetService: {
            type: "string";
            required: true;
        };
        edgeType: {
            type: readonly ["http", "grpc", "tcp", "event", "database", "cache", "queue"];
            required: true;
        };
        protocol: {
            type: "string";
        };
        traffic: {
            type: "map";
            properties: {
                requestsPerSecond: {
                    type: "number";
                };
                avgLatencyMs: {
                    type: "number";
                };
                errorRate: {
                    type: "number";
                };
            };
        };
        isCriticalPath: {
            type: "boolean";
            required: true;
            default: false;
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
                composite: "edgeId"[];
            };
        };
        bySource: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "sourceService")[];
            };
            sk: {
                field: string;
                composite: "targetService"[];
            };
        };
        byTarget: {
            index: string;
            pk: {
                field: string;
                composite: ("tenantId" | "targetService")[];
            };
            sk: {
                field: string;
                composite: "sourceService"[];
            };
        };
    };
}>;
