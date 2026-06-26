import { z } from 'zod';

export const resourceConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['postgres', 'mongodb']),
  name: z.string(),
  connection: z.record(z.string()),
  allowedOperations: z.array(z.enum(['query', 'describe_table', 'list_tables', 'explain'])).default(['query', 'describe_table', 'list_tables', 'explain']),
  maxRowsPerQuery: z.number().default(1000),
});

export const maskingPatternSchema = z.object({
  name: z.string(),
  regex: z.string(),
  replacement: z.string(),
});

export const relayConfigSchema = z.object({
  controlPlane: z.object({
    url: z.string(),
    token: z.string(),
    tenantId: z.string(),
  }),
  resources: z.array(resourceConfigSchema).min(1),
  masking: z.object({
    enabled: z.boolean().default(true),
    patterns: z.array(maskingPatternSchema).default([]),
  }).default({ enabled: true, patterns: [] }),
  audit: z.object({
    enabled: z.boolean().default(true),
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }).default({ enabled: true, level: 'info' }),
});

export type RelayConfig = z.infer<typeof relayConfigSchema>;
export type ResourceConfig = z.infer<typeof resourceConfigSchema>;
export type MaskingConfig = z.infer<typeof relayConfigSchema>['masking'];
export type AuditConfig = z.infer<typeof relayConfigSchema>['audit'];
