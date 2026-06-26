import { Entity } from 'electrodb';
export declare const TenantEntity: Entity<string, string, string, {
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
        name: {
            type: "string";
            required: true;
        };
        slug: {
            type: "string";
            required: true;
        };
        ownerEmail: {
            type: "string";
            required: true;
        };
        plan: {
            type: readonly ["starter", "pro", "business", "enterprise"];
            required: true;
            default: string;
        };
        status: {
            type: readonly ["active", "suspended", "trial", "cancelled"];
            required: true;
            default: string;
        };
        creditsTotal: {
            type: "number";
            default: number;
        };
        creditsUsed: {
            type: "number";
            default: number;
        };
        renewDate: {
            type: "string";
        };
        stripeCustomerId: {
            type: "string";
        };
        stripeSubscriptionId: {
            type: "string";
        };
        subscriptionStatus: {
            type: readonly ["active", "past_due", "canceling", "canceled"];
        };
        currentPeriodEnd: {
            type: "string";
        };
        cancelAtPeriodEnd: {
            type: "boolean";
            default: false;
        };
        websiteUrl: {
            type: "string";
        };
        teamSize: {
            type: readonly ["1_5", "6_20", "21_50", "50plus"];
        };
        settings: {
            type: "map";
            properties: {
                maxIncidentsPerMonth: {
                    type: "number";
                };
                autoRemediation: {
                    type: "boolean";
                };
                notificationChannels: {
                    type: "list";
                    items: {
                        type: "string";
                    };
                };
                awsRoleArn: {
                    type: "string";
                };
                awsExternalId: {
                    type: "string";
                };
                awsRegion: {
                    type: "string";
                };
                chatProvider: {
                    type: readonly ["web_portal", "slack", "teams"];
                };
            };
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
                composite: never[];
            };
        };
        bySlug: {
            index: string;
            pk: {
                field: string;
                composite: "slug"[];
            };
            sk: {
                field: string;
                composite: never[];
            };
        };
        byOwner: {
            index: string;
            pk: {
                field: string;
                composite: "ownerEmail"[];
            };
            sk: {
                field: string;
                composite: "createdAt"[];
            };
        };
    };
}>;
