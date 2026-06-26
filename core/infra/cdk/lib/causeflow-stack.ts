import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

interface CauseFlowStackProps extends cdk.StackProps {
  stage: string;
}

// Permanent 6-char suffixes assigned by AWS Secrets Manager when each secret
// was created. Required because fromSecretNameV2 produces an ARN without the
// suffix, which ECS rejects with ResourceNotFoundException at task start.
// Populate new entries after creating secrets via `aws secretsmanager list-secrets`.
const SECRET_ARN_SUFFIXES: Record<string, Record<string, string>> = {
  staging: {
    'jwt-secret': '2hiFIB',
    'anthropic-api-key': 'P0DxP4',
    'clerk-secrets': 'dCi4JY',
    'stripe-secrets': 'sOs1Fn',
    'resend-api-key': 'sKxwIW',
    'vapid-keys': 'n3hcjj',
    'langfuse-secrets': 'vAT5WA',
    'hindsight-secrets': '7sFyBF',
    'composio-api-key': 'pDSo8p',
    'slack-credentials': 'FbY5TJ',
    'github-app-key': 'NLVoNL',
    'github-app-secrets': 'skSLnY',
    'sentry-dsn': 'Dvvplb',
  },
  production: {
    'jwt-secret': 'hdyJVn',
    'anthropic-api-key': 'EMwcrr',
    'clerk-secrets': '2GfFKh',
    'stripe-secrets': 'kRX9yl',
    'resend-api-key': 'WcTFQ6',
    'vapid-keys': 'Br9N4f',
    'langfuse-secrets': 'JvQzAJ',
    'hindsight-secrets': 'VKZHFQ',
    'composio-api-key': 'h0BGpi',
    'github-app-key': 'l9RlDg',
    'github-app-secrets': 'zmhQK2',
    'sentry-dsn': '2G0VO4',
  },
};

export class CauseFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CauseFlowStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const prefix = `causeflow-${stage}`;
    const imageTag = this.node.tryGetContext('imageTag') ?? 'latest';

    // Two-pass deploy strategy: by default this stack creates the base infra
    // (VPC, ALB, Listener, Certificate, Route53, TaskDefs, Secrets, Queues,
    // DDB, Cluster, Log Group, IAM Roles) WITHOUT any ECS Services. This
    // avoids CloudFormation getting stuck waiting for a Service to stabilize
    // when the container image is crash-looping, which previously blocked
    // the entire stack deploy.
    //
    // To add the ECS Service (pass 2, after the image is confirmed healthy):
    //   cdk deploy ... -c deployServices=true
    //
    // Default: FALSE. Anything depending on a running Service (target group
    // attachment, CPU alarm) is gated on this flag.
    const deployServicesCtx = this.node.tryGetContext('deployServices');
    const deployServices = deployServicesCtx === 'true' || deployServicesCtx === true;

    // ============================================================
    // IMPORTED RESOURCES (ECR + Secrets — these are NOT owned by this stack)
    // ============================================================

    const repository = ecr.Repository.fromRepositoryName(this, 'Ecr', `causeflow-${stage}`);

    const importSecret = (id: string, name: string) => {
      const suffix = SECRET_ARN_SUFFIXES[stage]?.[name];
      if (!suffix) {
        throw new Error(`Missing ARN suffix for ${stage}/${name}. Populate SECRET_ARN_SUFFIXES in causeflow-stack.ts after creating the secret in AWS Secrets Manager.`);
      }
      const completeArn = `arn:aws:secretsmanager:${this.region}:${this.account}:secret:causeflow-${stage}/${name}-${suffix}`;
      return secretsmanager.Secret.fromSecretCompleteArn(this, id, completeArn);
    };

    const jwtSecret = importSecret('JwtSecret', 'jwt-secret');
    const anthropicSecret = importSecret('AnthropicSecret', 'anthropic-api-key');
    const clerkSecrets = importSecret('ClerkSecrets', 'clerk-secrets');
    const stripeSecrets = importSecret('StripeSecrets', 'stripe-secrets');
    const resendSecret = importSecret('ResendSecret', 'resend-api-key');
    const vapidSecrets = importSecret('VapidSecrets', 'vapid-keys');
    const langfuseSecrets = importSecret('LangfuseSecrets', 'langfuse-secrets');
    const hindsightSecrets = importSecret('HindsightSecrets', 'hindsight-secrets');
    const composioSecret = importSecret('ComposioSecret', 'composio-api-key');
    const githubAppKey = importSecret('GithubAppKey', 'github-app-key');
    const githubAppSecrets = importSecret('GithubAppSecrets', 'github-app-secrets');
    const sentryDsnSecret = importSecret('SentryDsnSecret', 'sentry-dsn');
    // Slack is optional — secret must be created manually in Secrets Manager first.
    // Without it the app starts fine but Slack OAuth connect flow is unavailable.
    const slackSecret = SECRET_ARN_SUFFIXES[stage]?.['slack-credentials']
      ? importSecret('SlackCredentials', 'slack-credentials')
      : null;

    const allSecrets = [
      jwtSecret, anthropicSecret,
      clerkSecrets, stripeSecrets, resendSecret, vapidSecrets, langfuseSecrets,
      hindsightSecrets, composioSecret, githubAppKey, githubAppSecrets,
      ...(slackSecret ? [slackSecret] : []),
    ];

    // ============================================================
    // DynamoDB
    // ============================================================

    // Main table — created outside CDK, imported here for IAM grants
    const table = dynamodb.Table.fromTableName(this, 'Table', prefix);

    // Memory table — created by CDK, retained on delete to preserve data
    const memoryTable = new dynamodb.Table(this, 'MemoryTable', {
      tableName: `${prefix}-memory`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    memoryTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================================
    // KMS — token encryption key for credential vending (envelope encryption)
    // ============================================================

    const tokenEncryptionKey = new kms.Key(this, 'TokenEncryptionKey', {
      alias: `alias/${prefix}-token-encryption-v2`,
      description: `Token encryption key for ${prefix}`,
      enableKeyRotation: true,
      removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ============================================================
    // VPC — OWNED by this stack (created by CDK, natGateways: 1)
    // Must match the original CDK config to avoid subnet CIDR conflicts
    // ============================================================

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ============================================================
    // ACM Certificate — OWNED by this stack (DNS validated)
    // ============================================================

    const hostedZoneId = this.node.tryGetContext('hostedZoneId') ?? 'Z01593322DGY9I94W9S7C';
    const domainName = stage === 'production' ? 'api.causeflow.ai' : `api-${stage}.causeflow.ai`;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: 'causeflow.ai',
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ============================================================
    // ECS CLUSTER
    // ============================================================

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: prefix,
      vpc,
    });

    // ============================================================
    // SQS QUEUES (3 + 3 DLQs) — names must match deployed
    // ============================================================

    const alertDLQ = new sqs.Queue(this, 'alertsDLQ', {
      queueName: `${prefix}-alerts-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const alertQueue = new sqs.Queue(this, 'alertsQueue', {
      queueName: `${prefix}-alerts`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: alertDLQ, maxReceiveCount: 3 },
    });

    const investigationDLQ = new sqs.Queue(this, 'investigationDLQ', {
      queueName: `${prefix}-investigation-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const investigationQueue = new sqs.Queue(this, 'investigationQueue', {
      queueName: `${prefix}-investigation`,
      visibilityTimeout: cdk.Duration.seconds(900),
      deadLetterQueue: { queue: investigationDLQ, maxReceiveCount: 3 },
    });

    const remediationDLQ = new sqs.Queue(this, 'remediationDLQ', {
      queueName: `${prefix}-remediation-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const remediationQueue = new sqs.Queue(this, 'remediationQueue', {
      queueName: `${prefix}-remediation`,
      visibilityTimeout: cdk.Duration.seconds(600),
      deadLetterQueue: { queue: remediationDLQ, maxReceiveCount: 3 },
    });

    const progressDLQ = new sqs.Queue(this, 'ProgressDLQ', {
      queueName: `${prefix}-progress-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const progressQueue = new sqs.Queue(this, 'ProgressQueue', {
      queueName: `${prefix}-progress`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: progressDLQ, maxReceiveCount: 3 },
    });

    const allQueues = [
      alertQueue, alertDLQ,
      investigationQueue, investigationDLQ,
      remediationQueue, remediationDLQ,
      progressQueue, progressDLQ,
    ];

    // ============================================================
    // CLOUDWATCH LOG GROUPS — dedicated groups per role (api + worker)
    // BREAKING: old /ecs/causeflow-{stage} removed. Dashboards/alarms must be updated.
    // ============================================================

    const logRetention = stage === 'production'
      ? logs.RetentionDays.THREE_MONTHS
      : logs.RetentionDays.ONE_MONTH;

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/${prefix}-api`,
      retention: logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const workerLogGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/ecs/${prefix}-worker`,
      retention: logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ============================================================
    // IAM ROLES
    // ============================================================

    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `${prefix}-ecs-execution`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    for (const secret of allSecrets) { secret.grantRead(executionRole); }

    // Explicit wildcard policy — fromSecretNameV2 generates ?????? suffix which IAM doesn't match
    executionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowSecretsManagerRead',
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: [`arn:aws:secretsmanager:us-east-2:409171461008:secret:causeflow-${stage}/*`],
    }));

    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: `${prefix}-ecs-task`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    table.grantReadWriteData(taskRole);
    memoryTable.grantReadWriteData(taskRole);
    tokenEncryptionKey.grantEncryptDecrypt(taskRole);
    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowDynamoDBIndexAccess',
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:GetItem', 'dynamodb:BatchGetItem'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${prefix}/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${prefix}-memory/index/gsi1`,
      ],
    }));
    for (const queue of allQueues) { queue.grantSendMessages(taskRole); queue.grantConsumeMessages(taskRole); }
    for (const secret of allSecrets) { secret.grantRead(taskRole); }
    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowSecretsManagerReadWildcard',
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: [`arn:aws:secretsmanager:us-east-2:409171461008:secret:causeflow-${stage}/*`],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowCredentialVending', effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'], resources: ['*'],
    }));
    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowRunTask', effect: iam.Effect.ALLOW,
      actions: ['ecs:RunTask', 'iam:PassRole'], resources: ['*'],
    }));
    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowCloudWatchLogs', effect: iam.Effect.ALLOW,
      actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
      resources: [apiLogGroup.logGroupArn, workerLogGroup.logGroupArn],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowXRayWrite',
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    }));

    // ============================================================
    // SHARED SECRETS & ENV
    // ============================================================

    const taskSecrets: Record<string, ecs.Secret> = {
      JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
      ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
      CLERK_SECRET_KEY: ecs.Secret.fromSecretsManager(clerkSecrets, 'CLERK_SECRET_KEY'),
      CLERK_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(clerkSecrets, 'CLERK_WEBHOOK_SECRET'),
      RESEND_API_KEY: ecs.Secret.fromSecretsManager(resendSecret),
      VAPID_PUBLIC_KEY: ecs.Secret.fromSecretsManager(vapidSecrets, 'VAPID_PUBLIC_KEY'),
      VAPID_PRIVATE_KEY: ecs.Secret.fromSecretsManager(vapidSecrets, 'VAPID_PRIVATE_KEY'),
      VAPID_SUBJECT: ecs.Secret.fromSecretsManager(vapidSecrets, 'VAPID_SUBJECT'),
      STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_SECRET_KEY'),
      STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_WEBHOOK_SECRET'),
      STRIPE_INVESTIGATION_METER_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_INVESTIGATION_METER_ID'),
      STRIPE_EVENT_METER_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_EVENT_METER_ID'),
      STRIPE_STARTER_FLAT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_STARTER_FLAT_PRICE_ID'),
      STRIPE_STARTER_INV_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_STARTER_INV_PRICE_ID'),
      STRIPE_STARTER_EVT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_STARTER_EVT_PRICE_ID'),
      STRIPE_PRO_FLAT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_PRO_FLAT_PRICE_ID'),
      STRIPE_PRO_INV_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_PRO_INV_PRICE_ID'),
      STRIPE_PRO_EVT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_PRO_EVT_PRICE_ID'),
      STRIPE_BUSINESS_FLAT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_BUSINESS_FLAT_PRICE_ID'),
      STRIPE_BUSINESS_INV_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_BUSINESS_INV_PRICE_ID'),
      STRIPE_BUSINESS_EVT_PRICE_ID: ecs.Secret.fromSecretsManager(stripeSecrets, 'STRIPE_BUSINESS_EVT_PRICE_ID'),
      LANGFUSE_PUBLIC_KEY: ecs.Secret.fromSecretsManager(langfuseSecrets, 'LANGFUSE_PUBLIC_KEY'),
      LANGFUSE_SECRET_KEY: ecs.Secret.fromSecretsManager(langfuseSecrets, 'LANGFUSE_SECRET_KEY'),
      LANGFUSE_BASE_URL: ecs.Secret.fromSecretsManager(langfuseSecrets, 'LANGFUSE_BASE_URL'),
      // Hindsight API key (when enabled):
      HINDSIGHT_API_KEY: ecs.Secret.fromSecretsManager(hindsightSecrets, 'HINDSIGHT_API_KEY'),
      // Composio
      COMPOSIO_API_KEY: ecs.Secret.fromSecretsManager(composioSecret, 'COMPOSIO_API_KEY'),
      COMPOSIO_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(composioSecret, 'COMPOSIO_WEBHOOK_SECRET'),
      // Slack App (OAuth notifications) — only wired when slack-credentials secret exists
      ...(slackSecret ? {
        SLACK_CLIENT_ID: ecs.Secret.fromSecretsManager(slackSecret, 'SLACK_CLIENT_ID'),
        SLACK_CLIENT_SECRET: ecs.Secret.fromSecretsManager(slackSecret, 'SLACK_CLIENT_SECRET'),
        SLACK_STATE_SECRET: ecs.Secret.fromSecretsManager(slackSecret, 'SLACK_STATE_SECRET'),
      } : {}),
      // GitHub App
      GITHUB_APP_KEY: ecs.Secret.fromSecretsManager(githubAppKey),
      GITHUB_APP_ID: ecs.Secret.fromSecretsManager(githubAppSecrets, 'appId'),
      GITHUB_APP_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(githubAppSecrets, 'webhookSecret'),
      SENTRY_DSN: ecs.Secret.fromSecretsManager(sentryDsnSecret),
    };

    const sharedEnv: Record<string, string> = {
      NODE_ENV: 'production',
      STAGE: stage,
      LOG_LEVEL: stage === 'production' ? 'info' : 'debug',
      AWS_REGION: 'us-east-2',
      AWS_ACCOUNT_ID: '409171461008',
      DYNAMODB_TABLE_NAME: `${prefix}`,
      SQS_ALERT_QUEUE_URL: alertQueue.queueUrl,
      SQS_INVESTIGATION_QUEUE_URL: investigationQueue.queueUrl,
      SQS_REMEDIATION_QUEUE_URL: remediationQueue.queueUrl,
      SQS_PROGRESS_QUEUE_URL: progressQueue.queueUrl,
      ECS_CLUSTER: `${prefix}`,
      ECS_INVESTIGATION_TASK_DEF: `${prefix}-worker`,
      HINDSIGHT_BASE_URL: `http://hindsight.${prefix}.local:8888`,
      KMS_TOKEN_ENCRYPTION_KEY_ID: tokenEncryptionKey.keyId,
      INVESTIGATION_RELAY_URL: `wss://${domainName}/v1/investigation/ws`,
      ORCHESTRATOR_MODE_ENABLED: 'true',
      MASTRA_ENABLED: 'true',
      // Composio webhook — computed from API domain so triggers reach us
      COMPOSIO_WEBHOOK_URL: `https://${domainName}/webhooks/composio`,
      // Slack OAuth redirect — must match Slack app config
      SLACK_REDIRECT_URI: `https://${domainName}/v1/integrations/slack/oauth/callback`,
      // Dashboard URL — used by core to redirect after OAuth flows
      DASHBOARD_URL: stage === 'production' ? 'https://dashboard.causeflow.ai' : `https://dashboard-${stage}.causeflow.ai`,
      // Public API URL — used by core to build webhook URLs returned to clients
      API_URL: `https://${domainName}`,
    };

    // ============================================================
    // SECURITY GROUPS  (declared before task defs so sharedEnv mutations are visible)
    // ============================================================

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc, description: `ALB security group for ${prefix}`, allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS');

    const serviceSg = new ec2.SecurityGroup(this, 'ServiceSg', {
      vpc, description: `ECS service security group for ${prefix}`, allowAllOutbound: true,
    });
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'Allow ALB to reach ECS');

    // Inject subnet/SG IDs so the API can dispatch Fargate investigation tasks
    const privateSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });
    sharedEnv['ECS_SUBNET_IDS'] = cdk.Fn.join(',', privateSubnets.subnetIds);
    sharedEnv['ECS_SECURITY_GROUP_IDS'] = serviceSg.securityGroupId;

    // ============================================================
    // API TASK DEFINITION — container name MUST be 'causeflow' (matches deployed)
    // ============================================================

    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      family: prefix,  // causeflow-staging (NOT causeflow-staging-api)
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole,
      taskRole,
    });

    apiTaskDef.addContainer('causeflow', {
      image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
      containerName: 'causeflow',  // MUST match deployed
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      environment: {
        ...sharedEnv,
        PORT: '3000',
        REDIS_URL: 'redis://localhost:6379',
        OTEL_SERVICE_NAME: stage === 'production' ? 'causeflow-api' : `causeflow-${stage}-api`,
        OTEL_TRACES_EXPORTER: 'otlp',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_PROPAGATORS: 'xray,tracecontext,baggage',
        OTEL_RESOURCE_ATTRIBUTES: `deployment.environment=${stage}`,
        OTEL_TRACES_SAMPLER: 'xray',
        OTEL_BSP_MAX_QUEUE_SIZE: '4096',
      },
      secrets: taskSecrets,
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLogGroup, streamPrefix: 'api' }),
    });

    apiTaskDef.addContainer('redis', {
      image: ecs.ContainerImage.fromRegistry('redis:7-alpine'),
      containerName: 'redis',
      essential: false,
      portMappings: [{ containerPort: 6379, protocol: ecs.Protocol.TCP }],
      memoryLimitMiB: 128,
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLogGroup, streamPrefix: 'redis' }),
    });

    // ============================================================
    // WORKER TASK DEFINITION — container name MUST be 'investigation-worker'
    // ============================================================

    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      family: `${prefix}-worker`,
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole,
      taskRole,
    });

    workerTaskDef.addContainer('investigation-worker', {
      image: ecs.ContainerImage.fromEcrRepository(repository, `worker-${imageTag}`),
      containerName: 'investigation-worker',  // MUST match deployed
      essential: true,
      environment: {
        ...sharedEnv,
        OTEL_SERVICE_NAME: stage === 'production' ? 'causeflow-worker' : `causeflow-${stage}-worker`,
        OTEL_TRACES_EXPORTER: 'otlp',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_PROPAGATORS: 'xray,tracecontext,baggage',
        OTEL_RESOURCE_ATTRIBUTES: `deployment.environment=${stage}`,
        OTEL_TRACES_SAMPLER: 'xray',
        OTEL_BSP_MAX_QUEUE_SIZE: '4096',
      },
      secrets: taskSecrets,
      logging: ecs.LogDrivers.awsLogs({ logGroup: workerLogGroup, streamPrefix: 'worker' }),
    });

    // ============================================================
    // ALB — internet-facing, PUBLIC subnets
    // ============================================================

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: `${prefix}-alb`,
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },  // MUST be public for internet-facing
      securityGroup: albSg,
      idleTimeout: cdk.Duration.seconds(300), // WebSocket relay needs long-lived connections
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: `${prefix}-tg`,
      vpc, port: 3000, protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
    });

    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', permanent: true }),
    });

    alb.addListener('HttpsListener', {
      port: 443,
      certificates: [certificate],
      defaultTargetGroups: [targetGroup],
    });

    // ============================================================
    // ROUTE53 — A record for api-{stage}.causeflow.ai → ALB alias
    // ============================================================

    new route53.ARecord(this, 'ApiAliasRecord', {
      zone: hostedZone,
      recordName: stage === 'production' ? 'api' : `api-${stage}`,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
    });

    // ============================================================
    // ECS SERVICE — private subnets, NO public IP (NAT Gateway handles egress)
    // Gated by `deployServices` context flag. When false, the base infra
    // (cluster, ALB, target group, task defs) still deploys but no running
    // Services are created — the target group simply has zero targets.
    // ============================================================

    let apiService: ecs.FargateService | undefined;
    if (deployServices) {
      apiService = new ecs.FargateService(this, 'Service', {
        serviceName: prefix,  // causeflow-staging (NOT causeflow-staging-api)
        cluster,
        taskDefinition: apiTaskDef,
        desiredCount: 1,
        assignPublicIp: false,
        enableExecuteCommand: true,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [serviceSg],
        circuitBreaker: { enable: true, rollback: true },
        healthCheckGracePeriod: cdk.Duration.seconds(300),
      });

      targetGroup.addTarget(apiService);
    }

    // NOTE: The worker is NOT an ECS Service. It is a one-shot job task
    // launched via ecs:RunTask by the API when an investigation starts.
    // It requires INCIDENT_ID and TENANT_ID env vars passed as overrides
    // at runtime. An always-on Service would crashloop because those vars
    // are never set in the task definition. The workerTaskDef above is
    // sufficient — the API calls RunTask with container overrides.

    // ============================================================
    // CLOUDWATCH ALARMS
    // CPU alarm is gated because it references the ECS service metric.
    // DLQ alarms are unconditional — they only depend on SQS queues.
    // ============================================================

    if (apiService) {
      new cloudwatch.Alarm(this, 'CpuAlarm', {
        alarmName: `${prefix}-cpu-high`,
        alarmDescription: 'ECS CPU utilization > 80% for 5 minutes',
        metric: apiService.metricCpuUtilization({ period: cdk.Duration.minutes(1), statistic: 'Average' }),
        threshold: 80,
        evaluationPeriods: 5,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      });
    }

    for (const { queue, name } of [
      { queue: alertDLQ, name: 'alerts' },
      { queue: investigationDLQ, name: 'investigation' },
      { queue: remediationDLQ, name: 'remediation' },
      { queue: progressDLQ, name: 'progress' },
    ]) {
      new cloudwatch.Alarm(this, `DlqAlarm-${name}`, {
        alarmName: `${prefix}-dlq-${name}`,
        alarmDescription: `DLQ ${name} has messages`,
        metric: queue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1), statistic: 'Sum' }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      });
    }

    // ============================================================
    // HINDSIGHT (vectorize.io) — Internal ECS Fargate Service
    // Memory engine for CauseFlow agents. Self-hosted via ghcr.io/vectorize-io/hindsight.
    // Ports: 8888 (API), 9999 (UI). Requires LLM API key for embeddings/reasoning.
    // Uses embedded PostgreSQL with EFS volume for persistence.
    //
    // To enable:
    //   1. Create secret `causeflow-{stage}/hindsight-secrets` in Secrets Manager with keys:
    //      - HINDSIGHT_API_LLM_API_KEY (OpenAI/Anthropic key for Hindsight's internal LLM calls)
    //      - HINDSIGHT_API_KEY (optional — API key clients use to authenticate with Hindsight)
    //   2. Uncomment this section
    //   3. Uncomment HINDSIGHT_API_KEY in taskSecrets
    //   4. Deploy the stack
    // ============================================================

    if (deployServices) {
      // --- Cloud Map namespace for internal DNS ---
      const namespace = new servicediscovery.PrivateDnsNamespace(this, 'HindsightNamespace', {
        name: `${prefix}.local`,
        vpc,
        description: `Private DNS namespace for ${prefix} internal services`,
      });

      // --- Hindsight Security Group ---
      const hindsightSg = new ec2.SecurityGroup(this, 'HindsightSg', {
        vpc,
        description: `Hindsight memory engine security group for ${prefix}`,
        allowAllOutbound: true,
      });
      // Allow backend ECS service to reach Hindsight API (port 8888)
      hindsightSg.addIngressRule(serviceSg, ec2.Port.tcp(8888), 'Allow backend to reach Hindsight API');
      // Allow backend ECS service to reach Hindsight UI (port 9999) — optional, for debugging
      hindsightSg.addIngressRule(serviceSg, ec2.Port.tcp(9999), 'Allow backend to reach Hindsight UI');

      // --- EFS File System for Hindsight persistence ---
      // Hindsight writes embedded PostgreSQL to /home/hindsight/.pg0.
      // Without EFS, all memory banks are lost on task restart.
      // Staging: One Zone (single AZ, ~50% cheaper). Production: Standard (multi-AZ).
      // uid/gid 1000:1000 is the safe default for ghcr.io/vectorize-io/hindsight.
      // On first deploy, verify with: aws ecs execute-command ... 'id; ls -la /home/hindsight'
      // Adjust ownerUid/ownerGid + posixUser if container runs as root (uid 0).
      const isOneZone = stage === 'staging';
      const efsSubnets: ec2.SubnetSelection = isOneZone
        ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, availabilityZones: [vpc.availabilityZones[0]] }
        : { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS };

      const hindsightFs = new efs.FileSystem(this, 'HindsightFileSystem', {
        fileSystemName: `${prefix}-hindsight-fs`,
        vpc,
        vpcSubnets: efsSubnets,
        encrypted: true,
        performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
        throughputMode: efs.ThroughputMode.BURSTING,
        oneZone: isOneZone,
        removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
      hindsightFs.connections.allowDefaultPortFrom(hindsightSg, 'Allow Hindsight task to mount EFS');

      const hindsightAp = hindsightFs.addAccessPoint('HindsightAccessPoint', {
        path: '/data',
        createAcl: { ownerUid: '1000', ownerGid: '1000', permissions: '755' },
        posixUser: { uid: '1000', gid: '1000' },
      });

      // Grant EFS IAM permissions to the execution role
      executionRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: [
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:ClientWrite',
          'elasticfilesystem:DescribeMountTargets',
        ],
        resources: [hindsightFs.fileSystemArn],
      }));

      // --- Hindsight Log Group ---
      const hindsightLogGroup = new logs.LogGroup(this, 'HindsightLogGroup', {
        logGroupName: `/ecs/${prefix}-hindsight`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // --- Hindsight Task Definition ---
      const hindsightTaskDef = new ecs.FargateTaskDefinition(this, 'HindsightTaskDef', {
        family: `${prefix}-hindsight`,
        cpu: 1024,       // 1 vCPU — Hindsight does embedding + LLM calls
        memoryLimitMiB: 2048,  // 2 GB — embedded PostgreSQL + Python runtime
        executionRole,
        taskRole,
      });

      // EFS volume for persistent PostgreSQL storage
      hindsightTaskDef.addVolume({
        name: 'hindsight-data',
        efsVolumeConfiguration: {
          fileSystemId: hindsightFs.fileSystemId,
          transitEncryption: 'ENABLED',
          authorizationConfig: {
            accessPointId: hindsightAp.accessPointId,
            iam: 'ENABLED',
          },
        },
      });

      const hindsightContainer = hindsightTaskDef.addContainer('hindsight', {
        image: ecs.ContainerImage.fromRegistry('ghcr.io/vectorize-io/hindsight:latest'),
        containerName: 'hindsight',
        essential: true,
        portMappings: [
          { containerPort: 8888, protocol: ecs.Protocol.TCP },  // API
          { containerPort: 9999, protocol: ecs.Protocol.TCP },  // UI
        ],
        environment: {
          HINDSIGHT_API_LLM_PROVIDER: 'anthropic',
          HINDSIGHT_API_ENABLE_BANK_CONFIG_API: 'false',
        },
        secrets: {
          HINDSIGHT_API_LLM_API_KEY: ecs.Secret.fromSecretsManager(hindsightSecrets, 'HINDSIGHT_API_LLM_API_KEY'),
          HINDSIGHT_API_API_KEY: ecs.Secret.fromSecretsManager(hindsightSecrets, 'HINDSIGHT_API_KEY'),
        },
        logging: ecs.LogDrivers.awsLogs({ logGroup: hindsightLogGroup, streamPrefix: 'hindsight' }),
        // Health check — Hindsight exposes a health endpoint.
        // If curl is absent in the image, fall back to: wget -qO- http://localhost:8888/health
        healthCheck: {
          command: ['CMD-SHELL', 'curl -f http://localhost:8888/health || exit 1'],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          retries: 3,
          startPeriod: cdk.Duration.seconds(60),
        },
      });

      hindsightContainer.addMountPoints({
        sourceVolume: 'hindsight-data',
        containerPath: '/home/hindsight/.pg0',
        readOnly: false,
      });

      // --- Hindsight ECS Service (internal, no public IP) ---
      new ecs.FargateService(this, 'HindsightService', {
        serviceName: `${prefix}-hindsight`,
        cluster,
        taskDefinition: hindsightTaskDef,
        desiredCount: 1,
        assignPublicIp: false,
        enableExecuteCommand: true,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [hindsightSg],
        circuitBreaker: { enable: true, rollback: true },
        healthCheckGracePeriod: cdk.Duration.seconds(120),
        cloudMapOptions: {
          name: 'hindsight',
          cloudMapNamespace: namespace,
          dnsRecordType: servicediscovery.DnsRecordType.A,
          dnsTtl: cdk.Duration.seconds(10),
        },
      });

      // Output the internal DNS name for reference
      new cdk.CfnOutput(this, 'HindsightInternalDns', {
        value: `hindsight.${prefix}.local`,
        description: 'Internal DNS name for Hindsight service (use port 8888)',
      });
    }

    // ============================================================
    // WAF — WebACL + IP Set + ALB association
    // Protects ALB from scanners, bad IPs, and rate limiting.
    // See infra/snapshots/waf-staging-2026-04-11.json for original config.
    // ============================================================

    const blockedIpSet = new wafv2.CfnIPSet(this, 'BlockedIpSet', {
      name: `${prefix}-blocked-ips`,
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: [],
    });

    const waf = new wafv2.CfnWebACL(this, 'Waf', {
      name: `${prefix}-waf-v2`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${prefix}-waf`,
      },
      rules: [
        {
          name: 'AllowInvestigationWS',
          priority: 0,
          action: { allow: {} },
          statement: {
            byteMatchStatement: {
              searchString: '/v1/investigation/ws',
              fieldToMatch: { uriPath: {} },
              textTransformations: [{ priority: 0, type: 'NONE' }],
              positionalConstraint: 'STARTS_WITH',
            },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'AllowInvestigationWS' },
        },
        {
          name: 'BlockedIPs',
          priority: 1,
          action: { block: {} },
          statement: {
            ipSetReferenceStatement: { arn: blockedIpSet.attrArn },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'BlockedIPs' },
        },
        {
          name: 'BlockScannerPaths',
          priority: 2,
          action: { block: {} },
          statement: {
            orStatement: {
              statements: [
                { byteMatchStatement: { searchString: '.php', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'ENDS_WITH' } },
                { byteMatchStatement: { searchString: '.env', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
                { byteMatchStatement: { searchString: 'wp-', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
                { byteMatchStatement: { searchString: '/.git', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
                { byteMatchStatement: { searchString: '/etc/passwd', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
                { byteMatchStatement: { searchString: '/actuator', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'STARTS_WITH' } },
                { byteMatchStatement: { searchString: 'xmlrpc', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
                { byteMatchStatement: { searchString: 'wlwmanifest', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'LOWERCASE' }], positionalConstraint: 'CONTAINS' } },
              ],
            },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'BlockScannerPaths' },
        },
        {
          name: 'AWS-CommonRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'CommonRuleSet' },
        },
        {
          name: 'AWS-KnownBadInputs',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesKnownBadInputsRuleSet' },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'KnownBadInputs' },
        },
        {
          name: 'RateLimit',
          priority: 5,
          action: { block: {} },
          statement: {
            rateBasedStatement: { limit: 1000, evaluationWindowSec: 300, aggregateKeyType: 'IP' },
          },
          visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'RateLimit' },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'WafAlbAssociation', {
      resourceArn: alb.loadBalancerArn,
      webAclArn: waf.attrArn,
    });

    // ============================================================
    // OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, 'ClusterArn', { value: cluster.clusterArn });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'AlbDnsName', { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'EcrUri', { value: repository.repositoryUri });
    new cdk.CfnOutput(this, 'WorkerTaskDefArn', { value: workerTaskDef.taskDefinitionArn });
    new cdk.CfnOutput(this, 'WafAclArn', { value: waf.attrArn });
    new cdk.CfnOutput(this, 'KmsKeyId', { value: tokenEncryptionKey.keyId });
  }
}
