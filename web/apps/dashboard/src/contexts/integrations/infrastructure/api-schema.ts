import { z } from 'zod';

/**
 * Zod validation schemas for the Integrations context API routes.
 */

export const connectIntegrationSchema = z.discriminatedUnion('type', [
  // --- MVP integrations ---
  z.object({
    type: z.literal('cloudwatch'),
    roleArn: z
      .string()
      .min(1, 'Role ARN is required')
      .regex(/^arn:aws:iam::\d{12}:role\//, 'Must be a valid IAM Role ARN'),
    externalId: z.string().min(1, 'External ID is required'),
  }),
  z.object({
    type: z.literal('slack'),
    // OAuth — no manual credential fields
  }),
  z.object({
    type: z.literal('jira'),
    email: z.string().email('Please enter a valid email address'),
    apiToken: z.string().min(1, 'API Token is required'),
    domain: z.string().url('Please enter a valid Jira domain URL'),
  }),
  z.object({
    type: z.literal('trello'),
    apiKey: z.string().min(1, 'API Key is required'),
    apiToken: z.string().min(1, 'API Token is required'),
  }),
  z.object({
    type: z.literal('github'),
    installationId: z.string().min(1, 'Installation ID is required'),
    appId: z.string().min(1, 'App ID is required'),
    privateKey: z
      .string()
      .min(1, 'Private Key is required')
      .regex(/-----BEGIN/, 'Must be a valid PEM private key'),
  }),
  z.object({
    type: z.literal('hubspot'),
    accessToken: z
      .string()
      .min(1, 'Access Token is required')
      .regex(/^pat-/, 'Access token must start with pat-'),
  }),
  z.object({
    type: z.literal('sentry'),
    authToken: z.string().min(1, 'Auth Token is required'),
    organization: z.string().min(1, 'Organization slug is required'),
  }),
  // --- Non-MVP integrations ---
  z.object({
    type: z.literal('pagerduty'),
    apiKey: z.string().min(1, 'API Key is required'),
  }),
  z.object({
    type: z.literal('datadog'),
    apiKey: z.string().min(1, 'API Key is required'),
    applicationKey: z.string().min(1, 'Application Key is required'),
  }),
  z.object({
    type: z.literal('postgresql'),
    connectionString: z.string().min(1, 'Connection String is required'),
  }),
  z.object({
    type: z.literal('linear'),
    apiKey: z.string().min(1, 'API Key is required'),
  }),
  z.object({
    type: z.literal('mongodb'),
    connectionString: z.string().min(1, 'Connection String is required'),
  }),
  z.object({
    type: z.literal('grafana'),
    apiKey: z.string().min(1, 'API Key is required'),
    url: z.string().url('Please enter a valid Grafana URL'),
  }),
  z.object({
    type: z.literal('confluence'),
    email: z.string().email('Please enter a valid email address'),
    apiToken: z.string().min(1, 'API Token is required'),
    domain: z.string().url('Please enter a valid Confluence domain URL'),
  }),
  z.object({
    type: z.literal('webhooks'),
    webhookUrl: z.string().url('Please enter a valid webhook URL'),
  }),
]);

/**
 * Schema for testing integration credentials without saving.
 * Same shape as connect but used by POST /api/integrations/test.
 */
export const testIntegrationSchema = connectIntegrationSchema;

export type ConnectIntegrationInput = z.infer<typeof connectIntegrationSchema>;
export type TestIntegrationInput = z.infer<typeof testIntegrationSchema>;
