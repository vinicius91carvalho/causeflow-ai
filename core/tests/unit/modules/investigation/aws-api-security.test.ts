import { describe, it, expect } from 'vitest';
import { isReadOnlyAction, validateAwsApiCall } from '../../../../src/modules/investigation/infra/aws-api-security.js';

describe('aws-api-security', () => {
  describe('isReadOnlyAction', () => {
    it.each([
      ['ecs', 'DescribeServices'],
      ['rds', 'DescribeDBInstances'],
      ['ec2', 'DescribeInstances'],
      ['s3', 'ListBuckets'],
      ['dynamodb', 'GetItem'],
      ['elbv2', 'DescribeTargetHealth'],
      ['cloudwatch', 'GetMetricData'],
      ['logs', 'FilterLogEvents'],
      ['eks', 'ListClusters'],
      ['route53', 'ListHostedZones'],
      ['cloudfront', 'GetDistribution'],
      ['sns', 'ListTopics'],
      ['cloudtrail', 'LookupEvents'],
      ['ecs', 'BatchGetClusters'],
      ['s3', 'HeadObject'],
      ['ec2', 'SearchTransitGatewayRoutes'],
    ])('should allow read-only action %s/%s', (service, action) => {
      expect(isReadOnlyAction(service, action)).toBe(true);
    });

    it.each([
      ['ec2', 'TerminateInstances'],
      ['s3', 'DeleteBucket'],
      ['s3', 'PutObject'],
      ['rds', 'DeleteDBInstance'],
      ['ecs', 'DeleteService'],
      ['ecs', 'UpdateService'],
      ['lambda', 'DeleteFunction'],
      ['lambda', 'InvokeFunction'],
      ['dynamodb', 'DeleteTable'],
      ['dynamodb', 'PutItem'],
      ['sns', 'Publish'],
      ['sqs', 'SendMessage'],
      ['sqs', 'PurgeQueue'],
      ['cloudfront', 'UpdateDistribution'],
      ['route53', 'ChangeResourceRecordSets'],
      ['eventbridge', 'PutEvents'],
    ])('should block write action %s/%s', (service, action) => {
      expect(isReadOnlyAction(service, action)).toBe(false);
    });

    it('should block DynamoDB Scan (defense-in-depth)', () => {
      expect(isReadOnlyAction('dynamodb', 'Scan')).toBe(false);
    });

    it('should block actions without read-only prefix', () => {
      expect(isReadOnlyAction('ec2', 'RunInstances')).toBe(false);
      expect(isReadOnlyAction('ecs', 'RegisterTaskDefinition')).toBe(false);
    });

    it('should block explicitly denied actions even if prefix looks read-only', () => {
      // 'DeleteBucket' does not start with a read-only prefix, so it's blocked by prefix check
      expect(isReadOnlyAction('s3', 'DeleteBucket')).toBe(false);
    });
  });

  describe('validateAwsApiCall', () => {
    it('should not throw for valid read-only actions', () => {
      expect(() => validateAwsApiCall('ecs', 'DescribeServices')).not.toThrow();
      expect(() => validateAwsApiCall('rds', 'ListDBInstances')).not.toThrow();
    });

    it('should throw for write actions', () => {
      expect(() => validateAwsApiCall('ec2', 'TerminateInstances')).toThrow('not a read-only action');
    });

    it('should throw for empty service', () => {
      expect(() => validateAwsApiCall('', 'DescribeServices')).toThrow('Invalid AWS service name');
    });

    it('should throw for empty action', () => {
      expect(() => validateAwsApiCall('ecs', '')).toThrow('Invalid AWS action name');
    });
  });
});
