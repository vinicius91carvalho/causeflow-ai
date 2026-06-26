/// <reference path="./.sst/platform/config.d.ts" />

/**
 * CauseFlow AI Dashboard — SST v3 Infrastructure
 *
 * Resources:
 *   - WAF WebACL (rate limiting, bot protection, IP reputation)
 *   - CloudWatch Alarms (Lambda errors, 5xx errors)
 *   - Next.js SSR app (Lambda + CloudFront)
 *
 * Auth: Clerk (no Cognito — auth handled entirely by Clerk)
 * Data: Backend API via CORE_API_URL (no DynamoDB/KMS in dashboard)
 *
 * NOTE: WAF must be deployed in us-east-1 for CloudFront association.
 */
export default $config({
  app(input) {
    return {
      name: 'causeflow-dashboard',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: { region: 'us-east-2' },
      },
    };
  },
  async run() {
    const { config } = await import('dotenv');
    config({ path: '.env.local' });

    // ---------------------------------------------------------------------------
    // WAF — must be in us-east-1 for CloudFront association
    // ---------------------------------------------------------------------------
    const usEast1 = new aws.Provider('us-east-1', { region: 'us-east-1' });

    const waf = new aws.wafv2.WebAcl(
      'CauseFlowDashboardWaf',
      {
        scope: 'CLOUDFRONT',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: 'causeflow-dashboard-waf',
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: 'dashboard-common-rules',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            priority: 2,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: 'dashboard-known-bad-inputs',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWSManagedRulesAmazonIpReputationList',
            priority: 3,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesAmazonIpReputationList',
              },
            },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: 'dashboard-ip-reputation',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'SiteWideRateLimit',
            priority: 4,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                limit: 1000,
                evaluationWindowSec: 300,
                aggregateKeyType: 'IP',
              },
            },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: 'dashboard-site-rate-limit',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'ApiRateLimit',
            priority: 5,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                limit: 100,
                evaluationWindowSec: 300,
                aggregateKeyType: 'IP',
                scopeDownStatement: {
                  byteMatchStatement: {
                    searchString: '/api/',
                    fieldToMatch: { uriPath: {} },
                    textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                    positionalConstraint: 'STARTS_WITH',
                  },
                },
              },
            },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: 'dashboard-api-rate-limit',
              sampledRequestsEnabled: true,
            },
          },
        ],
        tags: {
          App: 'causeflow-dashboard',
          Stage: $app.stage,
        },
      },
      { provider: usEast1 },
    );

    // ---------------------------------------------------------------------------
    // Dashboard Next.js app
    // ---------------------------------------------------------------------------
    const dashboard = new sst.aws.Nextjs('CauseFlowDashboard', {
      path: '.',
      domain:
        $app.stage === 'production'
          ? { name: 'dashboard.causeflow.ai' }
          : `dashboard-${$app.stage}.causeflow.ai`,
      environment: {
        // Analytics
        NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? '',
        NEXT_PUBLIC_CLARITY_ID: process.env.NEXT_PUBLIC_CLARITY_ID ?? '',
        NEXT_PUBLIC_DEPLOYMENT_STAGE: $app.stage,
        NEXT_PUBLIC_STAGING_PASSWORD: $app.stage === 'staging' ? 'causeflow-staging-2026' : '',
        NEXT_PUBLIC_SITE_URL:
          $app.stage === 'production'
            ? 'https://dashboard.causeflow.ai'
            : `https://dashboard-${$app.stage}.causeflow.ai`,

        // Clerk Auth
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? '',
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/auth/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/auth/sign-up',
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/dashboard',
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/onboarding/welcome',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/dashboard',
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/onboarding/welcome',
        NEXT_PUBLIC_CLERK_WAITLIST_URL: '/waitlist',

        // CauseFlow Backend API
        CORE_API_URL: process.env.CORE_API_URL ?? '',

        // Stripe billing (client-side publishable key only)
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',

        // App version
        APP_VERSION: process.env.APP_VERSION ?? '0.1.0',

        // Sentry error tracking (client-side only — DSN is the public ingest key)
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
      },
      invalidation: false,
      transform: {
        cdn: (args) => {
          args.webAclId = waf.arn;
          args.waitForDeployment = false;
        },
      },
    });

    // ---------------------------------------------------------------------------
    // CloudWatch Alarms (production only)
    // ---------------------------------------------------------------------------
    if ($app.stage === 'production') {
      const alarmTopic = new aws.sns.Topic('CauseFlowDashboardAlarms', {
        name: `causeflow-dashboard-alarms-${$app.stage}`,
        tags: { App: 'causeflow-dashboard', Stage: $app.stage },
      });

      new aws.cloudwatch.MetricAlarm('DashboardLambdaErrors', {
        name: `causeflow-dashboard-lambda-errors-${$app.stage}`,
        alarmDescription: 'Dashboard Lambda error rate exceeded threshold',
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensions: {
          FunctionName: $interpolate`${dashboard.url}`.apply(() => 'causeflow-dashboard-server'),
        },
        statistic: 'Sum',
        period: 300,
        evaluationPeriods: 2,
        threshold: 5,
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alarmTopic.arn],
        okActions: [alarmTopic.arn],
        tags: { App: 'causeflow-dashboard', Stage: $app.stage },
      });

      new aws.cloudwatch.MetricAlarm('DashboardCloudFront5xxErrors', {
        name: `causeflow-dashboard-5xx-errors-${$app.stage}`,
        alarmDescription: 'Dashboard CloudFront 5xx error rate exceeded 0.5%',
        namespace: 'AWS/CloudFront',
        metricName: '5xxErrorRate',
        statistic: 'Average',
        period: 300,
        evaluationPeriods: 2,
        threshold: 0.5,
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alarmTopic.arn],
        okActions: [alarmTopic.arn],
        tags: { App: 'causeflow-dashboard', Stage: $app.stage },
      });
    }

    // ---------------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------------
    return {
      dashboardUrl: dashboard.url,
    };
  },
});
