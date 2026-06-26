import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CauseFlowStack } from '../lib/causeflow-stack';

describe('CauseFlowStack (default — no ECS Service)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App({ context: { stage: 'staging', imageTag: 'test123' } });
    const stack = new CauseFlowStack(app, 'TestStack', {
      env: { account: '409171461008', region: 'us-east-2' },
      stage: 'staging',
    });
    template = Template.fromStack(stack);
  });

  // SQS Queues — 4 main queues + 4 DLQs = 8 total
  it('should create 8 SQS queues (4 main + 4 DLQs)', () => {
    template.resourceCountIs('AWS::SQS::Queue', 8);
  });

  it('should create alert queue with stage prefix', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'causeflow-staging-alerts',
      VisibilityTimeout: 300,
    });
  });

  it('should create investigation queue with stage prefix', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'causeflow-staging-investigation',
      VisibilityTimeout: 900,
    });
  });

  it('should create progress queue with stage prefix', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'causeflow-staging-progress',
      VisibilityTimeout: 300,
    });
  });

  it('should create progress DLQ with stage prefix', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'causeflow-staging-progress-dlq',
    });
  });

  // ECS
  it('should create ECS cluster with stage prefix', () => {
    template.resourceCountIs('AWS::ECS::Cluster', 1);
    template.hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'causeflow-staging',
    });
  });

  it('should NOT create an ECS Service by default (two-pass deploy)', () => {
    template.resourceCountIs('AWS::ECS::Service', 0);
  });

  // 2 task definitions: API + Worker
  it('should create 2 ECS task definitions (API + Worker)', () => {
    template.resourceCountIs('AWS::ECS::TaskDefinition', 2);
  });

  it('should create API task definition with Redis sidecar', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Family: 'causeflow-staging',
      Cpu: '512',
      Memory: '1024',
    });
  });

  it('should create Worker task definition', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Family: 'causeflow-staging-worker',
      Cpu: '512',
      Memory: '1024',
    });
  });

  // VPC — 1 NAT Gateway
  it('should create VPC with 1 NAT Gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  // ALB
  it('should create ALB', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Name: 'causeflow-staging-alb',
      Scheme: 'internet-facing',
    });
  });

  it('should create target group with health check on /health', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 3000,
      Protocol: 'HTTP',
      TargetType: 'ip',
      HealthCheckPath: '/health',
    });
  });

  // CloudWatch log groups — dedicated per role (hard cutover from old single group)
  it('should create API log group with 30-day retention in staging', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/ecs/causeflow-staging-api',
      RetentionInDays: 30,
    });
  });

  it('should create Worker log group with 30-day retention in staging', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/ecs/causeflow-staging-worker',
      RetentionInDays: 30,
    });
  });

  it('should NOT have the old single log group /ecs/causeflow-staging', () => {
    const logGroups = template.findResources('AWS::Logs::LogGroup');
    const names = Object.values(logGroups).map(
      (r) => (r as { Properties: { LogGroupName?: string } }).Properties.LogGroupName,
    );
    expect(names).not.toContain('/ecs/causeflow-staging');
  });

  it('should have exactly 2 log groups (api + worker)', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
  });

  // X-Ray write-only IAM policy — exactly 4 actions, no read actions
  it('should have X-Ray write-only inline policy with exactly 4 actions on task role', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const xrayPolicy = Object.values(policies).find((p) => {
      const doc = (p as { Properties: { PolicyDocument: { Statement: Array<{ Action: string[] }> } } })
        .Properties.PolicyDocument;
      return doc.Statement.some((s) =>
        Array.isArray(s.Action) && s.Action.includes('xray:PutTraceSegments'),
      );
    });
    expect(xrayPolicy).toBeDefined();
    const doc = (xrayPolicy as { Properties: { PolicyDocument: { Statement: Array<{ Action: string[] }> } } })
      .Properties.PolicyDocument;
    const xrayStatement = doc.Statement.find((s) =>
      Array.isArray(s.Action) && s.Action.includes('xray:PutTraceSegments'),
    );
    expect(xrayStatement).toBeDefined();
    const actions = xrayStatement!.Action;
    expect(actions).toHaveLength(4);
    expect(actions).toContain('xray:PutTraceSegments');
    expect(actions).toContain('xray:PutTelemetryRecords');
    expect(actions).toContain('xray:GetSamplingRules');
    expect(actions).toContain('xray:GetSamplingTargets');
    // Must NOT have read actions
    expect(actions).not.toContain('xray:GetTraceSummaries');
    expect(actions).not.toContain('xray:BatchGetTraces');
    expect(actions.some((a: string) => a.startsWith('xray:Get') && a !== 'xray:GetSamplingRules' && a !== 'xray:GetSamplingTargets')).toBe(false);
  });

  it('should NOT create the CPU alarm by default (depends on the ECS Service)', () => {
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const alarmNames = Object.values(alarms).map(
      (a) => (a as { Properties: { AlarmName: string } }).Properties.AlarmName,
    );
    expect(alarmNames).not.toContain('causeflow-staging-cpu-high');
  });

  it('should create 4 DLQ depth alarms', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'causeflow-staging-dlq-alerts',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'causeflow-staging-dlq-investigation',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'causeflow-staging-dlq-remediation',
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'causeflow-staging-dlq-progress',
    });
  });

  // Outputs
  it('should have expected CfnOutputs', () => {
    template.hasOutput('ClusterArn', {});
    template.hasOutput('TableName', {});
    template.hasOutput('AlbDnsName', {});
    template.hasOutput('VpcId', {});
    template.hasOutput('EcrUri', {});
    template.hasOutput('WorkerTaskDefArn', {});
  });

  // No ElastiCache (Redis is sidecar)
  it('should NOT create ElastiCache (Redis is sidecar)', () => {
    template.resourceCountIs('AWS::ElastiCache::CacheCluster', 0);
  });

  // Route53 A record for api-staging.causeflow.ai → ALB alias
  it('should create Route53 A record alias pointing at the ALB', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'api-staging.causeflow.ai.',
      Type: 'A',
      HostedZoneId: 'Z01593322DGY9I94W9S7C',
    });
  });
});

describe('CauseFlowStack with deployServices=true (pass 2)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App({
      context: { stage: 'staging', imageTag: 'test123', deployServices: 'true' },
    });
    const stack = new CauseFlowStack(app, 'TestStackWithSvc', {
      env: { account: '409171461008', region: 'us-east-2' },
      stage: 'staging',
    });
    template = Template.fromStack(stack);
  });

  it('should create the ECS Fargate Service when deployServices=true', () => {
    // 2 services: API + Hindsight. Worker is a RunTask job, not a Service.
    template.resourceCountIs('AWS::ECS::Service', 2);
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'causeflow-staging',
      DesiredCount: 1,
      LaunchType: 'FARGATE',
    });
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'causeflow-staging-hindsight',
    });
  });

  it('should still create all task definitions when deployServices=true', () => {
    template.resourceCountIs('AWS::ECS::TaskDefinition', 3);
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Family: 'causeflow-staging',
    });
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Family: 'causeflow-staging-worker',
    });
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Family: 'causeflow-staging-hindsight',
    });
  });

  it('should still create the target group when deployServices=true', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 3000,
      TargetType: 'ip',
      HealthCheckPath: '/health',
    });
  });

  it('should still create the ALB, listeners, and Route53 record when deployServices=true', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 2);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'api-staging.causeflow.ai.',
      Type: 'A',
    });
  });

  it('should create the CPU alarm when deployServices=true', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'causeflow-staging-cpu-high',
      Threshold: 80,
    });
  });
});
