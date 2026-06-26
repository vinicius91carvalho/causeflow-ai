import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BootstrapStack } from '../lib/bootstrap-stack';

describe('BootstrapStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new BootstrapStack(app, 'TestBootstrap', {
      env: { account: '409171461008', region: 'us-east-2' },
      awsAccountId: '409171461008',
      awsRegion: 'us-east-2',
      githubOrg: 'causeflow',
      githubRepo: 'core',
    });
    template = Template.fromStack(stack);
  });

  // OIDC Provider — imported, NOT created
  it('imports the existing GitHub Actions OIDC provider (no new provider created)', () => {
    // The stack imports a pre-existing OIDC provider by ARN instead of creating one.
    // Therefore neither the CDK custom-resource variant nor the native CFN variant
    // should appear in the synthesized template.
    const resources = template.toJSON().Resources ?? {};
    const resourceTypes = Object.values(resources).map(
      (r: unknown) => (r as { Type: string }).Type,
    );
    expect(resourceTypes).not.toContain('Custom::AWSCDKOpenIdConnectProvider');
    expect(resourceTypes).not.toContain('AWS::IAM::OIDCProvider');
  });

  it("role's trust policy Federated principal is the imported OIDC provider ARN", () => {
    const expectedArn =
      'arn:aws:iam::409171461008:oidc-provider/token.actions.githubusercontent.com';
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'causeflow-github-deploy',
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Principal: {
              Federated: expectedArn,
            },
          }),
        ]),
      },
    });
  });

  // Deploy Role
  it('creates the causeflow-github-deploy IAM role', () => {
    // With the OIDC provider imported (not created), the stack should have
    // exactly one IAM::Role: the deploy role itself. No helper Lambda role.
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'causeflow-github-deploy',
      MaxSessionDuration: 3600,
    });
  });

  it('role trust policy restricts to the three allowed GitHub subjects', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'causeflow-github-deploy',
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              },
              StringLike: {
                'token.actions.githubusercontent.com:sub': [
                  'repo:causeflow/core:ref:refs/heads/main',
                  'repo:causeflow/core:environment:staging',
                  'repo:causeflow/core:environment:production',
                ],
              },
            },
          }),
        ]),
      },
    });
  });

  it('role has an inline policy attached', () => {
    // CDK emits inline policies as AWS::IAM::Policy resources attached via Roles.
    template.resourceCountIs('AWS::IAM::Policy', 1);
  });

  it('inline policy grants ECR push/pull scoped to causeflow-* repositories', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const [policy] = Object.values(policies);
    expect(policy).toBeDefined();
    const statements = (policy as any).Properties.PolicyDocument.Statement as Array<{
      Sid?: string;
      Effect?: string;
      Action?: string | string[];
      Resource?: string | string[];
    }>;
    const ecr = statements.find((s) => s.Sid === 'EcrPushPull');
    expect(ecr).toBeDefined();
    expect(ecr!.Effect).toBe('Allow');
    expect(ecr!.Resource).toBe('arn:aws:ecr:us-east-2:409171461008:repository/causeflow-*');
    const actions = Array.isArray(ecr!.Action) ? ecr!.Action : [ecr!.Action];
    expect(actions).toEqual(
      expect.arrayContaining([
        'ecr:BatchCheckLayerAvailability',
        'ecr:BatchGetImage',
        'ecr:CompleteLayerUpload',
        'ecr:GetDownloadUrlForLayer',
        'ecr:InitiateLayerUpload',
        'ecr:PutImage',
        'ecr:UploadLayerPart',
      ]),
    );
  });

  it('inline policy grants CloudFormation deploy scoped to causeflow-* stacks', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'CloudFormationDeploy',
            Effect: 'Allow',
            Resource: 'arn:aws:cloudformation:us-east-2:409171461008:stack/causeflow-*/*',
          }),
        ]),
      },
    });
  });

  it('inline policy does NOT grant secretsmanager:GetSecretValue', () => {
    // Walk every statement's Action list and assert GetSecretValue never appears.
    const policies = template.findResources('AWS::IAM::Policy');
    const allActions: string[] = [];
    for (const policy of Object.values(policies)) {
      const statements = (policy as any).Properties.PolicyDocument.Statement as Array<{
        Action: string | string[];
      }>;
      for (const s of statements) {
        const actions = Array.isArray(s.Action) ? s.Action : [s.Action];
        allActions.push(...actions);
      }
    }
    expect(allActions).not.toContain('secretsmanager:GetSecretValue');
  });

  it('inline policy grants iam:PassRole only for causeflow ECS roles with PassedToService condition', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'PassEcsTaskRoles',
            Effect: 'Allow',
            Action: 'iam:PassRole',
            Condition: {
              StringEquals: {
                'iam:PassedToService': 'ecs-tasks.amazonaws.com',
              },
            },
          }),
        ]),
      },
    });
  });

  it('inline policy allows assuming CDK bootstrap roles', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'CdkBootstrapAssume',
            Effect: 'Allow',
            Action: 'sts:AssumeRole',
            Resource: 'arn:aws:iam::409171461008:role/cdk-hnb659fds-*',
          }),
        ]),
      },
    });
  });

  // Outputs
  it('exports the expected CfnOutputs for configuring GitHub variables', () => {
    template.hasOutput('DeployRoleArn', {});
    template.hasOutput('OidcProviderArn', {});
    template.hasOutput('AwsAccountId', {});
    template.hasOutput('AwsRegion', {});
    template.hasOutput('EcrRegistry', {});
  });

  it('exports DeployRoleArn with a stable export name', () => {
    template.hasOutput('DeployRoleArn', {
      Export: { Name: 'causeflow-bootstrap-DeployRoleArn' },
    });
  });
});
