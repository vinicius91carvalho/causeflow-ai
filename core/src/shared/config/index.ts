function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function envInt(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw !== undefined) return parseInt(raw, 10);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
}

export const config = {
  env: env('NODE_ENV', 'development'),
  stage: env('STAGE', 'development'),
  port: envInt('PORT', 3000),
  logLevel: env('LOG_LEVEL', 'info'),

  aws: {
    region: env('AWS_REGION', 'sa-east-1'),
    dynamoEndpoint: process.env['DYNAMODB_ENDPOINT'],
    sqsEndpoint: process.env['SQS_ENDPOINT'],
    tableName: env('DYNAMODB_TABLE_NAME', 'causeflow-local'),
  },

  // CauseFlow runtime flavour.
  //  - 'aws'  : the original control plane (DynamoDB + SQS + Clerk + Stripe ...)
  //  - 'oss'  : the open-source local runtime (Postgres + Redis/BullMQ + local
  //             JWT auth + stub billing/cloud). Selected by CAUSEFLOW_RUNTIME=oss.
  //             In this mode the boot path contacts ONLY Postgres, Redis,
  //             Hindsight and (optionally) Anthropic — never AWS, Stripe, Clerk,
  //             Sentry, Langfuse, Svix, Slack, Composio or Mastra.
  runtime: env('CAUSEFLOW_RUNTIME', 'aws') as 'aws' | 'oss',

  postgres: {
    url: process.env['DATABASE_URL'],
    host: process.env['POSTGRES_HOST'] ?? 'causeflow-postgres',
    port: envInt('POSTGRES_PORT', 5432),
    database: env('POSTGRES_DB', 'causeflow'),
    user: process.env['POSTGRES_USER'] ?? 'causeflow',
    password: process.env['POSTGRES_PASSWORD'] ?? '',
  },

  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },

  auth: {
    jwtSecret: (() => {
      const secret = process.env['JWT_SECRET'];
      const nodeEnv = process.env['NODE_ENV'] ?? 'development';
      if (!secret && nodeEnv === 'production') {
        throw new Error('JWT_SECRET is required in production');
      }
      return secret ?? 'dev-secret-DO-NOT-USE-IN-PRODUCTION';
    })(),
    jwtIssuer: env('JWT_ISSUER', 'causeflow'),
    jwtAudience: env('JWT_AUDIENCE', 'causeflow-api'),
  },

  langfuse: {
    publicKey: process.env['LANGFUSE_PUBLIC_KEY'],
    secretKey: process.env['LANGFUSE_SECRET_KEY'],
    baseUrl: process.env['LANGFUSE_BASE_URL'],
  },

  // Local Ornith / llama.cpp connector for the OSS runtime (AC-054).
  // Anthropic API key, when set, overrides this connector.
  llm: {
    baseUrl: env('LLM_BASE_URL', 'http://127.0.0.1:8081/v1'),
    model: env('LLM_MODEL', 'Ornith-1.0-9B-code'),
    apiKey: env('LLM_API_KEY', 'local'),
  },

  anthropic: {
    apiKey: env('ANTHROPIC_API_KEY', ''),
    baseUrl: process.env['ANTHROPIC_BASE_URL'],
    triageModel: env('ANTHROPIC_TRIAGE_MODEL', 'claude-sonnet-4-6'),
    investigationModel: env('ANTHROPIC_INVESTIGATION_MODEL', 'claude-sonnet-4-6'),
    synthesisModel: env('ANTHROPIC_SYNTHESIS_MODEL', 'claude-sonnet-4-6'),
    // Hypothesis/debate modes: seeker is a one-shot structured call that defines
    // the ceiling of the whole investigation — default Sonnet so the floor is
    // high even when the tenant has no memory or integrations. Tenants below
    // the cold-start threshold automatically upgrade to `seekerColdStartModel`
    // since memory-based signal is absent and model quality carries more weight.
    seekerModel: env('ANTHROPIC_SEEKER_MODEL', 'claude-sonnet-4-6'),
    seekerColdStartModel: env('ANTHROPIC_SEEKER_COLD_START_MODEL', 'claude-opus-4-5'),
    agentModels: {
      logAnalyst: env('ANTHROPIC_LOG_ANALYST_MODEL', 'claude-haiku-4-5'),
      metricAnalyst: env('ANTHROPIC_METRIC_ANALYST_MODEL', 'claude-haiku-4-5'),
      infraInspector: env('ANTHROPIC_INFRA_INSPECTOR_MODEL', 'claude-sonnet-4-6'),
      changeDetector: env('ANTHROPIC_CHANGE_DETECTOR_MODEL', 'claude-haiku-4-5'),
      codeAnalyzer: env('AGENT_MODEL_CODE_ANALYZER', 'claude-haiku-4-5'),
      codeFixer: env('AGENT_MODEL_CODE_FIXER', 'claude-sonnet-4-6'),
      dbAnalyst: env('ANTHROPIC_DB_ANALYST_MODEL', 'claude-sonnet-4-6'),
      orchestrator: env('ANTHROPIC_ORCHESTRATOR_MODEL', 'claude-sonnet-4-6'),
      // Follow-up chat runs over long idle sessions — needs real context management
      // (compact_20260112). Haiku doesn't support it, so Sonnet is the correct default.
      followup: env('ANTHROPIC_FOLLOWUP_MODEL', 'claude-sonnet-4-6'),
    },
  },

  sqs: {
    alertQueueUrl: process.env['SQS_ALERT_QUEUE_URL'],
    investigationQueueUrl: process.env['SQS_INVESTIGATION_QUEUE_URL'],
    remediationQueueUrl: process.env['SQS_REMEDIATION_QUEUE_URL'],
    alertDlqUrl: process.env['SQS_ALERT_DLQ_URL'],
    investigationDlqUrl: process.env['SQS_INVESTIGATION_DLQ_URL'],
    remediationDlqUrl: process.env['SQS_REMEDIATION_DLQ_URL'],
    progressQueueUrl: process.env['SQS_PROGRESS_QUEUE_URL'],
  },

  // BullMQ queue names for the open-source local runtime (AC-041).
  // Used only when CAUSEFLOW_RUNTIME=oss. In the AWS runtime SQS is used.
  bullmq: {
    alertQueueName: process.env['BULLMQ_ALERT_QUEUE'] ?? 'causeflow-alerts',
    triageQueueName: process.env['BULLMQ_TRIAGE_QUEUE'] ?? 'causeflow-triage',
    investigationQueueName: process.env['BULLMQ_INVESTIGATION_QUEUE'] ?? 'causeflow-investigation',
    remediationQueueName: process.env['BULLMQ_REMEDIATION_QUEUE'] ?? 'causeflow-remediation',
  },

  webhook: {
    secret: env('WEBHOOK_SECRET', 'dev-webhook-secret'),
  },

  ingestion: {
    dedupWindowMinutes: Number(env('DEDUP_WINDOW_MINUTES', '60')),
  },

  sts: {
    roleArn: process.env['AWS_ROLE_ARN'],
    stsEndpoint: process.env['STS_ENDPOINT'],
    roleSessionPrefix: env('STS_SESSION_PREFIX', 'causeflow'),
    defaultDuration: envInt('STS_DEFAULT_DURATION', 900),
    maxDuration: envInt('STS_MAX_DURATION', 3600),
    accountId: process.env['AWS_ACCOUNT_ID'],
  },

  cloudProvider: {
    endpoint: process.env['CLOUD_PROVIDER_ENDPOINT'],
    logGroupPrefix: env('CW_LOG_GROUP_PREFIX', '/ecs/'),
    insightsMaxWaitMs: envInt('CW_INSIGHTS_MAX_WAIT_MS', 30000),
    ssmCommandTimeoutS: envInt('SSM_COMMAND_TIMEOUT_S', 120),
  },

  triage: {
    minInvestigationSeverity: env('TRIAGE_MIN_INVESTIGATION_SEVERITY', 'high'),
  },

  rateLimit: {
    windowSeconds: envInt('RATE_LIMIT_WINDOW_SECONDS', 60),
    plans: {
      starter: envInt('RATE_LIMIT_STARTER', 100),
      pro: envInt('RATE_LIMIT_PRO', 500),
      business: envInt('RATE_LIMIT_BUSINESS', 2000),
      enterprise: envInt('RATE_LIMIT_ENTERPRISE', 5000),
    } as Record<string, number>,
    default: envInt('RATE_LIMIT_DEFAULT', 100),
  },

  relay: {
    enabled: env('RELAY_ENABLED', 'false') === 'true',
    wsPath: env('RELAY_WS_PATH', '/v1/relay/connect'),
  },

  ptc: {
    enabled: env('ENABLE_PROGRAMMATIC_TOOL_CALLING', 'false') === 'true',
  },

  kms: {
    endpoint: process.env['KMS_ENDPOINT'],
    tokenEncryptionKeyId: env('KMS_TOKEN_ENCRYPTION_KEY_ID', 'alias/causeflow-token-encryption'),
  },

  clerk: {
    secretKey: env('CLERK_SECRET_KEY', ''),
    // Optional PEM public key (Clerk Dashboard → API keys → JWT public key).
    // When set, @clerk/backend verifies session JWTs networklessly (no JWKS
    // call) — the only way to verify a Clerk session JWT locally without a
    // live Clerk instance. Standard `CLERK_JWT_KEY` env var.
    jwtKey: env('CLERK_JWT_KEY', ''),
    webhookSecret: env('CLERK_WEBHOOK_SECRET', ''),
  },

  cors: {
    allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3001,http://127.0.0.1:3001').split(',').map((o) => o.trim()),
  },

  stripe: {
    secretKey: env('STRIPE_SECRET_KEY', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
    investigationMeterId: env('STRIPE_INVESTIGATION_METER_ID', ''),
    eventMeterId: env('STRIPE_EVENT_METER_ID', ''),
    starterPriceId: env('STRIPE_STARTER_PRICE_ID', ''),
    proPriceId: env('STRIPE_PRO_PRICE_ID', ''),
    businessPriceId: env('STRIPE_BUSINESS_PRICE_ID', ''),
    starterFlatPriceId: env('STRIPE_STARTER_FLAT_PRICE_ID', ''),
    proFlatPriceId: env('STRIPE_PRO_FLAT_PRICE_ID', ''),
    businessFlatPriceId: env('STRIPE_BUSINESS_FLAT_PRICE_ID', ''),
    starterInvPriceId: env('STRIPE_STARTER_INV_PRICE_ID', ''),
    starterEvtPriceId: env('STRIPE_STARTER_EVT_PRICE_ID', ''),
    proInvPriceId: env('STRIPE_PRO_INV_PRICE_ID', ''),
    proEvtPriceId: env('STRIPE_PRO_EVT_PRICE_ID', ''),
    businessInvPriceId: env('STRIPE_BUSINESS_INV_PRICE_ID', ''),
    businessEvtPriceId: env('STRIPE_BUSINESS_EVT_PRICE_ID', ''),
    // Optional override to point the Stripe SDK at stripe-mock (local/E2E) or a
    // proxy. When STRIPE_HOST is unset, the SDK uses the real Stripe API.
    host: env('STRIPE_HOST', ''),
    port: env('STRIPE_PORT', ''),
    protocol: env('STRIPE_PROTOCOL', ''),
  },

  svix: {
    apiKey: process.env['SVIX_API_KEY'] ?? '',
    appId: process.env['SVIX_APP_ID'] ?? '',
    baseUrl: process.env['SVIX_BASE_URL'] ?? '',
  },

  composio: {
    apiKey: process.env['COMPOSIO_API_KEY'] ?? '',
    baseUrl: process.env['COMPOSIO_BASE_URL'] ?? '',
    webhookSecret: process.env['COMPOSIO_WEBHOOK_SECRET'] ?? process.env['COMPOSIO_API_KEY'] ?? '',
    webhookUrl: process.env['COMPOSIO_WEBHOOK_URL'] ?? '', // ADD THIS LINE
  },

  slack: {
    clientId: process.env['SLACK_CLIENT_ID'] ?? '',
    clientSecret: process.env['SLACK_CLIENT_SECRET'] ?? '',
    redirectUri: process.env['SLACK_REDIRECT_URI'] ?? '',
    stateSecret: process.env['SLACK_STATE_SECRET'] ?? '',
    signingSecret: process.env['SLACK_SIGNING_SECRET'] ?? '',
  },

  ecs: {
    cluster: env('ECS_CLUSTER', ''),
    investigationTaskDefinition: env('ECS_INVESTIGATION_TASK_DEF', ''),
    endpoint: process.env['ECS_ENDPOINT'],
    subnetIds: (process.env['ECS_SUBNET_IDS'] ?? '').split(',').filter(Boolean),
    securityGroupIds: (process.env['ECS_SECURITY_GROUP_IDS'] ?? '').split(',').filter(Boolean),
  },

  billing: {
    maxParallelInvestigations: envInt('MAX_PARALLEL_INVESTIGATIONS', 10),
    maxAgentsPerRun: envInt('MAX_AGENTS_PER_RUN', 10),
    /**
     * Per-investigation cost ceiling in USD (AC-038).
     * When set > 0, a run that exceeds this ceiling is aborted and the
     * incident is marked status=cost_exceeded.
     * Default: 0 (no ceiling).
     */
    maxCostUsd: envInt('INVESTIGATION_MAX_COST_USD', 0),
  },

  webPush: {
    keys: {
      publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
      privateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
    },
    subject: env('VAPID_SUBJECT', 'mailto:push@causeflow.io'),
  },

  hindsight: {
    baseUrl: env('HINDSIGHT_BASE_URL', ''),
    apiKey: process.env['HINDSIGHT_API_KEY'] ?? '',
    enabled: true,
  },

  dashboardUrl: env('DASHBOARD_URL', 'http://localhost:3001'),
  apiUrl: env('API_URL', 'http://localhost:3000'),

  enhancedRunner: {
    enabled: env('ENHANCED_RUNNER_ENABLED', 'false') === 'true',
    scoutAgent: env('ENHANCED_RUNNER_SCOUT_AGENT', 'false') === 'true',
    tenantSkills: env('ENHANCED_RUNNER_TENANT_SKILLS', 'true') === 'true',
    verificationAgent: env('ENHANCED_RUNNER_VERIFICATION_AGENT', 'false') === 'true',
    orchestratorMode: env('ORCHESTRATOR_MODE_ENABLED', 'false') === 'true',
    mastra: env('MASTRA_ENABLED', 'false') === 'true',
  },

  isDev: () => config.env === 'development',
  isProd: () => config.env === 'production',
  isTest: () => config.env === 'test',
  isOss: () => config.runtime === 'oss',
} as const;
