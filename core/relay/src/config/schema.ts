import { z } from 'zod';

export const secretRefSchema = z.string().regex(
  /^(env:[\w_]+|aws-sm:[^\s]+|azure-kv:[^\s]+|gcp-sm:[^\s]+|vault:[^\s]+|plain:.*)$/,
  'Secret must be one of: env:NAME, aws-sm:ARN, azure-kv:URL, gcp-sm:NAME, vault:PATH, plain:VALUE',
);

export const driverTypeSchema = z.enum([
  'postgres',
  'mongodb',
  'mysql',
  'redis',
  'elasticsearch',
  'http',
  'prometheus',
  'cloudwatch',
  'kubernetes',
]);
export type DriverType = z.infer<typeof driverTypeSchema>;

export const operationSchema = z.string();

export const columnRuleSchema = z.object({
  table: z.string(),
  column: z.string(),
  action: z.enum(['mask', 'drop', 'fpe', 'pass']),
  classification: z.enum(['pii', 'phi', 'pci', 'secret', 'business']).optional(),
});
export type ColumnRule = z.infer<typeof columnRuleSchema>;

export const resourceConfigSchema = z.object({
  id: z.string(),
  type: driverTypeSchema,
  name: z.string(),
  connection: z.record(z.string()),
  allowedOperations: z.array(operationSchema).default([]),
  allowedTables: z.array(z.string()).optional(),
  blockedTables: z.array(z.string()).optional(),
  maxRowsPerQuery: z.number().default(1000),
  statementTimeoutMs: z.number().default(30_000),
  schema: z.string().optional(),
  rateLimit: z.object({
    requestsPerMinute: z.number().default(120),
    burstCapacity: z.number().default(20),
  }).default({ requestsPerMinute: 120, burstCapacity: 20 }),
  approvalThresholds: z.object({
    rowCount: z.number().optional(),
    sensitiveTables: z.array(z.string()).default([]),
  }).default({ sensitiveTables: [] }),
  columnRules: z.array(columnRuleSchema).default([]),
});
export type ResourceConfig = z.infer<typeof resourceConfigSchema>;

export const maskingPatternSchema = z.object({
  name: z.string(),
  regex: z.string(),
  replacement: z.string(),
  classification: z.enum(['pii', 'phi', 'pci', 'secret', 'business']).default('pii'),
});
export type CustomMaskingPattern = z.infer<typeof maskingPatternSchema>;

export const maskingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  patterns: z.array(maskingPatternSchema).default([]),
  detectors: z.object({
    cpf: z.boolean().default(true),
    cnpj: z.boolean().default(true),
    rg: z.boolean().default(true),
    pis: z.boolean().default(true),
    pix: z.boolean().default(true),
    email: z.boolean().default(true),
    phone: z.boolean().default(true),
    creditCard: z.boolean().default(true),
    bearer: z.boolean().default(true),
    jwt: z.boolean().default(true),
    awsKeys: z.boolean().default(true),
    gcpKeys: z.boolean().default(true),
    pem: z.boolean().default(true),
    iban: z.boolean().default(true),
    ipv4: z.boolean().default(false),
    ipv6: z.boolean().default(false),
  }).default({}),
  fpe: z.object({
    enabled: z.boolean().default(false),
    keyRef: secretRefSchema.optional(),
  }).default({ enabled: false }),
  redactPaths: z.array(z.string()).default([]),
});
export type MaskingConfig = z.infer<typeof maskingConfigSchema>;

export const auditConfigSchema = z.object({
  enabled: z.boolean().default(true),
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  hashChain: z.object({
    enabled: z.boolean().default(true),
    hmacKeyRef: secretRefSchema.optional(),
  }).default({ enabled: true }),
  forward: z.object({
    enabled: z.boolean().default(true),
    bufferPath: z.string().default('/tmp/relay-audit-buffer'),
    batchSize: z.number().default(50),
    flushIntervalMs: z.number().default(5_000),
  }).default({ enabled: true, bufferPath: '/tmp/relay-audit-buffer', batchSize: 50, flushIntervalMs: 5_000 }),
});
export type AuditConfig = z.infer<typeof auditConfigSchema>;

export const transportConfigSchema = z.object({
  kind: z.enum(['wss', 'azure-relay']).default('wss'),
  url: z.string(),
  tenantId: z.string(),
  tokenRef: secretRefSchema,
  mtls: z.object({
    enabled: z.boolean().default(false),
    certRef: secretRefSchema.optional(),
    keyRef: secretRefSchema.optional(),
    caRef: secretRefSchema.optional(),
  }).default({ enabled: false }),
  pinnedSha256: z.string().optional(),
  reconnect: z.object({
    initialDelayMs: z.number().default(1_000),
    maxDelayMs: z.number().default(30_000),
    jitterRatio: z.number().default(0.2),
  }).default({ initialDelayMs: 1_000, maxDelayMs: 30_000, jitterRatio: 0.2 }),
  replayWindow: z.object({
    enabled: z.boolean().default(true),
    ttlMs: z.number().default(5 * 60_000),
    maxEntries: z.number().default(10_000),
  }).default({ enabled: true, ttlMs: 5 * 60_000, maxEntries: 10_000 }),
});
export type TransportConfig = z.infer<typeof transportConfigSchema>;

export const policyConfigSchema = z.object({
  engine: z.enum(['local', 'opa']).default('local'),
  opa: z.object({
    url: z.string().default('http://localhost:8181'),
    packagePath: z.string().default('relay/authz'),
    cacheTtlMs: z.number().default(30_000),
    failClosed: z.boolean().default(true),
    timeoutMs: z.number().default(500),
  }).default({
    url: 'http://localhost:8181',
    packagePath: 'relay/authz',
    cacheTtlMs: 30_000,
    failClosed: true,
    timeoutMs: 500,
  }),
}).default({ engine: 'local' });
export type PolicyConfig = z.infer<typeof policyConfigSchema>;

export const observabilityConfigSchema = z.object({
  http: z.object({
    enabled: z.boolean().default(true),
    port: z.number().default(8080),
  }).default({ enabled: true, port: 8080 }),
  metrics: z.object({
    enabled: z.boolean().default(true),
  }).default({ enabled: true }),
  tracing: z.object({
    enabled: z.boolean().default(false),
    otlpEndpoint: z.string().optional(),
  }).default({ enabled: false }),
}).default({
  http: { enabled: true, port: 8080 },
  metrics: { enabled: true },
  tracing: { enabled: false },
});
export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;

export const sessionConfigSchema = z.object({
  timeBoxed: z.object({
    enabled: z.boolean().default(false),
    requireActiveIncident: z.boolean().default(false),
  }).default({ enabled: false, requireActiveIncident: false }),
  breakGlass: z.object({
    enabled: z.boolean().default(true),
    controlEndpointPath: z.string().default('/break-glass'),
    sharedSecretRef: secretRefSchema.optional(),
  }).default({ enabled: true, controlEndpointPath: '/break-glass' }),
}).default({
  timeBoxed: { enabled: false, requireActiveIncident: false },
  breakGlass: { enabled: true, controlEndpointPath: '/break-glass' },
});
export type SessionConfig = z.infer<typeof sessionConfigSchema>;

export const relayConfigSchema = z.object({
  transport: transportConfigSchema,
  resources: z.array(resourceConfigSchema).min(1),
  masking: maskingConfigSchema.default({}),
  audit: auditConfigSchema.default({}),
  policy: policyConfigSchema,
  observability: observabilityConfigSchema,
  session: sessionConfigSchema,
  plugins: z.object({
    directory: z.string().optional(),
  }).default({}),
});

export type RelayConfig = z.infer<typeof relayConfigSchema>;

export const legacyResourceSchema = z.object({
  id: z.string(),
  type: z.enum(['postgres', 'mongodb']),
  name: z.string(),
  connection: z.record(z.string()),
  allowedOperations: z.array(z.string()).optional(),
  maxRowsPerQuery: z.number().optional(),
});

export const legacyConfigSchema = z.object({
  controlPlane: z.object({
    url: z.string(),
    token: z.string(),
    tenantId: z.string(),
  }),
  resources: z.array(legacyResourceSchema).min(1),
  masking: z.object({
    enabled: z.boolean().optional(),
    patterns: z.array(z.object({
      name: z.string(),
      regex: z.string(),
      replacement: z.string(),
    })).optional(),
  }).optional(),
  audit: z.object({
    enabled: z.boolean().optional(),
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  }).optional(),
});
