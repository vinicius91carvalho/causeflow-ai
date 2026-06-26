/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'causeflow-website',
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
    // WAF must be in us-east-1 for CloudFront association
    const usEast1 = new aws.Provider('us-east-1', { region: 'us-east-1' });

    const waf = new aws.wafv2.WebAcl(
      'CauseFlowWaf',
      {
        scope: 'CLOUDFRONT',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: 'causeflow-waf',
          sampledRequestsEnabled: true,
        },
        rules: [
          // AWS Managed Common Rule Set
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
              metricName: 'common-rules',
              sampledRequestsEnabled: true,
            },
          },
          // AWS Managed Known Bad Inputs
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
              metricName: 'known-bad-inputs',
              sampledRequestsEnabled: true,
            },
          },
          // AWS Managed IP Reputation List
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
              metricName: 'ip-reputation',
              sampledRequestsEnabled: true,
            },
          },
          // Site-wide rate limit: 1000 requests per 5 minutes per IP
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
              metricName: 'site-rate-limit',
              sampledRequestsEnabled: true,
            },
          },
          // API rate limit: 100 requests per 5 minutes per IP on /api/*
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
              metricName: 'api-rate-limit',
              sampledRequestsEnabled: true,
            },
          },
        ],
      },
      { provider: usEast1 },
    );

    new sst.aws.Nextjs('CauseFlowWebsite', {
      path: '.',
      domain:
        $app.stage === 'production'
          ? {
              name: 'causeflow.ai',
              // causeflow.com.br / www.causeflow.com.br are handled by a dedicated
              // CloudFront distribution below that redirects directly to /pt-br/.
              redirects: ['www.causeflow.ai', 'causeflow.io', 'www.causeflow.io'],
            }
          : `${$app.stage}.causeflow.ai`,
      environment: {
        NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? '',
        NEXT_PUBLIC_CLARITY_ID: process.env.NEXT_PUBLIC_CLARITY_ID ?? '',
        NEXT_PUBLIC_DEPLOYMENT_STAGE: $app.stage,
        NEXT_PUBLIC_STAGING_PASSWORD: $app.stage === 'staging' ? 'causeflow-staging-2026' : '',
        NEXT_PUBLIC_SITE_URL:
          $app.stage === 'production'
            ? 'https://causeflow.ai'
            : `https://${$app.stage}.causeflow.ai`,
        NEXT_PUBLIC_DASHBOARD_URL:
          $app.stage === 'production'
            ? 'https://dashboard.causeflow.ai'
            : `https://dashboard-${$app.stage}.causeflow.ai`,
        LOOPS_API_KEY: process.env.LOOPS_API_KEY ?? '',
        DYNAMODB_TABLE_NAME: `causeflow-dashboard-${$app.stage}`,
        AWS_REGION_OVERRIDE: 'us-east-2',
      },
      permissions: [
        {
          actions: ['dynamodb:GetItem'],
          resources: [
            `arn:aws:dynamodb:us-east-2:409171461008:table/causeflow-dashboard-${$app.stage}`,
          ],
        },
      ],
      // CloudFront invalidation handled by CI/CD workflow (aws cloudfront create-invalidation)
      // SST's built-in invalidation is unreliable — Pulumi skips it when config hasn't changed
      invalidation: false,
      transform: {
        cdn: (args) => {
          args.webAclId = waf.arn;
          args.waitForDeployment = false;
        },
      },
    });

    // causeflow.com.br → causeflow.ai/pt-br/ redirect
    // Managed outside SST via AWS CLI (not in Pulumi state) to avoid
    // slow ACM cert validation blocking every deploy.
    // Resources:
    //   - Route 53 hosted zone: Z06468712PG18EQG6DO7I (causeflow.com.br)
    //   - ACM cert: arn:aws:acm:us-east-1:409171461008:certificate/efdbed9c-a0cb-4717-a845-8f93c652cfb0
    //   - CloudFront distribution: E214WXV30A2Q96 (d15va8gxx5e2st.cloudfront.net)
    //   - CloudFront Function: causeflow-com-br-redirect (301 → causeflow.ai/pt-br/*)
  },
});
