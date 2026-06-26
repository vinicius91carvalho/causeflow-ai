import { Entity } from 'electrodb';
export declare const PatternEntity: Entity<string, string, string, {
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
        patternId: {
            type: "string";
            required: true;
        };
        symptoms: {
            type: "list";
            items: {
                type: "map";
                properties: {
                    signal: {
                        type: "string";
                        required: true;
                    };
                    service: {
                        type: "string";
                        required: true;
                    };
                    threshold: {
                        type: "string";
                    };
                };
            };
        };
        serviceType: {
            type: "string";
        };
        infraContext: {
            type: "string";
        };
        rootCause: {
            type: "map";
            properties: {
                category: {
                    type: "string";
                    required: true;
                };
                description: {
                    type: "string";
                    required: true;
                };
                evidence: {
                    type: "list";
                    items: {
                        type: "string";
                    };
                };
            };
        };
        fix: {
            type: "map";
            properties: {
                action: {
                    type: "string";
                    required: true;
                };
                description: {
                    type: "string";
                    required: true;
                };
                automated: {
                    type: "boolean";
                    required: true;
                };
            };
        };
        confidence: {
            type: "number";
            required: true;
        };
        occurrences: {
            type: "number";
            required: true;
            default: number;
        };
        confirmations: {
            type: "number";
            required: true;
            default: number;
        };
        rejections: {
            type: "number";
            required: true;
            default: number;
        };
        status: {
            type: readonly ["learning", "stable", "runbook_candidate", "auto_remediation", "deprecated"];
            required: true;
            default: string;
        };
        sourceIncidents: {
            type: "list";
            items: {
                type: "string";
            };
        };
        firstSeen: {
            type: "string";
            required: true;
        };
        lastSeen: {
            type: "string";
            required: true;
        };
        lastFeedback: {
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
                composite: "patternId"[];
            };
        };
        byStatus: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: "status"[];
            };
        };
        byConfidence: {
            index: string;
            pk: {
                field: string;
                composite: "tenantId"[];
            };
            sk: {
                field: string;
                composite: "confidence"[];
            };
        };
    };
}>;
