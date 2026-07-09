/**
 * Integration field definitions and validation schemas.
 *
 * Pure domain logic — no React or framework imports.
 * Used by the integrations ConnectionModal for credential-based integrations (AWS only).
 * All other integrations use Composio OAuth — no manual fields needed.
 */

import { z } from 'zod';
import type { IntegrationType } from './types';

export type FieldDef = {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  type: 'text' | 'password' | 'email' | 'url' | 'textarea' | 'select';
  required: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
};

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-west-2', label: 'EU (London)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

export const INTEGRATION_FIELDS: Partial<Record<IntegrationType, FieldDef[]>> = {
  // AWS — credential-based (IAM AssumeRole). Only roleArn needed; externalId is auto-generated.
  cloudwatch: [
    {
      key: 'roleArn',
      labelKey: 'fields.roleArn',
      placeholderKey: 'fields.roleArnPlaceholder',
      type: 'text',
      required: true,
    },
    {
      key: 'region',
      labelKey: 'fields.region',
      type: 'select',
      required: true,
      options: AWS_REGIONS,
      defaultValue: 'us-east-2',
    },
  ],
  // PostgreSQL — connection string (for Relay-based DB access)
  postgresql: [
    {
      key: 'connectionString',
      labelKey: 'fields.connectionString',
      type: 'password',
      required: true,
    },
  ],
  // MongoDB — connection string (for Relay-based DB access)
  mongodb: [
    {
      key: 'connectionString',
      labelKey: 'fields.connectionString',
      type: 'password',
      required: true,
    },
  ],
  // Grafana — self-hosted, needs URL + API key
  grafana: [
    { key: 'apiKey', labelKey: 'fields.apiKey', type: 'password', required: true },
    {
      key: 'url',
      labelKey: 'fields.domain',
      placeholderKey: 'fields.grafanaUrlPlaceholder',
      type: 'url',
      required: true,
    },
  ],
  // Webhooks — custom webhook URL
  webhooks: [
    {
      key: 'webhookUrl',
      labelKey: 'fields.webhookUrl',
      placeholderKey: 'fields.webhookUrlPlaceholder',
      type: 'url',
      required: true,
    },
  ],
  // All other integrations (GitHub, Slack, Jira, etc.) use OAuth — no fields.
};

export function buildValidationSchema(type: IntegrationType, errorMsg: string) {
  const requiredStr = z.string().min(1, errorMsg);
  switch (type) {
    case 'cloudwatch':
      return z.object({
        roleArn: z
          .string()
          .min(1, errorMsg)
          .regex(/^arn:aws:iam::\d{12}:role\//, 'Must be a valid IAM Role ARN'),
        region: z.string().min(1, errorMsg),
      });
    case 'postgresql':
    case 'mongodb':
      return z.object({ connectionString: requiredStr });
    case 'grafana':
      return z.object({ apiKey: requiredStr, url: z.string().url('Please enter a valid URL') });
    case 'webhooks':
      return z.object({ webhookUrl: z.string().url('Please enter a valid URL') });
    default:
      return z.object({}); // OAuth — no manual validation
  }
}
