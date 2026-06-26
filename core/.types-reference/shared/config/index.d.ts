export declare const config: {
    readonly env: string;
    readonly port: number;
    readonly logLevel: string;
    readonly aws: {
        readonly region: string;
        readonly dynamoEndpoint: string | undefined;
        readonly sqsEndpoint: string | undefined;
        readonly tableName: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly auth: {
        readonly jwtSecret: string;
        readonly jwtIssuer: string;
        readonly jwtAudience: string;
    };
    readonly langfuse: {
        readonly publicKey: string | undefined;
        readonly secretKey: string | undefined;
        readonly baseUrl: string | undefined;
    };
    readonly anthropic: {
        readonly apiKey: string;
        readonly baseUrl: string | undefined;
        readonly triageModel: string;
        readonly investigationModel: string;
        readonly synthesisModel: string;
        readonly agentModels: {
            readonly logAnalyst: string;
            readonly metricAnalyst: string;
            readonly infraInspector: string;
            readonly changeDetector: string;
            readonly codeAnalyzer: string;
            readonly codeFixer: string;
            readonly dbAnalyst: string;
        };
    };
    readonly sqs: {
        readonly alertQueueUrl: string | undefined;
        readonly investigationQueueUrl: string | undefined;
        readonly remediationQueueUrl: string | undefined;
        readonly alertDlqUrl: string | undefined;
        readonly investigationDlqUrl: string | undefined;
        readonly remediationDlqUrl: string | undefined;
    };
    readonly webhook: {
        readonly secret: string;
    };
    readonly sts: {
        readonly accountId: string;
        readonly roleArn: string | undefined;
        readonly stsEndpoint: string | undefined;
        readonly roleSessionPrefix: string;
        readonly defaultDuration: number;
        readonly maxDuration: number;
    };
    readonly cloudProvider: {
        readonly endpoint: string | undefined;
        readonly logGroupPrefix: string;
        readonly insightsMaxWaitMs: number;
        readonly ssmCommandTimeoutS: number;
    };
    readonly triage: {
        readonly minInvestigationSeverity: string;
    };
    readonly rateLimit: {
        readonly windowSeconds: number;
        readonly plans: Record<string, number>;
        readonly default: number;
    };
    readonly relay: {
        readonly enabled: boolean;
        readonly wsPath: string;
    };
    readonly github: {
        readonly appId: string;
        readonly privateKey: string;
        readonly clientId: string;
        readonly clientSecret: string;
        readonly webhookSecret: string;
    };
    readonly ptc: {
        readonly enabled: boolean;
    };
    readonly kms: {
        readonly endpoint: string | undefined;
        readonly tokenEncryptionKeyId: string;
    };
    readonly stripe: {
        readonly secretKey: string;
        readonly webhookSecret: string;
        readonly starterPriceId: string;
        readonly proPriceId: string;
        readonly businessPriceId: string;
    };
    readonly oauth: {
        readonly callbackBaseUrl: string;
        readonly notion: {
            readonly clientId: string;
            readonly clientSecret: string;
        };
    };
    readonly composio: {
        readonly apiKey: string;
        readonly webhookSecret: string;
    };
    readonly cognito: {
        readonly userPoolId: string;
        readonly clientId: string;
        readonly clientSecret: string;
    };
    readonly dashboardUrl: string;
    readonly slack: {
        readonly clientId: string;
        readonly clientSecret: string;
        readonly signingSecret: string;
        readonly botToken: string;
        readonly defaultChannelId: string;
    };
    readonly ecs: {
        readonly cluster: string;
        readonly investigationTaskDefinition: string;
        readonly subnetIds: string[];
        readonly securityGroupIds: string[];
        readonly endpoint: string | undefined;
    };
    readonly cors: {
        readonly allowedOrigins: string[];
    };
    readonly hindsight: {
        readonly enabled: boolean;
        readonly baseUrl: string;
        readonly apiKey: string | undefined;
    };
    readonly isDev: () => boolean;
    readonly isProd: () => boolean;
    readonly isTest: () => boolean;
};
