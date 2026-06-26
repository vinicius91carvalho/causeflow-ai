import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

/**
 * CauseFlow Bootstrap Stack
 * ------------------------
 * Control-plane stack deployed ONCE manually from an admin laptop. Creates the
 * GitHub Actions OIDC provider and the `causeflow-github-deploy` IAM role that
 * every deploy workflow subsequently assumes. Kept in its own stack (and its
 * own CDK app entry point) so that a failed app-stack deploy can never lock
 * out the deploy role itself.
 *
 * Outputs:
 *   - DeployRoleArn: the ARN used as `vars.DEPLOY_ROLE_ARN` in GitHub Actions
 *
 * See `infra/cdk/README.md` for the one-time bootstrap procedure.
 */
export interface BootstrapStackProps extends cdk.StackProps {
  /** AWS account ID (e.g. '409171461008') */
  readonly awsAccountId: string;
  /** AWS region (e.g. 'us-east-2') */
  readonly awsRegion: string;
  /** GitHub organization name (e.g. 'causeflow') */
  readonly githubOrg: string;
  /** GitHub repository name (e.g. 'causeflow') */
  readonly githubRepo: string;
}

export class BootstrapStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id, props);

    const { awsAccountId, awsRegion, githubOrg, githubRepo } = props;

    // ============================================================
    // GitHub Actions OIDC Provider (imported)
    // ============================================================
    // Only one provider for `token.actions.githubusercontent.com` can exist
    // per AWS account. A pre-existing project (`causeflow-web`) already
    // created it, so we import the existing resource by ARN instead of
    // creating a new one (previous `new iam.OpenIdConnectProvider(...)` call
    // failed with `EntityAlreadyExistsException` on first deploy).
    //
    // The ARN is deterministic — it depends only on the account ID and the
    // provider URL — so we build it from stack props.
    const oidcProviderArn = `arn:aws:iam::${awsAccountId}:oidc-provider/token.actions.githubusercontent.com`;
    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidcProvider',
      oidcProviderArn,
    );

    // ============================================================
    // Trust policy — restrict AssumeRoleWithWebIdentity to this repo
    // ============================================================
    const trustedSubjects = [
      `repo:${githubOrg}/${githubRepo}:ref:refs/heads/main`,
      `repo:${githubOrg}/${githubRepo}:environment:staging`,
      `repo:${githubOrg}/${githubRepo}:environment:production`,
    ];

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'causeflow-github-deploy',
      description:
        'Role assumed by GitHub Actions via OIDC to deploy CauseFlow stacks. Created by the bootstrap stack.',
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': trustedSubjects,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // ============================================================
    // Inline policy — minimum permissions for CI/CD
    // ============================================================
    // Deliberately scoped to `causeflow-*` resources in this account/region.
    // Explicitly does NOT grant secretsmanager:GetSecretValue — that stays
    // with the ECS task execution role only. CI only lists + describes.

    // ECR: auth token must be * (AWS requirement), everything else scoped.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcrAuthToken',
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcrPushPull',
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:BatchGetImage',
        'ecr:CompleteLayerUpload',
        'ecr:GetDownloadUrlForLayer',
        'ecr:InitiateLayerUpload',
        'ecr:PutImage',
        'ecr:UploadLayerPart',
      ],
      resources: [`arn:aws:ecr:${awsRegion}:${awsAccountId}:repository/causeflow-*`],
    }));

    // CloudFormation: scoped to causeflow-* stacks only.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudFormationDeploy',
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:CreateStack',
        'cloudformation:UpdateStack',
        'cloudformation:DeleteStack',
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackEvents',
        'cloudformation:DescribeStackResources',
        'cloudformation:GetTemplate',
        'cloudformation:GetTemplateSummary',
        'cloudformation:CreateChangeSet',
        'cloudformation:DeleteChangeSet',
        'cloudformation:DescribeChangeSet',
        'cloudformation:ExecuteChangeSet',
        'cloudformation:ListStacks',
        'cloudformation:ListStackResources',
      ],
      resources: [
        `arn:aws:cloudformation:${awsRegion}:${awsAccountId}:stack/causeflow-*/*`,
      ],
    }));

    // ECS: scoped to causeflow-* clusters via condition where possible.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcsReadAndUpdate',
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:DescribeServices',
        'ecs:DescribeTasks',
        'ecs:ListTasks',
        'ecs:ListServices',
        'ecs:UpdateService',
      ],
      resources: ['*'],
      conditions: {
        StringLike: {
          'ecs:cluster': [
            `arn:aws:ecs:${awsRegion}:${awsAccountId}:cluster/causeflow-*`,
          ],
        },
      },
    }));
    // DescribeTaskDefinition/DescribeClusters do not support resource-level perms.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcsDescribeUnscoped',
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:DescribeTaskDefinition',
        'ecs:DescribeClusters',
        'ecs:ListClusters',
      ],
      resources: ['*'],
    }));

    // Secrets Manager: list + describe only. NEVER GetSecretValue.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerListDescribe',
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:ListSecrets'],
      resources: ['*'],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerDescribe',
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:DescribeSecret'],
      resources: [
        `arn:aws:secretsmanager:${awsRegion}:${awsAccountId}:secret:causeflow-*`,
      ],
    }));

    // iam:PassRole — required for CDK to attach ECS task/execution roles.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PassEcsTaskRoles',
      effect: iam.Effect.ALLOW,
      actions: ['iam:PassRole'],
      resources: [
        `arn:aws:iam::${awsAccountId}:role/causeflow-*-ecs-execution`,
        `arn:aws:iam::${awsAccountId}:role/causeflow-*-ecs-task`,
      ],
      conditions: {
        StringEquals: {
          'iam:PassedToService': 'ecs-tasks.amazonaws.com',
        },
      },
    }));

    // CDK bootstrap roles — CDK will AssumeRole on these during deploy.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CdkBootstrapAssume',
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [
        `arn:aws:iam::${awsAccountId}:role/cdk-hnb659fds-*`,
      ],
    }));

    // CDK asset bucket — synth/deploy uploads templates and bundled assets.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CdkAssetBucketRw',
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:GetBucketLocation'],
      resources: [
        'arn:aws:s3:::cdk-hnb659fds-assets-*',
        'arn:aws:s3:::cdk-hnb659fds-assets-*/*',
      ],
    }));

    // CloudWatch Logs — fetch container logs for post-deploy diagnostics.
    deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'LogsRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:GetLogEvents',
        'logs:FilterLogEvents',
      ],
      resources: [
        `arn:aws:logs:${awsRegion}:${awsAccountId}:log-group:/ecs/causeflow-*:*`,
      ],
    }));

    this.deployRole = deployRole;

    // ============================================================
    // Outputs
    // ============================================================
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description:
        'ARN to set as repo variable DEPLOY_ROLE_ARN in GitHub Actions (Settings → Variables).',
      exportName: 'causeflow-bootstrap-DeployRoleArn',
    });
    new cdk.CfnOutput(this, 'OidcProviderArn', {
      value: oidcProviderArn,
      description: 'GitHub Actions OIDC provider ARN (imported, one per account).',
    });
    new cdk.CfnOutput(this, 'AwsAccountId', {
      value: awsAccountId,
      description: 'AWS account ID — set as repo variable AWS_ACCOUNT_ID.',
    });
    new cdk.CfnOutput(this, 'AwsRegion', {
      value: awsRegion,
      description: 'AWS region — set as repo variable AWS_REGION.',
    });
    new cdk.CfnOutput(this, 'EcrRegistry', {
      value: `${awsAccountId}.dkr.ecr.${awsRegion}.amazonaws.com`,
      description: 'ECR registry URI — set as repo variable ECR_REGISTRY.',
    });
  }
}
