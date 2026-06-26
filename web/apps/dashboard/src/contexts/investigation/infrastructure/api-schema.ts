import { z } from 'zod';

/**
 * Zod validation schemas for the Investigation context API routes.
 * Covers incidents and analyses.
 */

// ---------------------------------------------------------------------------
// Incident
// ---------------------------------------------------------------------------

const incidentSeverities = ['critical', 'high', 'medium', 'low', 'info'] as const;
const sourceProviders = [
  'manual',
  'cloudwatch',
  'datadog',
  'pagerduty',
  'sentry',
  'grafana',
] as const;

export const createIncidentSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string().max(4000, 'Description must be 4000 characters or less').optional(),
  severity: z.enum(incidentSeverities, {
    errorMap: () => ({
      message: 'Severity must be one of: critical, high, medium, low, info',
    }),
  }),
  sourceProvider: z
    .enum(sourceProviders, {
      errorMap: () => ({
        message:
          'Source provider must be one of: manual, cloudwatch, datadog, pagerduty, sentry, grafana',
      }),
    })
    .optional(),
  integrations: z.array(z.string()).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

// ---------------------------------------------------------------------------
// Analysis (legacy — kept for backward compat during migration)
// ---------------------------------------------------------------------------

const analysisSeverities = ['low', 'medium', 'high', 'critical'] as const;
const integrationTypes = [
  'slack',
  'github',
  'jira',
  'cloudwatch',
  'hubspot',
  'trello',
  'postgresql',
  'linear',
  'sentry',
  'mongodb',
  'datadog',
  'pagerduty',
  'grafana',
  'confluence',
  'webhooks',
] as const;

export const createAnalysisSchema = z.object({
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(4000, 'Prompt must be 4000 characters or less'),
  severity: z
    .enum(analysisSeverities, {
      errorMap: () => ({ message: 'Severity must be one of: low, medium, high, critical' }),
    })
    .optional(),
  integrations: z
    .array(z.enum(integrationTypes))
    .max(15, 'Cannot specify more than 15 integrations')
    .optional(),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const feedbackTypes = [
  'investigation_accurate',
  'investigation_inaccurate',
  'investigation_partial',
] as const;

export const submitFeedbackSchema = z.object({
  incidentId: z.string().min(1, 'Incident ID is required'),
  type: z.enum(feedbackTypes, {
    errorMap: () => ({
      message:
        'Type must be one of: investigation_accurate, investigation_inaccurate, investigation_partial',
    }),
  }),
  freeText: z.string().max(2000, 'Comment must be 2000 characters or less').optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
